import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; page?: string };

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const year = await getActiveYear();
  const q = sp.q?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    students: { some: { year } },
    ...(q
      ? {
          OR: [
            { firstName: { contains: q} },
            { lastName: { contains: q} },
            { phone: { contains: q } },
            { tz: { contains: q } },
            { email: { contains: q} },
          ],
        }
      : {}),
  };

  const [parents, total] = await Promise.all([
    prisma.parent.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        students: {
          where: { year, archived: false },
          select: { id: true, price: true, payments: { select: { amount: true } } },
        },
      },
    }),
    prisma.parent.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">הורים</h1>
          <p className="text-[var(--color-muted-foreground)] mt-1">
            {formatNum(total)} הורים {q && `התואמים "${q}"`}
          </p>
        </div>
        <a
          href="/api/parents/export"
          className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors"
        >
          ↓ יצוא חייבים (יתרה מעל ₪1)
        </a>
      </div>

      <div className="mb-6">
        <SearchBox placeholder="שם, טלפון, ת.ז., אימייל..." />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="px-5 py-3 border-b border-[var(--color-border)] rounded-t-xl">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {formatNum(total)} הורים
          </div>
        </div>
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="sticky top-16 z-20 py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">שם הורה</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">טלפון</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">ת.ז.</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold text-center bg-[var(--color-muted)]">ילדים</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">סה״כ מחיר</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">שולם</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">יתרה</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => {
                const price = p.students.reduce((a, s) => a + (s.price ?? 0), 0);
                const paid = p.students.reduce(
                  (a, s) => a + s.payments.reduce((b, x) => b + Number(x.amount), 0),
                  0
                );
                const remaining = price - paid;
                return (
                  <tr key={p.id} className="border-t border-[var(--color-border)]/60">
                    <td className="py-2.5 pe-5 ps-5">
                      <Link
                        href={`/parents/${p.id}`}
                        className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                      >
                        {p.lastName} {p.firstName}
                      </Link>
                    </td>
                    <td
                      className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs"
                      dir="ltr"
                    >
                      {p.phone ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                      {p.tz ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {formatNum(p.students.length)}
                    </td>
                    <td className="py-2.5 px-4">{formatILS(price)}</td>
                    <td className="py-2.5 px-4 text-[var(--color-success)]">
                      {formatILS(paid)}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-semibold ${
                        remaining > 0
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-success)]"
                      }`}
                    >
                      {formatILS(remaining)}
                    </td>
                  </tr>
                );
              })}
              {parents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[var(--color-muted-foreground)]">
                    לא נמצאו הורים.
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
        basePath="/parents"
      />
    </div>
  );
}
