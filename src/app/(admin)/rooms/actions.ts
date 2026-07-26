"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { weekKeyOf, parseISODate } from "@/lib/weeks";
import * as XLSX from "xlsx";

/** Assign rooms to a yeshiva for a specific week. Existing allocations of
 *  those rooms (this week only) get replaced. */
export async function assignRooms(params: {
  weekKey: string;
  yeshiva: string;
  roomIds: string[];
}): Promise<{ assigned: number }> {
  if (!params.weekKey) throw new Error("שבוע חסר");
  if (!params.yeshiva) throw new Error("ישיבה חסרה");
  if (params.roomIds.length === 0) return { assigned: 0 };

  let assigned = 0;
  for (const roomId of params.roomIds) {
    await prisma.roomAllocation.upsert({
      where: { weekKey_roomId: { weekKey: params.weekKey, roomId } },
      create: {
        weekKey: params.weekKey,
        roomId,
        yeshiva: params.yeshiva,
      },
      update: {
        yeshiva: params.yeshiva,
      },
    });
    assigned++;
  }
  revalidatePath("/rooms");
  return { assigned };
}

/** Clear one room's assignment for the given week. */
export async function unassignRoom(
  weekKey: string,
  roomId: string
): Promise<void> {
  await prisma.roomAllocation.deleteMany({
    where: { weekKey, roomId },
  });
  revalidatePath("/rooms");
}

/** Clear a yeshiva's entire week (undo). */
export async function clearYeshivaAllocations(
  weekKey: string,
  yeshiva: string
): Promise<{ removed: number }> {
  const res = await prisma.roomAllocation.deleteMany({
    where: { weekKey, yeshiva },
  });
  revalidatePath("/rooms");
  return { removed: res.count };
}

/** Copy allocations from `sourceWeek` to `targetWeek`. Rooms already assigned
 *  in the target week are left alone (so re-runs are safe). */
export async function copyFromWeek(
  sourceWeek: string,
  targetWeek: string
): Promise<{ copied: number }> {
  if (sourceWeek === targetWeek) throw new Error("שבוע מקור וזהות");
  const source = await prisma.roomAllocation.findMany({
    where: { weekKey: sourceWeek },
  });
  const existing = await prisma.roomAllocation.findMany({
    where: { weekKey: targetWeek },
    select: { roomId: true },
  });
  const taken = new Set(existing.map((e) => e.roomId));
  let copied = 0;
  for (const a of source) {
    if (taken.has(a.roomId)) continue;
    await prisma.roomAllocation.create({
      data: {
        weekKey: targetWeek,
        roomId: a.roomId,
        yeshiva: a.yeshiva,
        notes: a.notes,
      },
    });
    copied++;
  }
  revalidatePath("/rooms");
  return { copied };
}

/**
 * Import historical allocations from an uploaded Excel file. Accepts either
 * a single-sheet flat list (columns: שבוע / חדר / ישיבה) or a multi-sheet
 * workbook where each sheet name IS the week (YYYY-MM-DD or dd/mm/yyyy)
 * and rows are pairs of (חדר, ישיבה).
 *
 * A "week" cell may be:
 *   - "YYYY-MM-DD" — used as-is (snapped to Sunday if not already)
 *   - "dd/mm/yyyy"  — parsed as local date, snapped to Sunday
 *   - Any string that includes a valid date substring
 *
 * Returns per-week counts and any rows that couldn't be matched.
 */
