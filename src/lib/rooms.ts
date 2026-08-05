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
  chulReg: number; // חו״ל, רשום לאש״ל
  chulNotReg: number; // חו״ל, לא רשום לאש״ל (ולא חד-פעמי)
  ariReg: number; // אר״י, רשום לאש״ל
  ariNotReg: number; // אר״י, לא רשום לאש״ל
  oneTime: number; // חד-פעמי — הזמנת מיטה חיה בקבוצה 23
  total: number; // סך התלמידים בישיבה (סכום כל העמודות)
};

export type DemandTotals = {
  chulReg: number;
  chulNotReg: number;
  ariReg: number;
  ariNotReg: number;
  oneTime: number;
  total: number;
};

/** One-time (חד-פעמי) bookers register in Yemot GROUP 23 (CutList8 = "23") —
 *  the casual/one-time group. Only that group counts toward "חד פעמי". */
const ONE_TIME_GROUP = "23";

/** A booking's group (CutList8) from its raw JSON. */
function bookingGroup(raw: string): string {
  try {
    const g = (JSON.parse(raw) as { CutList8?: unknown }).CutList8;
    return g == null ? "" : String(g).trim();
  } catch {
    return "";
  }
}

/** A booking's own אר״י/חו״ל ("גזירה שביעית": "ארי"/"חול") from its raw JSON.
 *  This is what the booker chose in Yemot — independent of the אש״ל form. */
function bookingAriChul(raw: string): string {
  try {
    const v = (JSON.parse(raw) as Record<string, unknown>)["גזירה שביעית"];
    return v == null ? "" : String(v).trim();
  } catch {
    return "";
  }
}

/** Parse Yemot's "dd/mm/yyyy" reservation date into a Date. Null on failure. */
function parseDmy(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Per-yeshiva room demand for a DATE RANGE (by the Yemot reservation date):
 *  - נרשמו (אר״י/חו״ל): booked a bed in the range in a regular group (not 23) —
 *    the אר״י/חו״ל split comes from the BOOKING (גזירה שביעית), not the אש״ל form
 *  - לא נרשמו (אר״י/חו״ל): registered for אש״ל but did NOT book in the range
 *    (split here is the אש״ל registration's אר״י/חו״ל)
 *  - חד-פעמי: booked a bed in the range in GROUP 23 (the casual/one-time group)
 * סה״כ = נרשמו + חד-פעמי (only those who actually booked). A student who
 * neither booked in the range nor is אש״ל-registered isn't counted.
 * (The reservation weekKey is "YYYY-WW" while allocation weeks are "YYYY-MM-DD",
 * so we filter on the reservation date, never on weekKey equality.)
 */
export async function loadRoomDemand(
  activeYear: string,
  from: Date,
  to: Date
): Promise<{
  rows: YeshivaDemand[];
  totals: DemandTotals;
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
      select: {
        personalCode: true,
        weekKey: true,
        source: true,
        raw: true,
        date: true,
      },
    }),
    loadCancellations(),
  ]);

  // Bookings whose reservation date falls in [from, to]. For "נרשמו" the
  // אר״י/חו״ל split comes from the BOOKING itself (גזירה שביעית), not the אש״ל.
  const regularInRange = new Map<string, string>(); // personalCode → booking אר״י/חו״ל
  const group23InRange = new Set<string>();
  for (const r of bookerRows) {
    const d = parseDmy(r.date);
    if (!d || d < from || d > to) continue;
    if (!isLiveBooking(r, cancellations)) continue;
    if (bookingGroup(r.raw) === ONE_TIME_GROUP) group23InRange.add(r.personalCode);
    else regularInRange.set(r.personalCode, bookingAriChul(r.raw));
  }

  const map = new Map<string, YeshivaDemand>();
  const ensure = (y: string) => {
    let d = map.get(y);
    if (!d) {
      d = { yeshiva: y, chulReg: 0, chulNotReg: 0, ariReg: 0, ariNotReg: 0, oneTime: 0, total: 0 };
      map.set(y, d);
    }
    return d;
  };

  for (const s of students) {
    const d = ensure(s.yeshiva);
    const bookedAriChul = regularInRange.get(s.personalCode);
    if (bookedAriChul !== undefined) {
      // נרשמו — הזמין מיטה בטווח; אר״י/חו״ל לפי ההזמנה (לא לפי האש״ל).
      if (bookedAriChul === "ארי") d.ariReg++;
      else d.chulReg++; // "חול" או ריק → חו״ל
    } else if (group23InRange.has(s.personalCode)) {
      d.oneTime++; // חד-פעמי — group 23 booking in range
    } else if (s.registeredEshel) {
      // לא נרשמו — אש״ל, לא הזמין בטווח; אר״י/חו״ל לפי רישום האש״ל.
      if (s.ariChul === "ארי") d.ariNotReg++;
      else d.chulNotReg++;
    }
    // else: not אש״ל and no booking in range → not part of this range's demand
  }

  // Order by the shared yeshiva ordering (drops ארכיון / לא-שובץ buckets).
  const ordered = orderCalendarYeshivot([...map.keys()]);
  const rows = ordered.map((y) => {
    const d = map.get(y)!;
    // סה״כ = מי שהזמין מיטה השבוע בלבד (נרשמו + חד-פעמי). "לא נרשמו" מוצג
    // לצד המידע אבל אינו נספר בסה״כ.
    d.total = d.chulReg + d.ariReg + d.oneTime;
    return d;
  });
  const totals = rows.reduce<DemandTotals>(
    (t, r) => ({
      chulReg: t.chulReg + r.chulReg,
      chulNotReg: t.chulNotReg + r.chulNotReg,
      ariReg: t.ariReg + r.ariReg,
      ariNotReg: t.ariNotReg + r.ariNotReg,
      oneTime: t.oneTime + r.oneTime,
      total: t.total + r.total,
    }),
    { chulReg: 0, chulNotReg: 0, ariReg: 0, ariNotReg: 0, oneTime: 0, total: 0 }
  );

  return { rows, totals };
}
