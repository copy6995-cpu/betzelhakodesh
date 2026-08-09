/**
 * בית מלכה payment: ₪22 per bed + a tiered bonus of ₪250 for every started
 * 100 beds (1–100 → 250, 101–200 → 500, 201–300 → 750, …). Pure/client-safe.
 */
export function beitMalkaAmount(beds: number): number {
  const b = Math.max(0, Math.floor(beds || 0));
  if (b === 0) return 0;
  return b * 22 + Math.ceil(b / 100) * 250;
}
