/**
 * Bed cancellations (task #33). A student who cancels dials שלוחה 5 from the
 * main menu; those calls land in a Yemot report configured as a source with
 * kind="cancellation". Its rows don't remove anything — they simply void the
 * matching booking: any reservation with the same personalCode + weekKey is
 * treated as cancelled and dropped from every report/matrix.
 */
import { prisma } from "./prisma";

/** Key a reservation by who + which week — the granularity a cancellation voids. */
export const bookingKey = (personalCode: string, weekKey: string) =>
  `${personalCode}|${weekKey}`;

export type Cancellations = {
  /** Source paths marked kind="cancellation" — their rows are never bookings. */
  paths: Set<string>;
  /** personalCode|weekKey pairs a cancellation covers. */
  keys: Set<string>;
};

/**
 * Load the cancellation source paths and the set of voided personalCode|weekKey
 * keys. Independent of row status, so it works even if cancellation rows carry
 * a status other than "מאושר".
 */
export async function loadCancellations(): Promise<Cancellations> {
  const sources = await prisma.yemotSource.findMany({
    where: { kind: "cancellation" },
    select: { path: true },
  });
  const paths = new Set(sources.map((s) => s.path));
  if (paths.size === 0) return { paths, keys: new Set() };

  const rows = await prisma.yemotBedReservation.findMany({
    where: { source: { in: [...paths] } },
    select: { personalCode: true, weekKey: true },
  });
  return {
    paths,
    keys: new Set(rows.map((r) => bookingKey(r.personalCode, r.weekKey))),
  };
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
