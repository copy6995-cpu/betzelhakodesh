/**
 * Normalize a Hebrew name for equality comparison across imports and dedup.
 *
 * The raw field from the xlsx (or from a manually-entered form) often has
 * variations that shouldn't produce duplicate Parent rows:
 *   "שלמה"  vs  "שלמה "       (trailing whitespace)
 *   "שלום'" vs "שלום"         (gershayim/apostrophe for abbreviation)
 *   "מאיר אריה" vs "מאיר-אריה" (dash joiner)
 *
 * We only use the normalized form for matching — the original form is stored
 * on the Parent row for display, so nothing about the normalization is
 * visible to the user.
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFC")
    .trim()
    .replace(/[\u0027\u05F3\u2019"\u05F4]/g, "") // apostrophe, geresh, right single quote, gershayim
    .replace(/[-\u05BE\u2013\u2014]/g, " ") // hyphen, Hebrew maqaf, en/em dash
    .replace(/\s+/g, " "); // collapse any run of whitespace
}
