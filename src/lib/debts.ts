/**
 * Debt settlement — a bachur's incoming payments settle his prior-year debts
 * oldest-year-first (תשפ"ד → תשפ"ה → תשפ"ו → …) and only then the current-year
 * price. Hebrew school-year strings in this app's range sort lexicographically
 * in chronological order, so a plain string compare = oldest first.
 */

export type DebtInput = {
  id?: string;
  year: string;
  amount: number;
  note?: string | null;
};

export type SettledDebt = DebtInput & {
  paid: number; // amount of payments applied to this debt
  remaining: number; // amount still open
};

export type Settlement = {
  debts: SettledDebt[]; // in oldest-first order
  totalDebts: number;
  debtsRemaining: number; // Σ open debt
  annualRemaining: number; // this year's price still unpaid (after debts)
  balance: number; // price + debts − paid (can be negative if overpaid)
};

/** Apply `paid` across the debts (oldest first) then the annual `price`. */
export function settleDebts(
  debts: DebtInput[],
  price: number,
  paid: number
): Settlement {
  const sorted = [...debts].sort((a, b) => (a.year < b.year ? -1 : a.year > b.year ? 1 : 0));
  let remain = Math.max(0, paid);
  const settled: SettledDebt[] = sorted.map((d) => {
    const amt = Math.max(0, d.amount || 0);
    const pay = Math.min(remain, amt);
    remain -= pay;
    return { ...d, amount: amt, paid: pay, remaining: amt - pay };
  });
  const totalDebts = settled.reduce((a, d) => a + d.amount, 0);
  const debtsRemaining = settled.reduce((a, d) => a + d.remaining, 0);
  // Whatever payment is left after debts goes to the annual price.
  const annualRemaining = Math.max(0, (price || 0) - remain);
  const balance = (price || 0) + totalDebts - Math.max(0, paid);
  return { debts: settled, totalDebts, debtsRemaining, annualRemaining, balance };
}