export async function importHistory(fileBuffer: ArrayBuffer): Promise<{
  imported: number;
  perWeek: Array<{ weekKey: string; count: number }>;
  errors: string[];
}> {
  const wb = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
  const errors: string[] = [];

  // Build a code → id lookup once.
  const rooms = await prisma.room.findMany({
    select: { id: true, code: true },
  });
  const codeToId = new Map(rooms.map((r) => [r.code, r.id]));

  type Row = { weekKey: string; roomCode: string; yeshiva: string; notes?: string };
  const parsed: Row[] = [];

  function normalizeWeek(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    // Excel dates come through as JS Dates when we use cellDates:true, but
    // the sheet-to-json default is a serial number or ISO. Handle each.
    if (raw instanceof Date) {
      const s = weekKeyOf(raw);
      return s;
    }
    const s = String(raw).trim();
    if (!s) return null;
    // ISO
    const isoM = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (isoM) {
      const d = parseISODate(isoM[0]);
      return d ? weekKeyOf(d) : null;
    }
    // dd/mm/yyyy
    const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s);
    if (dmy) {
      const d = new Date(
        parseInt(dmy[3], 10),
        parseInt(dmy[2], 10) - 1,
        parseInt(dmy[1], 10)
      );
      if (!isNaN(d.getTime())) return weekKeyOf(d);
    }
    return null;
  }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    // sheet_to_json with header:1 gives an array-of-arrays.
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (rows.length === 0) continue;

    // Sniff header: does the first row contain Hebrew column names?
    const header = rows[0].map((c) => String(c ?? "").trim());
    let weekCol = -1,
      roomCol = -1,
      yeshivaCol = -1,
      notesCol = -1;
    header.forEach((h, i) => {
      if (["שבוע", "תאריך", "week", "date"].includes(h)) weekCol = i;
      else if (["חדר", "מספר חדר", "room", "code"].includes(h)) roomCol = i;
      else if (["ישיבה", "yeshiva", "group"].includes(h)) yeshivaCol = i;
      else if (["הערה", "הערות", "notes"].includes(h)) notesCol = i;
    });

    // Fall back: sheet name IS the week; row order is (room, yeshiva[, notes]).
    const sheetLevelWeek = weekCol < 0 ? normalizeWeek(sheetName) : null;

    const startAt = weekCol >= 0 || roomCol >= 0 || yeshivaCol >= 0 ? 1 : 0;

    for (let i = startAt; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const rawWeek = weekCol >= 0 ? row[weekCol] : sheetLevelWeek;
      const rawRoom = roomCol >= 0 ? row[roomCol] : row[0];
      const rawYeshiva = yeshivaCol >= 0 ? row[yeshivaCol] : row[1];
      const rawNotes = notesCol >= 0 ? row[notesCol] : "";
      if (!rawWeek || !rawRoom || !rawYeshiva) continue;

      const wk =
        typeof rawWeek === "string"
          ? normalizeWeek(rawWeek)
          : rawWeek instanceof Date
          ? weekKeyOf(rawWeek)
          : normalizeWeek(String(rawWeek));
      const rc = String(rawRoom).trim();
      const yv = String(rawYeshiva).trim();
      const nt = String(rawNotes ?? "").trim();
      if (!wk || !rc || !yv) continue;

      parsed.push({ weekKey: wk, roomCode: rc, yeshiva: yv, notes: nt });
    }
  }

  // Bulk-insert with dedup: (weekKey, roomCode) uniques.
  const perWeekCount = new Map<string, number>();
  let imported = 0;
  for (const p of parsed) {
    const roomId = codeToId.get(p.roomCode);
    if (!roomId) {
      errors.push(`חדר לא נמצא: "${p.roomCode}" (שבוע ${p.weekKey})`);
      continue;
    }
    await prisma.roomAllocation.upsert({
      where: { weekKey_roomId: { weekKey: p.weekKey, roomId } },
      create: {
        weekKey: p.weekKey,
        roomId,
        yeshiva: p.yeshiva,
        notes: p.notes || null,
      },
      update: {
        yeshiva: p.yeshiva,
        notes: p.notes || null,
      },
    });
    imported++;
    perWeekCount.set(p.weekKey, (perWeekCount.get(p.weekKey) ?? 0) + 1);
  }

  revalidatePath("/rooms");
  revalidatePath("/rooms/history");
  return {
    imported,
    perWeek: [...perWeekCount.entries()]
      .map(([weekKey, count]) => ({ weekKey, count }))
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey)),
    // Dedup errors + cap length
    errors: [...new Set(errors)].slice(0, 25),
  };
}
