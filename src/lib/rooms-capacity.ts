/**
 * Import bed counts (Room.capacity) from the office's model workbook. Its
 * "רשימת חדרים" sheet lists every room in column A and its bed count in
 * column C. ExcelJS chokes on this file's tables, so we read the raw XML.
 */
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { prisma } from "./prisma";

const MODEL_GLOB_HINT = "מודל"; // model file lives in the project root

/** Find the model workbook in the project root (first "מודל…​.xlsx"). */
function findModelFile(): string | null {
  const root = process.cwd();
  const direct = path.join(root, "מודל חודש אייר תשפו.xlsx");
  if (fs.existsSync(direct)) return direct;
  const hit = fs
    .readdirSync(root)
    .find((f) => f.includes(MODEL_GLOB_HINT) && f.endsWith(".xlsx"));
  return hit ? path.join(root, hit) : null;
}

/** Parse room→capacity pairs from the model's "רשימת חדרים" sheet. */
export async function parseModelCapacities(): Promise<Map<string, number>> {
  const file = findModelFile();
  if (!file) throw new Error("קובץ המודל לא נמצא בתיקיית הפרויקט");

  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const nameRid = [
    ...wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g),
  ];
  const ridTarget: Record<string, string> = {};
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    ridTarget[m[1]] = m[2];
  }
  const target = nameRid.find((m) => m[1].includes("רשימת"));
  if (!target) throw new Error('גיליון "רשימת חדרים" לא נמצא בקובץ המודל');
  const sheetFile = "xl/" + ridTarget[target[2]].replace(/^\/?xl\//, "").replace(/^\//, "");

  let ss: string[] = [];
  const sf = zip.file("xl/sharedStrings.xml");
  if (sf) {
    const x = await sf.async("string");
    ss = [...x.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
      [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")
    );
  }

  const sx = await zip.file(sheetFile)!.async("string");
  const rows = [...sx.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
  const out = new Map<string, number>();
  for (const rm of rows) {
    const cells = [
      ...rm[1].matchAll(
        /<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?/g
      ),
    ];
    let code: string | null = null;
    let cap: number | null = null;
    for (const c of cells) {
      const col = c[1];
      const isStr = c[2] === "s";
      const raw = c[3];
      if (col === "A" && raw != null) code = (isStr ? ss[+raw] : raw)?.trim() ?? null;
      if (col === "C" && raw != null && !isStr) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) cap = n;
      }
    }
    if (code && /^[א-ת]/.test(code) && cap && cap > 0) out.set(code, cap);
  }
  return out;
}

/** Write parsed capacities onto matching Room rows. */
export async function importRoomCapacities(): Promise<{
  updated: number;
  unmatched: string[];
}> {
  const caps = await parseModelCapacities();
  const rooms = await prisma.room.findMany({ select: { id: true, code: true } });
  const byCode = new Map(rooms.map((r) => [r.code, r.id]));

  let updated = 0;
  const unmatched: string[] = [];
  for (const [code, cap] of caps) {
    const id = byCode.get(code);
    if (!id) {
      unmatched.push(code);
      continue;
    }
    await prisma.room.update({ where: { id }, data: { capacity: cap } });
    updated++;
  }
  return { updated, unmatched };
}
