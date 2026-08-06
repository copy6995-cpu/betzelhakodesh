/**
 * Shared room helpers: linked rooms (physical rooms split into two catalog
 * entries) and the per-yeshiva demand summary shown atop the allocation page.
 */
import { prisma } from "./prisma";
import { orderCalendarYeshivot } from "./calendar-export";
import { loadCancellations } from "./bed-cancellations";

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
  chulReg: number; // חו״ל — הזמין מיטה בטווח (הפעולה האחרונה = הזמנה)
  chulNotReg: number; // חו״ל — רשום לאש״ל ולא הזמין בטווח
  chulCancel: number; // חו״ל — הפעולה האחרונה = ביטול מיטה
  ariReg: number; // אר״י — הזמין מיטה בטווח
  ariNotReg: number; // אר״י — רשום לאש״ל ולא הזמין בטווח
  ariCancel: number; // אר״י — הפעולה האחרונה = ביטול מיטה
  oneTime: number; // חד-פעמי — הזמנת מיטה בקבוצה 23 (הפעולה האחרונה)
  total: number; // נרשמו + חד-פעמי (מי שיש לו הזמנה חיה)
};

export type DemandTotals = {
  chulReg: number;
  chulNotReg: number;
  chulCancel: number;
  ariReg: number;
  ariNotReg: number;
  ariCancel: number;
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

/** Parse Yemot's "dd/mm/yyyy" date + optional "HH:MM[:SS]" time into a Date.
 *  The time lets us order a person's booking/cancel events ("last one wins"). */
function parseDmy(s: string | null | undefined, time?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  let HH = "00", MM = "00", SS = "00";
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((time ?? "").trim());
  if (tm) {
    HH = tm[1].padStart(2, "0");
    MM = tm[2];
    SS = tm[3] ?? "00";
  }
  const d = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Read the "שעה" (HH:MM:SS) time field out of a reservation's raw JSON. */
function timeFromRaw(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const v = (JSON.parse(raw) as Record<string, unknown>)["שעה"];
    return v == null ? "" : String(v);
  } catch {
    return "";
  }
}

/**
 * Per-yeshiva room demand for a DATE RANGE (by the Yemot reservation date).
 * Each student's status is decided by their LAST booking/cancel action in the
 * range ("האחרון קובע": booked → cancelled → booked again = registered):
 *  - נרשמו (אר״י/חו״ל): last action is a regular-group booking (אר״י/חו״ל from
 *    the BOOKING's גזירה שביעית, not the אש״ל form)
 *  - חד-פעמי: last action is a GROUP 23 booking (the casual/one-time group)
 *  - ביטולים (אר״י/חו״ל): last action is a cancellation (שלוחה 5)
 *  - לא נרשמו (אר״י/חו״ל): registered for אש״ל but no booking/cancel in the range
 * סה״כ = נרשמו + חד-פעמי (a live booking). ביטולים / לא נרשמו aren't in the total.
 * (Reservation weekKey is "YYYY-WW" while allocation weeks are "YYYY-MM-DD", so
 * we filter on the reservation date, never on weekKey equality.)
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

  // Per person, in [from, to]: the LATEST booking (with its אר״י/חו״ל + group)
  // and the LATEST cancellation, by full timestamp (date + שעה). Cancellation
  // rows are the ones whose source is a cancellation path (שלוחה 5).
  const cancelPaths = cancellations.paths;
  type Latest = { bookTs: number; ariChul: string; group: string; cancelTs: number };
  const perPerson = new Map<string, Latest>();
  for (const r of bookerRows) {
    const d = parseDmy(r.date, timeFromRaw(r.raw));
    if (!d || d < from || d > to) continue;
    const ts = d.getTime();
    let p = perPerson.get(r.personalCode);
    if (!p) {
      p = { bookTs: -1, ariChul: "", group: "", cancelTs: -1 };
      perPerson.set(r.personalCode, p);
    }
    if (cancelPaths.has(r.source)) {
      if (ts > p.cancelTs) p.cancelTs = ts;
    } else if (ts > p.bookTs) {
      p.bookTs = ts;
      p.ariChul = bookingAriChul(r.raw);
      p.group = bookingGroup(r.raw);
    }
  }

  const map = new Map<string, YeshivaDemand>();
  const ensure = (y: string) => {
    let d = map.get(y);
    if (!d) {
      d = { yeshiva: y, chulReg: 0, chulNotReg: 0, chulCancel: 0, ariReg: 0, ariNotReg: 0, ariCancel: 0, oneTime: 0, total: 0 };
      map.set(y, d);
    }
    return d;
  };

  for (const s of students) {
    const d = ensure(s.yeshiva);
    const p = perPerson.get(s.personalCode);
    if (p && p.bookTs >= 0 && p.bookTs >= p.cancelTs) {
      // נרשמו — הפעולה האחרונה היא הזמנה; אר״י/חו״ל לפי ההזמנה, ואם חסר
      // (למשל רישום ידני) — לפי האש״ל של התלמיד.
      if (p.group === ONE_TIME_GROUP) d.oneTime++;
      else if ((p.ariChul || s.ariChul) === "ארי") d.ariReg++;
      else d.chulReg++;
    } else if (p && p.cancelTs >= 0) {
      // ביטול — הפעולה האחרונה היא ביטול; אר״י/חו״ל לפי ההזמנה שבוטלה (או האש״ל).
      if ((p.ariChul || s.ariChul) === "ארי") d.ariCancel++;
      else d.chulCancel++;
    } else if (s.registeredEshel) {
      // לא נרשמו — אש״ל, בלי הזמנה/ביטול בטווח; אר״י/חו״ל לפי רישום האש״ל.
      if (s.ariChul === "ארי") d.ariNotReg++;
      else d.chulNotReg++;
    }
    // else: not אש״ל and no activity in range → not part of this range's demand
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
      chulCancel: t.chulCancel + r.chulCancel,
      ariReg: t.ariReg + r.ariReg,
      ariNotReg: t.ariNotReg + r.ariNotReg,
      ariCancel: t.ariCancel + r.ariCancel,
      oneTime: t.oneTime + r.oneTime,
      total: t.total + r.total,
    }),
    {
      chulReg: 0,
      chulNotReg: 0,
      chulCancel: 0,
      ariReg: 0,
      ariNotReg: 0,
      ariCancel: 0,
      oneTime: 0,
      total: 0,
    }
  );

  return { rows, totals };
}
