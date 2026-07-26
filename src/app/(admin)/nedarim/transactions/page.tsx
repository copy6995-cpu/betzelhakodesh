import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";
import { NedarimTabs } from "../tabs";
import { SyncTransactionsButton } from "./sync-tx";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

type SearchParams = { q?: string; page?: string; hook?: string; scope?: string };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const hook = sp.hook?.trim();
  const scope = sp.scope?.trim() || "year";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const year = await getActiveYear();

  // By default, restrict to transactions whose kevaId matches a hook of an
  // active-year student. Pass ?scope=all to see the raw feed.
  let activeYearHooks: string[] = [];
  if (scope === "year") {
    const students = await prisma.student.findMany({
      where: {
        year,
        archived: false,
        NOT: [{ nedarimHook: null }, { nedarimHook: "" }],
      },
      select: { nedarimHook: true },
    });
    activeYearHooks = students.map((s) => s.nedarimHook!).filter(Boolean);
  }

  // Big year rosters (תשפ״ו has ~1160 hooked students, תשפ״ז ~750) push past
  // SQLite's 999-param default on the `IN (...)` clause, crashing the page.
  // Once we're over 500 hooks we skip Prisma's WHERE-IN and use raw SQL with
  // a subquery join instead — the DB handles the whole set without binding
  // each hook as a param.
  const useRawJoin = scope === "year" && !hook && activeYearHooks.length > 500;

  // Only the columns the JSX below actually reads. Both branches (raw SQL
  // and Prisma findMany) produce compatible shapes.
  type Row = {
    id: string;
    transactionId: string;
    kevaId: string | null;
    clientName: string | null;
    phone: string | null;
    amount: number | null;
    currency: number | null;
    transactionTime: Date | null;
    transactionType: string | null;
    confirmation: string | null;
  };

  let rows: Row[] = [];
  let total = 0;
  let totalAmt = 0;

  if (useRawJoin) {
    // WHERE fragments — collect and join with AND. Search terms bind
    // normally; the hook set stays inside the subquery so we don't hit
    // the param limit even with 20k+ hooks.
    const escLike = (s: string) => `%${s.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const where1 = `kevaId IN (SELECT nedarimHook FROM Student WHERE year = ? AND archived = 0 AND nedarimHook IS NOT NULL AND nedarimHook != '')`;
    const params: (string | number)[] = [year];
    let whereClause = where1;
    if (q) {
      whereClause +=
        " AND (clientName LIKE ? OR phone LIKE ? OR zeout LIKE ? OR transactionId LIKE ? OR kevaId LIKE ? OR confirmation LIKE ?)";
      const like = escLike(q);
      params.push(like, like, like, like, like, like);
    }

    const rawRows = await prisma.$queryRawUnsafe<
      Array<Omit<Row, "transactionTime"> & { transactionTime: string | null }>
    >(
      `SELECT id, transactionId, kevaId, clientName, phone, amount, currency, transactionTime, transactionType, confirmation
       FROM NedarimTransaction
       WHERE ${whereClause}
       ORDER BY transactionTime DESC
       LIMIT ? OFFSET ?`,
      ...params,
      PAGE_SIZE,
      (page - 1) * PAGE_SIZE
    );
    // Coerce ISO strings back to Date for the JSX .toLocaleDateString calls.
    rows = rawRows.map((r) => ({
      ...r,
      transactionTime: r.transactionTime ? new Date(r.transactionTime) : null,
    }));

    const [{ c: total_ }] = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*) as c FROM NedarimTransaction WHERE ${whereClause}`,
      ...params
    );
    total = Number(total_);
    const [{ s: sum_ }] = await prisma.$queryRawUnsafe<Array<{ s: number | null }>>(
      `SELECT SUM(amount) as s FROM NedarimTransaction WHERE ${whereClause}`,
      ...params
    );
    totalAmt = Number(sum_ ?? 0);
  } else {
    const where = {
      ...(scope === "year" && !hook
        ? { kevaId: { in: activeYearHooks.length ? activeYearHooks : ["___none___"] } }
        : {}),
      ...(hook ? { kevaId: hook } : {}),
      ...(q
        ? {
            OR: [
              { clientName: { contains: q } },
              { phone: { contains: q } },
              { zeout: { contains: q } },
              { transactionId: { contains: q } },
              { kevaId: { contains: q } },
              { confirmation: { contains: q } },
            ],
          }
        : {}),
    };
    const [rows_, total_, agg] = await Promise.all([
      prisma.nedarimTransaction.findMany({
        where,
        orderBy: { transactionTime: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.nedarimTransaction.count({ where }),
      prisma.nedarimTransaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);
    rows = rows_ as unknown as Row[];
    total = total_;
    totalAmt = Number(agg._sum.amount ?? 0);
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build hook → student(s) map for THIS page's transactions so the הוק cell
  // can link straight to the student(s) that hold that hook. We fetch in ONE
  // query rather than per-row. A hook may attach to more than one student
  // across years — we surface the newest year first.
  const pageHooks = [
    ...new Set(rows.map((r) => r.kevaId).filter((h): h is string => !!h)),
  ];
  const hookedStudents = pageHooks.length
    ? await prisma.student.findMany({
        where: { nedarimHook: { in: pageHooks } },
        select: {
          id: true,
          year: true,
          nedarimHook: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { year: "desc" },
      })
    : [];
  const studentsByHook = new Map<
    string,
    Array<(typeof hookedStudents)[number]>
  >();
  for (const s of hookedStudents) {
    if (!s.nedarimHook) continue;
    const arr = studentsByHook.get(s.nedarimHook) ?? [];
    arr.push(s);
    studentsByHook.set(s.nedarimHook, arr);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/settings/nedarim" className="hover:underline">
              נדרים פלוס
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
            היסטוריית עסקאות
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            {formatNum(total)} עסקאות · סה״כ {formatILS(totalAmt)}
            {scope === "year" && ` · תלמידי ${year} בלבד`}
            {hook && ` · הוראת קבע ${hook}`}
            {q && ` · חיפוש: "${q}"`}
          </p>
        </div>
        <SyncTransactionsButton />
      </div>

      <NedarimTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={{
            pathname: "/nedarim/transactions",
            query: { ...(q ? { q } : {}), ...(hook ? { hook } : {}) },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (scope === "year" ? "pill-active" : "pill-idle")
          }
        >
          תלמידי {year} בלבד
        </Link>
        <Link
          href={{
            pathname: "/nedarim/transactions",
            query: {
              scope: "all",
              ...(q ? { q } : {}),
              ...(hook ? { hook } : {}),
            },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (scope === "all" ? "pill-active" : "pill-idle")
          }
        >
          כל העסקאות
        </Link>
      </div>

      <div className="mb-4">
        <SearchBox placeholder="שם לקוח / טלפון / ת.ז. / מזהה עסקה / הוק..." />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="px-5 py-3 border-b border-[var(--color-border)] rounded-t-xl">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {formatNum(total)} עסקאות
          </div>
        </div>
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="sticky top-16 z-20 py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">
                  תאריך
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  שם
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  טלפון
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  סכום
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  סוג
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  הוק
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  אישור
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  מזהה
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                // If the transaction's kevaId matches one or more students,
                // link straight to the newest-year one. When no student
                // matches, we show the name/hook as plain text.
                const linkedStudents = t.kevaId
                  ? studentsByHook.get(t.kevaId) ?? []
                  : [];
                const primaryStudent = linkedStudents[0] ?? null;
                return (
                  <tr
                  key={t.id}
                  className="border-t border-[var(--color-border)]/60"
                >
                  <td className="py-2.5 pe-5 ps-5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {t.transactionTime
                      ? t.transactionTime.toLocaleDateString("he-IL")
                      : "—"}
                  </td>
                  <td className="py-2.5 px-4 font-medium">
                    {primaryStudent ? (
                      <Link
                        href={`/bachurim/${primaryStudent.id}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                        title={`${primaryStudent.lastName} ${primaryStudent.firstName} · ${primaryStudent.year}`}
                      >
                        {t.clientName ?? "—"}
                      </Link>
                    ) : (
                      t.clientName ?? "—"
                    )}
                  </td>
                  <td
                    className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs"
                    dir="ltr"
                  >
                    {t.phone ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                    {t.amount !== null ? formatILS(t.amount) : "—"}
                    {t.currency === 2 && (
                      <span className="text-xs opacity-60"> ($)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    {t.transactionType ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs">
                    {t.kevaId ? (
                      primaryStudent ? (
                        <Link
                          href={`/bachurim/${primaryStudent.id}`}
                          className="text-[var(--color-accent)] hover:font-semibold hover:underline"
                          title={`${primaryStudent.lastName} ${primaryStudent.firstName} · ${primaryStudent.year}`}
                        >
                          {t.kevaId}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">
                          {t.kevaId}
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--color-muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                    {t.confirmation ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                    {t.transactionId}
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[var(--color-muted-foreground)]"
                  >
                    אין עסקאות במאגר.{" "}
                    <Link
                      href="/settings/nedarim"
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      סנכרן מנדרים פלוס
                    </Link>
                    .
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
        basePath="/nedarim/transactions"
      />
    </div>
  );
}
