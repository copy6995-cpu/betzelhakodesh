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
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { tz: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">הורים</h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          {formatNum(total)} הורים {q && `התואמים "${q}"`}
        </p>
      </div>

      <div className="mb-6">
        <SearchBox placeholder="שם, טלפון, ת.ז., אימייל..." />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-20">
              <tr>
                <th
                  colSpan={7}
                  className="px-5 py-3 text-right text-sm font-semibold text-[var(--color-primary)] bg-white border-b border-[var(--color-border)] rounded-t-xl"
                >
                  {formatNum(total)} הורים
                </th>
              </tr>
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">שם הורה</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">טלפון</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">ת.ז.</th>
                <th className="py-3 px-4 font-semibold text-center bg-[var(--color-muted)]">ילדים</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">סה״כ מחיר</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">שולם</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">יתרה</th>
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
