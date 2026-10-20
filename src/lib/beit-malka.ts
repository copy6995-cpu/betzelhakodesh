/**
 * בית מלכה beds-payment ledger, per Shabbat. Each row is either "מיטות"
 * (₪22/bed + a ₪250 surcharge per 100-bed block) or "אחר" (a flat sum). `paid`
 * is the cash actually paid against the row; the page tracks to-pay/paid/remaining.
 * The pricing formula lives in ./beit-malka-pricing (pure, shared with the client).
 */
import { prisma } from "./prisma";

export { PER_BED, rowAmount, bedsAmount } from "./beit-malka-pricing";

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
