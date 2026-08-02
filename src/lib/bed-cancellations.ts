/**
 * Bed cancellations (task #33). A student who cancels dials שלוחה 5 from the
 * main menu; those calls land in a Yemot report configured as a source with
 * kind="cancellation". Its rows don't remove anything — they simply void the
 * matching booking: any reservation with the same personalCode + weekKey is
 * treated as cancelled and dropped from every report/matrix.
 */
import { prisma } from "./prisma";
import { parseDmyLocal } from "./beds-matrix";

/** Key a reservation by who + which week — the granularity a cancellation voids. */
export const bookingKey = (personalCode: string, weekKey: string) =>
  `${personalCode}|${weekKey}`;

export type Cancellations = {
  /** Source paths marked kind="cancellation" — their rows are never bookings. */
  paths: Set<string>;
  /** personalCode|weekKey pairs a cancellation covers. */
  keys: Set<string>;
};

/** A cancel call applies to a booking at most this many days away. */
const CANCEL_WINDOW_MS = 7 * 24 * 3600 * 1000;

/**
 * Load the cancellation source paths and the set of voided personalCode|weekKey
 * keys. A cancellation row carries only the student + the call DATE (שלוחה 5 has
 * no week field), and Yemot's week numbering doesn't line up with the calendar
 * — so we void the student's booking whose date is closest to the call, within
 * a 7-day window, rather than deriving a week from the date.
 */
export async function loadCancellations(): Promise<Cancellations> {
  const sources = await prisma.yemotSource.findMany({
    where: { kind: "cancellation" },
    select: { path: true },
  });
  const paths = new Set(sources.map((s) => s.path));
  if (paths.size === 0) return { paths, keys: new Set() };
  const pathList = [...paths];

  const [cancelRows, bookings] = await Promise.all([
    prisma.yemotBedReservation.findMany({
      where: { source: { in: pathList } },
      select: { personalCode: true, date: true },
    }),
    prisma.yemotBedReservation.findMany({
      where: { source: { notIn: pathList }, status: "מאושר" },
      select: { personalCode: true, weekKey: true, date: true },
    }),
  ]);

  // Bookings grouped by student, with their date as a timestamp.
  const byCode = new Map<string, { weekKey: string; time: number }[]>();
  for (const b of bookings) {
    const d = parseDmyLocal(b.date);
    if (!d) continue;
    const arr = byCode.get(b.personalCode) ?? [];
    arr.push({ weekKey: b.weekKey, time: d.getTime() });
    byCode.set(b.personalCode, arr);
  }

  const keys = new Set<string>();
  for (const c of cancelRows) {
    const cd = parseDmyLocal(c.date);
    if (!cd) continue;
    const candidates = byCode.get(c.personalCode);
    if (!candidates) continue;
    let best: string | null = null;
    let bestDiff = Infinity;
    for (const b of candidates) {
      const diff = Math.abs(b.time - cd.getTime());
      if (diff <= CANCEL_WINDOW_MS && diff < bestDiff) {
        bestDiff = diff;
        best = b.weekKey;
      }
    }
    if (best) keys.add(bookingKey(c.personalCode, best));
  }
  return { paths, keys };
}

/**
 * A reservation counts as a live booking when it isn't itself a cancellation
 * row and no cancellation voids its personalCode+week.
 */
export function isLiveBooking(
  r: { source: string; personalCode: string; weekKey: string },
  c: Cancellations
): boolean {
  return (
    !c.paths.has(r.source) &&
    !c.keys.has(bookingKey(r.personalCode, r.weekKey))
  );
}
