/**
 * בית מלכה beds-payment ledger, per Shabbat. Each row is either "מיטות"
 * (amount = beds × 22) or "אחר" (a flat sum). `paid` is the cash actually
 * paid against the row; the page tracks total-to-pay / paid / remaining.
 */
import { prisma } from "./prisma";

export const PER_BED = 22;

/** The obligation for a row: beds × 22 for a מיטות row, else the flat sum. */
export function rowAmount(kind: string, beds: number, flat: number): number {
  if (kind === "מיטות") return Math.max(0, Math.floor(beds || 0)) * PER_BED;
  return Math.max(0, flat || 0);
}

export type BeitMalkaRowT = {
  id: string;
  reason: string;
  kind: string; // "מיטות" | "אחר"
  beds: number;
  amount: number;
  paid: number;
  method: string | null;
  date: string | null; // yyyy-mm-dd
};

export type BeitMalkaData = {
  rows: BeitMalkaRowT[];
  toPay: number;
  paid: number;
  remaining: number;
};

export async function loadBeitMalka(year: string): Promise<BeitMalkaData> {
  const rows = await prisma.beitMalkaRow.findMany({
    where: { year },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const mapped: BeitMalkaRowT[] = rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    kind: r.kind,
    beds: r.beds,
    amount: r.amount,
    paid: r.paid,
    method: r.method,
    date: r.date ? r.date.toISOString().slice(0, 10) : null,
  }));
  const toPay = mapped.reduce((a, r) => a + r.amount, 0);
  const paid = mapped.reduce((a, r) => a + r.paid, 0);
  return { rows: mapped, toPay, paid, remaining: toPay - paid };
}

/** Cash actually paid out for בית מלכה this year (feeds finance expenses). */
export async function loadBeitMalkaPaid(year: string): Promise<number> {
  const rows = await prisma.beitMalkaRow.findMany({
    where: { year },
    select: { paid: true },
  });
  return rows.reduce((a, r) => a + r.paid, 0);
}
