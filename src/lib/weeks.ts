/**
 * Utilities for the Sunday-based week keys used by RoomAllocation.
 * A weekKey is the Sunday date in ISO format, e.g. "2026-07-13".
 *
 * All parsing uses local time — a week is a human concept, not a UTC one.
 */

/** Return the Sunday of the week containing `d` (local time). */
export function sundayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // getDay(): 0 = Sunday
  return x;
}

/** Format a Date as "YYYY-MM-DD" (local time). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Convert any date into its weekKey. */
export function weekKeyOf(d: Date): string {
  return isoDate(sundayOf(d));
}

/** Current weekKey (right now, in local time). */
export function currentWeekKey(): string {
  return weekKeyOf(new Date());
}

/** Parse "YYYY-MM-DD" as a local-time Date at midnight. Null on failure. */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10)
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Add `days` to a Date without mutating the original. */
export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Return the previous week's weekKey (Sunday - 7 days). */
export function previousWeekKey(weekKey: string): string | null {
  const d = parseISODate(weekKey);
  if (!d) return null;
  return isoDate(addDays(d, -7));
}

/** "13/07 - 19/07 (יום ראשון)" — a friendly label showing the week span. */
export function weekLabel(weekKey: string): string {
  const start = parseISODate(weekKey);
  if (!start) return weekKey;
  const end = addDays(start, 6);
  const fmt = (x: Date) =>
    `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)} · ${start.getFullYear()}`;
}
