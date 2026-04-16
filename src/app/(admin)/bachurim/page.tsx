import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";
import { YeshivaPillFilter } from "@/components/yeshiva-pill-filter";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { yeshiva?: string; q?: string; page?: string };

export default async function BachurimPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const year = await getActiveYear();
  const yeshiva = sp.yeshiva;
  const q = sp.q?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    year,
    archived: false,
    ...(yeshiva ? { yeshiva } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { fatherName: { contains: q, mode: "insensitive" as const } },
            { personalCode: { contains: q } },
            { nedarimHook: { contains: q } },
          ],
        }
      : {}),
  };

  const [students, total, yeshivaGroups, totalInYear] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        parent: { select: { id: true, phone: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["yeshiva"],
      where: { year, archived: false },
      _count: { _all: true },
      orderBy: { yeshiva: "asc" },
    }),
    prisma.student.count({ where: { year, archived: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">בחורים</h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          {formatNum(total)} בחורים {yeshiva ? `ב-${yeshiva}` : "בכל הישיבות"}
          {q && ` התואמים "${q}"`}
        </p>
      </div>

      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
          ישיבה
        </div>
        <YeshivaPillFilter
          yeshivot={yeshivaGroups.map((g) => ({
            name: g.yeshiva,
            count: g._count._all,
          }))}
          totalCount={totalInYear}
        />
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          חיפוש
        </div>
        <Link
          href="/bachurim/new"
          className="inline-flex items-center px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + בחור חדש
        </Link>
      </div>
      <div className="mb-6">
        <SearchBox placeholder="שם, קוד אישי, מספר הוק..." />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Whole thead sticks as one unit right below the site header
                (h-16 = 64px). Both rows keep their own bg-color so content
                scrolls underneath opaquely. */}
            <thead className="sticky top-16 z-20">
              <tr>
                <th
                  colSpan={9}
                  className="px-5 py-3 text-right text-sm font-semibold text-[var(--color-primary)] bg-white border-b border-[var(--color-border)] rounded-t-xl"
                >
                  {formatNum(total)} בחורים
                </th>
              </tr>
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">שם מלא</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">קוד אישי</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">ישיבה</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">שיעור</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">עיר</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">מחיר</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">שולם</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">יתרה</th>
                <th className="py-3 px-4 font-semibold bg-[var(--color-muted)]">תאריך סיום</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const paid = s.payments.reduce((a, p) => a + Number(p.amount), 0);
                const price = s.price ?? 0;
                const remaining = price - paid;
                return (
                  <tr key={s.id} className="border-t border-[var(--color-border)]/60">
                    <td className="py-2.5 pe-5 ps-5">
                      <Link
                        href={`/bachurim/${s.id}`}
                        className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                      >
                        {s.lastName} {s.firstName}
                      </Link>
                      <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                        {s.fatherName && `בן ${s.fatherName}`}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[var(--color-muted-foreground)]">
                      {s.personalCode}
                    </td>
                    <td className="py-2.5 px-4">{s.yeshiva}</td>
                    <td className="py-2.5 px-4 text-center">{s.shiur ?? "—"}</td>
                    <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                      {s.city ?? "—"}
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
                    <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                      {s.endDateLabel ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-[var(--color-muted-foreground)]"
                  >
                    לא נמצאו בחורים התואמים לסינון.
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
        basePath="/bachurim"
      />
    </div>
  );
}
