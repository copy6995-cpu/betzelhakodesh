import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";
import { Pagination } from "@/components/pagination";

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

  const [payments, total, agg] = await Promise.all([
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
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalAmt = Number(agg._sum.amount ?? 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">תשלומים</h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          {formatNum(total)} תשלומים בשנת {year} · סה״כ {formatILS(totalAmt)}
        </p>
      </div>

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
