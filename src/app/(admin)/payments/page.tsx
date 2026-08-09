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

  const [payments, total, agg, matrixRows] = await Promise.all([
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
      select: { amount: true, method: true, student: { select: { yeshiva: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalAmt = Number(agg._sum.amount ?? 0);

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
