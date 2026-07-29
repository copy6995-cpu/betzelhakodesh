/**
 * Shared room helpers: linked rooms (physical rooms split into two catalog
 * entries) and the per-yeshiva demand summary shown atop the allocation page.
 */
import { prisma } from "./prisma";
import { orderCalendarYeshivot } from "./calendar-export";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";

/**
 * Some physical rooms are two catalog entries that must be assigned together
 * and counted as one room. Map each sub-code to its physical room code.
 */
export const LINKED_ROOMS: Record<string, string> = {
  "א300_1": "א300",
  "א300_2": "א300",
  "א403_1": "א403",
  "א403_2": "א403",
};

/** The physical room a catalog code belongs to (itself, unless it's linked). */
export function physicalCode(code: string): string {
  return LINKED_ROOMS[code] ?? code;
}

export type RoomUnit = {
  key: string; // physical code — the unit's identity
  code: string; // display code (physical)
  roomIds: string[]; // one, or two for a linked pair
  capacity: number | null; // summed beds of the members, null if none known
  assignedTo: string | null; // yeshiva; "(מעורב)" if members disagree
};

/**
 * Collapse a building's rooms into units, merging linked pairs into one.
 * Preserves the incoming order (rooms arrive pre-sorted by `order`).
 */
export function mergeRoomUnits(
  rooms: { id: string; code: string; capacity: number | null; assignedTo: string | null }[]
): RoomUnit[] {
  const byKey = new Map<string, RoomUnit>();
  const order: string[] = [];
  for (const r of rooms) {
    const key = physicalCode(r.code);
    let u = byKey.get(key);
    if (!u) {
      u = { key, code: key, roomIds: [], capacity: null, assignedTo: null };
      byKey.set(key, u);
      order.push(key);
    }
    u.roomIds.push(r.id);
    if (r.capacity != null) u.capacity = (u.capacity ?? 0) + r.capacity;
    if (r.assignedTo) {
      if (u.assignedTo && u.assignedTo !== r.assignedTo) u.assignedTo = "(מעורב)";
      else u.assignedTo = r.assignedTo;
    }
  }
  return order.map((k) => byKey.get(k)!);
}

export type YeshivaDemand = {
  yeshiva: string;
  ari: number; // registered for אש״ל, אר״י
  chul: number; // registered for אש״ל, חו״ל
  oneTime: number; // booked a bed but not registered for אש״ל
  total: number;
};

/**
 * Per-yeshiva demand: אש״ל subscribers split אר״י/חו״ל, plus one-time bed
 * bookers (approved Yemot reservation, not registered for אש״ל). Season-level
 * planning figures — independent of which week you're allocating.
 */
export async function loadRoomDemand(activeYear: string): Promise<{
  rows: YeshivaDemand[];
  totals: { ari: number; chul: number; oneTime: number; total: number };
}> {
  const [students, bookerRows, cancellations] = await Promise.all([
    prisma.student.findMany({
      where: { year: activeYear, archived: false },
      select: {
        personalCode: true,
        yeshiva: true,
        ariChul: true,
        registeredEshel: true,
      },
    }),
    prisma.yemotBedReservation.findMany({
      where: { status: "מאושר" },
      select: { personalCode: true, weekKey: true, source: true },
    }),
    loadCancellations(),
  ]);

  // Distinct students with at least one live (non-cancelled) booking.
  const bookers = new Set(
    bookerRows
      .filter((r) => isLiveBooking(r, cancellations))
      .map((r) => r.personalCode)
  );

  const map = new Map<string, YeshivaDemand>();
  const ensure = (y: string) => {
    let d = map.get(y);
    if (!d) {
      d = { yeshiva: y, ari: 0, chul: 0, oneTime: 0, total: 0 };
      map.set(y, d);
    }
    return d;
  };

  for (const s of students) {
    const d = ensure(s.yeshiva);
    if (s.registeredEshel) {
      if (s.ariChul === "ארי") d.ari++;
      else if (s.ariChul === "חול") d.chul++;
      else d.chul++; // unknown ari/chul falls to חו״ל so the head-count still lands
    } else if (bookers.has(s.personalCode)) {
      d.oneTime++;
    }
  }

  // Order by the shared yeshiva ordering (drops ארכיון / לא-שובץ buckets).
  const ordered = orderCalendarYeshivot([...map.keys()]);
  const rows = ordered.map((y) => {
    const d = map.get(y)!;
    d.total = d.ari + d.chul + d.oneTime;
    return d;
  });
  const totals = rows.reduce(
    (t, r) => ({
      ari: t.ari + r.ari,
      chul: t.chul + r.chul,
      oneTime: t.oneTime + r.oneTime,
      total: t.total + r.total,
    }),
    { ari: 0, chul: 0, oneTime: 0, total: 0 }
  );

  return { rows, totals };
}
