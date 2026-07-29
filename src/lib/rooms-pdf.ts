/**
 * Server-side PDF of the room-assignment report (one yeshiva per page, wings
 * stacked) so it can be bundled into the export zip beside the Excel files.
 *
 * We render the same HTML the /rooms/print page shows, then print it with a
 * headless Chrome/Edge already on the machine (puppeteer-core — no bundled
 * Chromium). Best-effort: if no browser is found the caller ships the zip
 * without the PDF rather than failing the whole export.
 */
import * as fs from "fs";
import { prisma } from "./prisma";
import { mergeRoomUnits, type RoomUnit } from "./rooms";
import { orderCalendarYeshivot } from "./calendar-export";
import { weekLabel } from "./weeks";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findBrowser(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const p of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build the report HTML (yeshiva → wing → rooms), matching the print page. */
export async function buildRoomsPdfHtml(opts: {
  weekKey: string;
  label?: string;
}): Promise<{ html: string; roomCount: number; yeshivaCount: number }> {
  const label = (opts.label ?? "").trim();
  const allocations = await prisma.roomAllocation.findMany({
    where: { weekKey: opts.weekKey },
    include: { room: true },
  });

  const rawByYB = new Map<
    string,
    Map<string, { id: string; code: string; capacity: number | null; order: number }[]>
  >();
  for (const a of allocations) {
    const yb = rawByYB.get(a.yeshiva) ?? new Map();
    const arr = yb.get(a.room.building) ?? [];
    arr.push({
      id: a.roomId,
      code: a.room.code,
      capacity: a.room.capacity,
      order: a.room.order,
    });
    yb.set(a.room.building, arr);
    rawByYB.set(a.yeshiva, yb);
  }

  const byYeshiva = new Map<string, Map<string, RoomUnit[]>>();
  for (const [yeshiva, yb] of rawByYB) {
    const buildings = new Map<string, RoomUnit[]>();
    for (const [building, rooms] of yb) {
      rooms.sort((x, y) => x.order - y.order || x.code.localeCompare(y.code, "he"));
      buildings.set(
        building,
        mergeRoomUnits(rooms.map((r) => ({ ...r, assignedTo: yeshiva })))
      );
    }
    byYeshiva.set(yeshiva, buildings);
  }

  const names = [...byYeshiva.keys()];
  const ordered = orderCalendarYeshivot(names);
  const yeshivaOrder = [...ordered, ...names.filter((n) => !ordered.includes(n))];
  const anyCapacity = allocations.some((a) => a.room.capacity != null);

  const sections = yeshivaOrder
    .map((yeshiva) => {
      const buildings = byYeshiva.get(yeshiva)!;
      let rooms = 0;
      let beds = 0;
      for (const units of buildings.values()) {
        rooms += units.length;
        for (const u of units) beds += u.capacity ?? 0;
      }
      const wings = [...buildings.entries()]
        .map(([building, units]) => {
          const chips = units
            .map(
              (u) =>
                `<span class="chip">${esc(u.code)}${
                  anyCapacity && u.capacity != null
                    ? `<small>${u.capacity}</small>`
                    : ""
                }</span>`
            )
            .join("");
          return `<div class="wing"><div class="wing-h">${esc(
            building
          )} <span class="muted">(${units.length})</span></div><div class="chips">${chips}</div></div>`;
        })
        .join("");
      return `<section class="yeshiva">
        <div class="y-head"><h2>${esc(yeshiva)}</h2><span class="muted">${
        label ? esc(label) + " · " : ""
      }${rooms} חדרים${anyCapacity ? ` · ${beds} מיטות` : ""}</span></div>
        ${wings}
      </section>`;
    })
    .join("");

  const title = `חלוקת חדרים${label ? " — " + esc(label) : ""}`;
  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; margin: 0; color: #1a1a1a; }
  @page { size: A4; margin: 1.2cm; }
  .yeshiva { page-break-before: always; }
  .yeshiva:first-of-type { page-break-before: avoid; }
  .y-head { display: flex; align-items: baseline; justify-content: space-between;
            border-bottom: 2px solid #0f2942; padding-bottom: 4px; margin: 0 0 10px; }
  h2 { color: #0f2942; font-size: 20px; margin: 0; }
  .muted { color: #6b7280; font-size: 12px; }
  .wing { margin-bottom: 10px; break-inside: avoid; }
  .wing-h { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 8px;
          font-family: "Courier New", monospace; font-size: 13px; }
  .chip small { color: #6b7280; margin-inline-start: 4px; font-size: 10px; }
  h1.title { font-size: 15px; color: #6b7280; font-weight: 600; margin: 0 0 12px; }
</style></head><body>
  <h1 class="title">${title} · שבוע ${esc(weekLabel(opts.weekKey))}</h1>
  ${sections || '<p class="muted">אין שיבוצי חדרים לשבוע זה.</p>'}
</body></html>`;

  return { html, roomCount: allocations.length, yeshivaCount: yeshivaOrder.length };
}

/** Render the report to a PDF Buffer, or null if no headless browser exists. */
export async function renderRoomsPdf(opts: {
  weekKey: string;
  label?: string;
}): Promise<Buffer | null> {
  const executablePath = findBrowser();
  if (!executablePath) return null;

  const { html, roomCount } = await buildRoomsPdfHtml(opts);
  if (roomCount === 0) return null;

  const puppeteer = (await import("puppeteer-core")).default;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1.2cm", bottom: "1.2cm", left: "1cm", right: "1cm" },
    });
    return Buffer.from(pdf);
  } catch {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
