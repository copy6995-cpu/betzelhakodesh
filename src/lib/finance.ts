/**
 * Cash-book (הכנסות והוצאות) for a school year. Auto figures: Nedarim income
 * (Payment rows), bed-fee credit from the groups report (סכום לתשלום), and the
 * supervisor pay owed, from the calendar cells × the supervisor price table.
 * Hand-entered rows (other income, misc/בית מלכה/supervisor payments) live in
 * the FinanceEntry table.
 */
import { prisma } from "./prisma";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";
import { loadRepsTotal } from "./reps";

export type FinanceEntryRow = {
  id: string;
  kind: string; // "income" | "expense"
  category: string;
  label: string | null;
  amount: number;
  date: string | null; // yyyy-mm-dd
  meta: Record<string, unknown> | null;
};

function parseMeta(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Supervisor pay owed this year = every calendar לינה/קימה cell's level mapped
 *  to ₪ via the price table, summed (mirrors the calendar's live summary). */
export async function loadSupervisorCost(year: string): Promise<{
  total: number;
  perSupervisor: { name: string; cost: number }[];
}> {
  const [config, priceRow, weeks] = await Promise.all([
    prisma.calendarConfig.findUnique({ where: { yearLabel: year } }),
    prisma.appSetting.findUnique({
      where: { key: "calendar_supervisor_prices" },
    }),
    prisma.calendarWeek.findMany({
      where: { yearLabel: year },
      select: { values: true },
    }),
  ]);

  let names: string[] = [];
  try {
    const a = JSON.parse(config?.supervisorNames ?? "[]");
    if (Array.isArray(a)) names = a;
  } catch {
    /* ignore */
  }
  let prices: { lina?: Record<string, number>; kima?: Record<string, number> } =
    {};
  try {
    prices = JSON.parse(priceRow?.value ?? "{}");
  } catch {
    /* ignore */
  }

  const SUP = 9;
  const per = Array.from({ length: SUP }, () => 0);
  let total = 0;
  for (const w of weeks) {
    let v: { sup?: { lina?: string; kima?: string }[] } = {};
    try {
      v = JSON.parse(w.values || "{}");
    } catch {
      continue;
    }
    const sup = v.sup ?? [];
    for (let i = 0; i < SUP; i++) {
      const l = String(sup[i]?.lina ?? "").trim();
      const k = String(sup[i]?.kima ?? "").trim();
      const lp = l ? prices.lina?.[l] : undefined;
      const kp = k ? prices.kima?.[k] : undefined;
      if (typeof lp === "number") {
        per[i] += lp;
        total += lp;
      }
      if (typeof kp === "number") {
        per[i] += kp;
        total += kp;
      }
    }
  }
  const perSupervisor = per
    .map((cost, i) => ({
      name: (names[i] ?? "").trim() || `משגיח ${i + 1}`,
      cost,
    }))
    .filter((s, i) => s.cost > 0 || (names[i] ?? "").trim());
  return { total, perSupervisor };
}

/** Total bed-fee credit (σכum לתשלup) across live approved bookings. */
export async function loadGroupsCredit(): Promise<number> {
  const [rows, cancellations] = await Promise.all([
    prisma.yemotBedReservation.findMany({
      where: { status: "מאושר" },
      select: { personalCode: true, weekKey: true, source: true, raw: true },
    }),
    loadCancellations(),
  ]);
  let total = 0;
  for (const r of rows) {
    if (!isLiveBooking(r, cancellations)) continue;
    try {
      const pay = Number(JSON.parse(r.raw)["סכום לתשלום"]);
      if (Number.isFinite(pay)) total += pay;
    } catch {
      /* ignore */
    }
  }
  return total;
}

export type FinanceData = {
  year: string;
  income: {
    nedarim: number;
    groupsCredit: number;
    manual: FinanceEntryRow[];
    manualTotal: number;
    total: number;
  };
  expense: {
    supervisorTarget: number;
    perSupervisor: { name: string; cost: number }[];
    supervisorPaid: number;
    repsPaid: number; // paid to yeshiva representatives (monthly grid)
    byCategory: Record<string, FinanceEntryRow[]>;
    total: number; // actual cash out (all expense rows + reps)
  };
  net: number;
};

export async function loadFinance(year: string): Promise<FinanceData> {
  const [nedarimAgg, groupsCredit, supervisor, entries, repsPaid] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { method: "נדרים פלוס", student: { year } },
      }),
      loadGroupsCredit(),
      loadSupervisorCost(year),
      prisma.financeEntry.findMany({
        where: { year },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      loadRepsTotal(year, ["yeshiva"]),
    ]);

  const rows: FinanceEntryRow[] = entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    category: e.category,
    label: e.label,
    amount: e.amount,
    date: e.date ? e.date.toISOString().slice(0, 10) : null,
    meta: parseMeta(e.meta),
  }));

  const manualIncome = rows.filter((r) => r.kind === "income");
  const expenseRows = rows.filter((r) => r.kind === "expense");
  const manualTotal = manualIncome.reduce((a, r) => a + r.amount, 0);
  const nedarim = Number(nedarimAgg._sum.amount ?? 0);
  const totalIncome = nedarim + groupsCredit + manualTotal;

  const byCategory: Record<string, FinanceEntryRow[]> = {};
  for (const r of expenseRows) (byCategory[r.category] ??= []).push(r);
  const supervisorPaid = (byCategory["supervisor-payment"] ?? []).reduce(
    (a, r) => a + r.amount,
    0
  );
  const totalExpense = expenseRows.reduce((a, r) => a + r.amount, 0) + repsPaid;

  return {
    year,
    income: {
      nedarim,
      groupsCredit,
      manual: manualIncome,
      manualTotal,
      total: totalIncome,
    },
    expense: {
      supervisorTarget: supervisor.total,
      perSupervisor: supervisor.perSupervisor,
      supervisorPaid,
      repsPaid,
      byCategory,
      total: totalExpense,
    },
    net: totalIncome - totalExpense,
  };
}
