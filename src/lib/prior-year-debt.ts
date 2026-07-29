/**
 * "גביית שנים קודמות" — how much of the money arriving now is settling
 * PRIOR-year obligations, plus what prior-year debt is still open.
 *
 * The data model keeps each year on its own Student row with its own price
 * and payments; prior-year debt payments land on the prior-year row (verified:
 * no current-year overpayments). So:
 *   - outstanding debt  = Σ(price − paid) over prior-year rows, balance > 0
 *   - collected recently = Σ(payments on prior-year rows dated ≥ `since`)
 * The overpaid list catches the edge case where someone pays old debt through
 * the CURRENT year's hook (would otherwise be invisible).
 *
 * Year ordering: Hebrew school-year strings in this app's range (תשפ"ד…תשפ"ז)
 * sort lexicographically in chronological order, so `year < activeYear`
 * correctly means "an earlier year".
 */
import { prisma } from "./prisma";

export type PriorYearSummary = {
  year: string;
  studentsWithDebt: number;
  outstandingTotal: number;
  collectedSince: number;
};

export type PriorDebtStudent = {
  studentId: string;
  code: string;
  name: string;
  year: string;
  price: number;
  paid: number;
  balance: number;
  collectedSince: number;
};

export type OverpaidStudent = {
  studentId: string;
  code: string;
  name: string;
  price: number;
  paid: number;
  over: number;
};

export type PriorYearDebtReport = {
  priorYears: string[];
  summaries: PriorYearSummary[];
  students: PriorDebtStudent[];
  overpaid: OverpaidStudent[];
  totals: { outstanding: number; collectedSince: number; studentsWithDebt: number };
};

export async function loadPriorYearDebt(opts: {
  activeYear: string;
  since: Date;
}): Promise<PriorYearDebtReport> {
  const { activeYear, since } = opts;
  const sinceMs = since.getTime();

  const distinctYears = await prisma.student.findMany({
    select: { year: true },
    distinct: ["year"],
  });
  const priorYears = distinctYears
    .map((s) => s.year)
    .filter((y) => y < activeYear)
    .sort()
    .reverse();

  if (priorYears.length === 0) {
    return {
      priorYears: [],
      summaries: [],
      students: [],
      overpaid: [],
      totals: { outstanding: 0, collectedSince: 0, studentsWithDebt: 0 },
    };
  }

  const priorStudents = await prisma.student.findMany({
    where: { year: { in: priorYears }, archived: false },
    select: {
      id: true,
      year: true,
      personalCode: true,
      firstName: true,
      lastName: true,
      price: true,
      payments: { select: { amount: true, date: true } },
    },
  });

  const perYear = new Map<
    string,
    { studentsWithDebt: number; outstandingTotal: number; collectedSince: number }
  >();
  const students: PriorDebtStudent[] = [];

  for (const s of priorStudents) {
    const price = s.price ?? 0;
    let paid = 0;
    let collectedSince = 0;
    for (const p of s.payments) {
      const amt = Number(p.amount);
      paid += amt;
      if (p.date && p.date.getTime() >= sinceMs) collectedSince += amt;
    }
    const balance = price - paid;

    const ys =
      perYear.get(s.year) ?? {
        studentsWithDebt: 0,
        outstandingTotal: 0,
        collectedSince: 0,
      };
    if (balance > 1) {
      ys.studentsWithDebt++;
      ys.outstandingTotal += balance;
    }
    ys.collectedSince += collectedSince;
    perYear.set(s.year, ys);

    if (balance > 1 || collectedSince > 0) {
      students.push({
        studentId: s.id,
        code: s.personalCode,
        name: `${s.lastName} ${s.firstName}`.trim(),
        year: s.year,
        price,
        paid,
        balance,
        collectedSince,
      });
    }
  }

  // Most operationally relevant first: recent collection, then open balance.
  students.sort(
    (a, b) => b.collectedSince - a.collectedSince || b.balance - a.balance
  );

  // Overpaid current-year rows — old debt paid through the new-year hook.
  const activeStudents = await prisma.student.findMany({
    where: { year: activeYear, archived: false },
    select: {
      id: true,
      personalCode: true,
      firstName: true,
      lastName: true,
      price: true,
      payments: { select: { amount: true } },
    },
  });
  const overpaid: OverpaidStudent[] = [];
  for (const s of activeStudents) {
    const price = s.price ?? 0;
    if (price <= 0) continue;
    const paid = s.payments.reduce((a, p) => a + Number(p.amount), 0);
    const over = paid - price;
    if (over > 1) {
      overpaid.push({
        studentId: s.id,
        code: s.personalCode,
        name: `${s.lastName} ${s.firstName}`.trim(),
        price,
        paid,
        over,
      });
    }
  }
  overpaid.sort((a, b) => b.over - a.over);

  const summaries: PriorYearSummary[] = priorYears
    .map((year) => {
      const ys = perYear.get(year) ?? {
        studentsWithDebt: 0,
        outstandingTotal: 0,
        collectedSince: 0,
      };
      return { year, ...ys };
    })
    .filter((s) => s.studentsWithDebt > 0 || s.collectedSince > 0);

  const totals = {
    outstanding: summaries.reduce((a, s) => a + s.outstandingTotal, 0),
    collectedSince: summaries.reduce((a, s) => a + s.collectedSince, 0),
    studentsWithDebt: summaries.reduce((a, s) => a + s.studentsWithDebt, 0),
  };

  return { priorYears, summaries, students, overpaid, totals };
}
