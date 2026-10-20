import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { SyncPaymentsButton } from "./sync-payments-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = { page?: string };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const year = await getActiveYear();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [payments, total, agg, matrixRows, studentsForBalance] = await Promise.all([
    prisma.payment.findMany({
      where: { student: { year, archived: false } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.payment.count({ where: { student: { year, archived: false } } }),
    prisma.payment.aggregate({
      where: { student: { year, archived: false } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { student: { year, archived: false } },
      select: {
        amount: true,
        method: true,
        studentId: true,
        student: { select: { yeshiva: true } },
      },
    }),
    prisma.student.findMany({
      where: { year, archived: false },
      select: { id: true, yeshiva: true, price: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalAmt = Number(agg._sum.amount ?? 0);
  const share = (v: number) =>
    totalAmt > 0 ? `${((v / totalAmt) * 100).toFixed(1)}%` : "—";

  // Per-yeshiva × payment-method money matrix (summary table at the top).
  const methodName = (m: string | null) => (m && m.trim()) || "ללא סיווג";
  const cell = new Map<string, Map<string, number>>();
  const methodTotals = new Map<string, number>();
  const yeshivaTotals = new Map<string, number>();
  for (const p of matrixRows) {
    const y = p.student.yeshiva?.trim() || "ללא ישיבה";
    const m = methodName(p.method);
    const amt = Number(p.amount);
    if (!cell.has(y)) cell.set(y, new Map());
    const row = cell.get(y)!;
    row.set(m, (row.get(m) ?? 0) + amt);
    methodTotals.set(m, (methodTotals.get(m) ?? 0) + amt);
    yeshivaTotals.set(y, (yeshivaTotals.get(y) ?? 0) + amt);
  }
  const methods = [...methodTotals.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const yeshivot = [...yeshivaTotals.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);

  // Paid-vs-remaining for the pies — CURRENT YEAR only (price vs payments; debts
  // are a separate page). Remaining is summed per student so overpayers don't
  // mask others' debt. Collected = price − remaining (never more than price).
  const paidByStudent = new Map<string, number>();
  for (const p of matrixRows) {
    paidByStudent.set(
      p.studentId,
      (paidByStudent.get(p.studentId) ?? 0) + Number(p.amount)
    );
  }
  type PR = { expected: number; collected: number; remaining: number };
  const prByYeshiva = new Map<string, PR>();
  const prTotal: PR = { expected: 0, collected: 0, remaining: 0 };
  for (const s of studentsForBalance) {
    const price = s.price ?? 0;
    if (price <= 0) continue; // no obligation set → not part of the paid/remaining split
    const paid = paidByStudent.get(s.id) ?? 0;
    const remaining = Math.max(0, price - paid);
    const collected = price - remaining;
    const yv = s.yeshiva?.trim() || "ללא ישיבה";
    const acc = prByYeshiva.get(yv) ?? { expected: 0, collected: 0, remaining: 0 };
    acc.expected += price;
    acc.collected += collected;
    acc.remaining += remaining;
    prByYeshiva.set(yv, acc);
    prTotal.expected += price;
    prTotal.collected += collected;
    prTotal.remaining += remaining;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">תשלומים</h1>
          <p className="text-[var(--color-muted-foreground)] mt-1">
            {formatNum(total)} תשלומים בשנת {year} · סה״כ {formatILS(totalAmt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payments/prior-years"
            className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
          >
            גביית שנים קודמות
          </Link>
          <SyncPaymentsButton />
        </div>
      </div>

      {prTotal.expected > 0 && (
        <div className="bg-white rounded-xl card-shadow mb-6 p-5">
          <div className="text-sm font-semibold text-[var(--color-primary)] mb-4">
            שולם מול נשאר לתשלום — שנת {year}
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex items-center gap-4 lg:border-e lg:pe-6 border-[var(--color-border)]">
              <Pie collected={prTotal.collected} remaining={prTotal.remaining} size={128} />
              <div className="text-sm space-y-1.5">
                <LegendRow color={PAID_C} label="סה״כ שולם" amount={prTotal.collected} total={prTotal.expected} />
                <LegendRow color={REM_C} label="נשאר לתשלום" amount={prTotal.remaining} total={prTotal.expected} />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
              {yeshivot.map((y) => {
                const pr = prByYeshiva.get(y);
                if (!pr || pr.expected <= 0) return null;
                return (
                  <div key={y} className="flex flex-col items-center text-center">
                    <div className="text-xs font-medium mb-1 truncate max-w-[130px]">{y}</div>
                    <Pie collected={pr.collected} remaining={pr.remaining} size={76} />
                    <div className="text-[11px] text-[var(--color-muted-foreground)] mt-1 leading-tight">
                      נשאר{" "}
                      <span className="text-red-600 font-semibold">
                        {formatILS(pr.remaining)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {yeshivot.length > 0 && (
        <div className="bg-white rounded-xl card-shadow mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-semibold text-[var(--color-primary)]">
              כמה נכנס לכל ישיבה — לפי אמצעי תשלום
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] bg-[var(--color-muted)]">
                  <th className="sticky start-0 z-10 bg-[var(--color-muted)] py-3 pe-5 ps-5 text-right font-semibold">
                    ישיבה
                  </th>
                  {methods.map((m) => (
                    <th key={m} className="py-3 px-4 text-left font-semibold whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">סה״כ</th>
                  <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">אחוז</th>
                </tr>
              </thead>
              <tbody>
                {yeshivot.map((y) => (
                  <tr key={y} className="border-t border-[var(--color-border)]/60">
                    <th className="sticky start-0 z-10 bg-white py-2.5 pe-5 ps-5 text-right font-medium whitespace-nowrap">
                      {y}
                    </th>
                    {methods.map((m) => {
                      const v = cell.get(y)?.get(m) ?? 0;
                      return (
                        <td
                          key={m}
                          className={`py-2.5 px-4 text-left tabular-nums ${
                            v ? "" : "text-[var(--color-muted-foreground)]/40"
                          }`}
                        >
                          {v ? formatILS(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-left font-semibold text-[var(--color-success)] tabular-nums whitespace-nowrap">
                      {formatILS(yeshivaTotals.get(y) ?? 0)}
                    </td>
                    <td className="py-2.5 px-4 text-left tabular-nums text-[var(--color-muted-foreground)] whitespace-nowrap">
                      {share(yeshivaTotals.get(y) ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                  <th className="sticky start-0 z-10 bg-[var(--color-muted)]/50 py-3 pe-5 ps-5 text-right whitespace-nowrap">
                    סה״כ
                  </th>
                  {methods.map((m) => (
                    <td key={m} className="py-3 px-4 text-left tabular-nums whitespace-nowrap">
                      {formatILS(methodTotals.get(m) ?? 0)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-left text-[var(--color-success)] tabular-nums whitespace-nowrap">
                    {formatILS(totalAmt)}
                  </td>
                  <td className="py-3 px-4 text-left tabular-nums whitespace-nowrap">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl card-shadow">
        <div className="px-5 py-3 border-b border-[var(--color-border)] rounded-t-xl">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {formatNum(total)} תשלומים · סה״כ {formatILS(totalAmt)}
          </div>
        </div>
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="sticky top-16 z-20 py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">תאריך</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">בחור</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">מס׳</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">סכום</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">אמצעי</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">אסמכתא</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)]/60">
                  <td className="py-2.5 pe-5 ps-5 text-[var(--color-muted-foreground)]">
                    {(p.date ?? p.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="py-2.5 px-4">
                    <Link
                      href={`/bachurim/${p.student.id}`}
                      className="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium"
                    >
                      {p.student.lastName} {p.student.firstName}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4">
                    {p.paymentNumber === 0 ? "נדרים" : `#${p.paymentNumber}`}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                    {formatILS(Number(p.amount))}
                  </td>
                  <td className="py-2.5 px-4">{p.method ?? "—"}</td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                    {p.externalRef ?? "—"}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[var(--color-muted-foreground)]">
                    אין תשלומים עדיין.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={sp as Record<string, string>}
        basePath="/payments"
      />
    </div>
  );
}

// --- Paid/remaining pie (inline SVG, no chart library) ---
const PAID_C = "#3b6fb0"; // blue — collected
const REM_C = "#e8843a"; // orange — remaining

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a0 = 2 * Math.PI * from - Math.PI / 2;
  const a1 = 2 * Math.PI * to - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function Pie({
  collected,
  remaining,
  size = 100,
}: {
  collected: number;
  remaining: number;
  size?: number;
}) {
  const total = collected + remaining;
  const f = total > 0 ? collected / total : 0;
  const r = size / 2;
  const pct = (f * 100).toFixed(1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={r} cy={r} r={r} fill={REM_C} />
      {f >= 1 ? (
        <circle cx={r} cy={r} r={r} fill={PAID_C} />
      ) : (
        f > 0 && <path d={arc(r, r, r, 0, f)} fill={PAID_C} />
      )}
      <text
        x={r}
        y={r}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={size * 0.2}
        fontWeight="700"
      >
        {pct}%
      </text>
    </svg>
  );
}

function LegendRow({
  color,
  label,
  amount,
  total,
}: {
  color: string;
  label: string;
  amount: number;
  total: number;
}) {
  const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : "0";
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className="inline-block w-3 h-3 rounded-sm shrink-0"
        style={{ background: color }}
      />
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="font-semibold tabular-nums">{formatILS(amount)}</span>
      <span className="text-xs text-[var(--color-muted-foreground)]">({pct}%)</span>
    </div>
  );
}
