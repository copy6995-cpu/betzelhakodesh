/**
 * Find bachurim who registered through BOTH channels in the same year:
 *   - a Nedarim Plus form submission (Kod_1 + TransactionId), AND
 *   - an approved Yemot HaMashiach credit-card slika (personalCode + approval).
 *
 * The two channels are meant to be mutually exclusive (a bachur uses one OR
 * the other). When someone slips into both, Nedarim ends up holding TWO
 * standing orders for him — so he gets charged twice. This report surfaces
 * those overlaps and grades each by how dangerous it already is, based on how
 * many real transactions landed on each hook.
 *
 * Severity:
 *   - "active"     — both hooks already have transactions → money taken twice
 *   - "pending"    — two hooks exist but ≤1 has charged yet → will double-charge
 *   - "borderline" — the form carried no hook (incomplete) → effectively one
 *                    channel; listed for visibility, not urgent
 */
import { prisma } from "./prisma";

export type DupSeverity = "active" | "pending" | "borderline";

export interface DuplicateRegistration {
  year: string;
  personalCode: string;
  studentId: string | null;
  studentName: string | null;
  price: number | null;
  /** Which hook the student row currently points at (for the office to know
   *  which standing order the app is tracking). */
  currentHook: string | null;
  formHook: string; // "" when the form had no TransactionId
  formTxCount: number;
  formTxSum: number;
  cardApprovals: string[];
  cardTxCount: number;
  cardTxSum: number;
  severity: DupSeverity;
}

/** Nedarim forms store the year in Snif1 with Unicode geresh/gershayim; the
 *  rest of the app uses ASCII quotes. Normalize so keys line up. */
function normYear(raw: unknown): string {
  return String(raw ?? "")
    .replace(/׳/g, "'")
    .replace(/״/g, '"')
    .trim();
}

export async function findDuplicateRegistrations(): Promise<
  DuplicateRegistration[]
> {
  const [forms, cards] = await Promise.all([
    prisma.nedarimFormSubmission.findMany({ select: { raw: true } }),
    prisma.yemotCreditCard.findMany({
      where: { status: "מאושר" },
      select: { personalCode: true, year: true, approvalNum: true, amount: true },
    }),
  ]);

  // (year|code) → form hook. Prefer a submission that actually carries a hook
  // over one that doesn't, so an incomplete duplicate submission can't mask a
  // real standing order.
  const formByKey = new Map<string, string>();
  for (const f of forms) {
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(f.raw);
    } catch {
      continue;
    }
    const code = String(o.Kod_1 ?? "").trim();
    const year = normYear(o.Snif1);
    if (!code || !year) continue;
    const hook = String(o.TransactionId ?? "").trim();
    const key = `${year}|${code}`;
    const existing = formByKey.get(key);
    if (existing === undefined || (!existing && hook)) {
      formByKey.set(key, hook);
    }
  }

  // (year|code) → approved card approvals.
  const cardByKey = new Map<string, string[]>();
  for (const c of cards) {
    const code = (c.personalCode ?? "").trim();
    const year = normYear(c.year);
    const approval = (c.approvalNum ?? "").trim();
    if (!code || !year || !approval) continue;
    const key = `${year}|${code}`;
    const arr = cardByKey.get(key) ?? [];
    arr.push(approval);
    cardByKey.set(key, arr);
  }

  // Intersect.
  const overlapKeys: string[] = [];
  for (const key of formByKey.keys()) {
    if (cardByKey.has(key)) overlapKeys.push(key);
  }
  if (overlapKeys.length === 0) return [];

  // Batch-load transaction sums for every hook involved (form hooks + card
  // approvals) in one groupBy, then look them up per row.
  const allHooks = new Set<string>();
  for (const key of overlapKeys) {
    const fh = formByKey.get(key);
    if (fh) allHooks.add(fh);
    for (const a of cardByKey.get(key) ?? []) allHooks.add(a);
  }
  const txAgg = await prisma.nedarimTransaction.groupBy({
    by: ["kevaId"],
    where: { kevaId: { in: [...allHooks] } },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const txByHook = new Map<string, { count: number; sum: number }>();
  for (const t of txAgg) {
    if (!t.kevaId) continue;
    txByHook.set(t.kevaId, {
      count: t._count._all,
      sum: Number(t._sum.amount ?? 0),
    });
  }

  // Resolve student rows for names/price/current hook.
  const codes = [...new Set(overlapKeys.map((k) => k.split("|")[1]))];
  const students = await prisma.student.findMany({
    where: { personalCode: { in: codes } },
    select: {
      id: true,
      year: true,
      personalCode: true,
      firstName: true,
      lastName: true,
      price: true,
      nedarimHook: true,
    },
  });
  const studentByKey = new Map(
    students.map((s) => [`${s.year}|${s.personalCode}`, s])
  );

  const rows: DuplicateRegistration[] = overlapKeys.map((key) => {
    const [year, personalCode] = [
      key.slice(0, key.indexOf("|")),
      key.slice(key.indexOf("|") + 1),
    ];
    const formHook = formByKey.get(key) ?? "";
    const cardApprovals = [...new Set(cardByKey.get(key) ?? [])];
    const st = studentByKey.get(key);

    const formTx = formHook ? txByHook.get(formHook) : undefined;
    const formTxCount = formTx?.count ?? 0;
    const formTxSum = formTx?.sum ?? 0;

    let cardTxCount = 0;
    let cardTxSum = 0;
    for (const a of cardApprovals) {
      const t = txByHook.get(a);
      if (t) {
        cardTxCount += t.count;
        cardTxSum += t.sum;
      }
    }

    let severity: DupSeverity;
    if (!formHook) severity = "borderline";
    else if (formTxCount > 0 && cardTxCount > 0) severity = "active";
    else severity = "pending";

    return {
      year,
      personalCode,
      studentId: st?.id ?? null,
      studentName: st ? `${st.lastName} ${st.firstName}` : null,
      price: st?.price ?? null,
      currentHook: st?.nedarimHook ?? null,
      formHook,
      formTxCount,
      formTxSum,
      cardApprovals,
      cardTxCount,
      cardTxSum,
      severity,
    };
  });

  // Most dangerous first: active → pending → borderline, then by year desc.
  const rank: Record<DupSeverity, number> = {
    active: 0,
    pending: 1,
    borderline: 2,
  };
  rows.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || (a.year < b.year ? 1 : -1)
  );
  return rows;
}
