/**
 * "אש"ל registration" has two layers:
 *   1. `Student.registeredEshel` — the booked/paid fact (set by sync + forms).
 *   2. The season cutoff — each `Student.endDateLabel` (e.g. "חנוכה") maps to
 *      an `EndDateOption(year,label).date`. Once that date arrives, the bachur
 *      is no longer *actively* in אש"ל even though the booking record stays.
 *
 * So the effective, currently-active status is DERIVED:
 *   activeEshel = registeredEshel && (no season date, or season not yet passed)
 *
 * Nothing is mutated — change a season's date and every count/report reflects
 * it immediately. This module is the single source of that derivation.
 */
import { prisma } from "./prisma";

/** The standard end-of-registration seasons every year is seeded with. Real
 *  data may carry others (e.g. "תשרי") — the settings editor unions these
 *  with whatever labels students actually have. */
export const END_DATE_SEASONS = ["חנוכה", "פסח", "סוף שנה"];

/** Chronological order within a school year (Tishrei → Elul), used to sort
 *  season labels for display. Unknown labels sort to the end. */
const SEASON_ORDER = [
  "תשרי",
  "סוכות",
  "חשון",
  "מרחשון",
  "כסלו",
  "חנוכה",
  "טבת",
  "שבט",
  "אדר",
  "ניסן",
  "פסח",
  "אייר",
  "סיון",
  "תמוז",
  "אב",
  "אלול",
  "סוף שנה",
];

/** Order season labels chronologically; unknowns go last, alphabetically. */
export function orderSeasons(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ia = SEASON_ORDER.indexOf(a);
    const ib = SEASON_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "he");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Season labels in `year` whose end date is today or earlier (i.e. lapsed).
 * A bachur registered "until" one of these is no longer active in אש"ל.
 * The flip happens ON the date itself ("בתאריך הזה הופך ללא רשום").
 */
export async function getExpiredEndDateLabels(
  year: string,
  now: Date = new Date()
): Promise<string[]> {
  const startOfTomorrow = new Date(now);
  startOfTomorrow.setHours(0, 0, 0, 0);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const opts = await prisma.endDateOption.findMany({
    // A NULL date never matches `lt`, so seasons without a date stay active.
    where: { year, date: { lt: startOfTomorrow } },
    select: { label: true },
  });
  return opts.map((o) => o.label);
}

/** Prisma where-fragment: bachur is CURRENTLY registered for אש"ל.
 *  Note the explicit `endDateLabel: null` branch — SQL's `NOT (col IN (...))`
 *  evaluates to NULL (→ excluded) for NULL columns, so a plain `notIn` would
 *  wrongly drop bachurim with no season set. They have no cutoff → active. */
export function activeEshelWhere(
  expiredLabels: string[]
): Record<string, unknown> {
  return {
    registeredEshel: true,
    ...(expiredLabels.length
      ? {
          OR: [
            { endDateLabel: null },
            { endDateLabel: { notIn: expiredLabels } },
          ],
        }
      : {}),
  };
}

/** Prisma where-fragment: the complement — NOT currently registered
 *  (never booked, or the season lapsed). */
export function notActiveEshelWhere(
  expiredLabels: string[]
): Record<string, unknown> {
  return {
    OR: [
      { registeredEshel: false },
      ...(expiredLabels.length
        ? [{ endDateLabel: { in: expiredLabels } }]
        : []),
    ],
  };
}

/** Single-student check for display (student card, exports). */
export function isEshelActive(
  registeredEshel: boolean,
  endDateLabel: string | null | undefined,
  expiredLabels: string[]
): boolean {
  if (!registeredEshel) return false;
  if (endDateLabel && expiredLabels.includes(endDateLabel)) return false;
  return true;
}
