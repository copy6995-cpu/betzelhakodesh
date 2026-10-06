/**
 * Shared ordering for the per-yeshiva exports: first חו״ל then אר״י, within
 * each by shiur (א, ב, ג…), then alphabetically by last then first name.
 */
const SHIUR_ORDER = "אבגדהוזחט";

export function shiurRank(shiur: string | null | undefined): number {
  const first = (shiur ?? "").trim()[0] ?? "";
  const i = SHIUR_ORDER.indexOf(first);
  return i >= 0 ? i : 99;
}

export function ariChulRank(v: string | null | undefined): number {
  const s = (v ?? "").trim();
  if (s === "חול") return 0;
  if (s === "ארי") return 1;
  return 2;
}

/** Compare two roster-ish records by חו״ל/אר״י → shiur → last → first name. */
export function compareRoster(
  a: { ariChul?: string | null; shiur?: string | null; lastName: string; firstName: string },
  b: { ariChul?: string | null; shiur?: string | null; lastName: string; firstName: string }
): number {
  return (
    ariChulRank(a.ariChul) - ariChulRank(b.ariChul) ||
    shiurRank(a.shiur) - shiurRank(b.shiur) ||
    a.lastName.localeCompare(b.lastName, "he") ||
    a.firstName.localeCompare(b.firstName, "he")
  );
}
