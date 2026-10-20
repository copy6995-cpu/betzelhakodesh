/**
 * בית מלכה bed pricing — pure (no prisma), so both the server (beit-malka.ts /
 * actions) and the client grid share ONE formula.
 *
 * A "מיטות" row costs ₪22 per bed, plus a tiered surcharge of ₪250 for every
 * block of 100 beds (1–100 → +250, 101–200 → +500, 201–300 → +750, …):
 *   amount = 22 × beds + 250 × ceil(beds / 100)
 * e.g. 153 beds → 3,366 + 500 = ₪3,866 ; 201 beds → 4,422 + 750 = ₪5,172.
 */
export const PER_BED = 22;
export const SURCHARGE_PER_BLOCK = 250;
export const BLOCK_SIZE = 100;

/** Total obligation for a given bed count (base + tiered surcharge). */
export function bedsAmount(beds: number): number {
  const b = Math.max(0, Math.floor(beds || 0));
  if (b === 0) return 0;
  return b * PER_BED + Math.ceil(b / BLOCK_SIZE) * SURCHARGE_PER_BLOCK;
}

/** The obligation for a row: the bed formula for a מיטות row, else the flat sum. */
export function rowAmount(kind: string, beds: number, flat: number): number {
  if (kind === "מיטות") return bedsAmount(beds);
  return Math.max(0, flat || 0);
}
