import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { getExpiredEndDateLabels, activeEshelWhere } from "@/lib/eshel";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";
import { CreditCardSyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

type StatFilter = "all" | "unmatched";

type SearchParams = {
  q?: string;
  page?: string;
  year?: string;
  stat?: StatFilter;
};

async function registrationStats(year: string) {
  // "Registered" here is the *active* status — a bachur whose season end date
  // has passed no longer counts, matching the /bachurim page.
  const expired = await getExpiredEndDateLabels(year);
  const active = activeEshelWhere(expired);
  const [totalRegistered, yemotCount, nedarimWithHook, nedarimNoHook] =
    await Promise.all([
      prisma.student.count({ where: { year, ...active } }),
      prisma.student.count({
        where: { year, AND: [active, { paymentMethod: "ימות המשיח" }] },
      }),
      prisma.student.count({
        where: {
          year,
          AND: [
            active,
            { paymentMethod: { not: "ימות המשיח" } },
            { NOT: [{ nedarimHook: null }, { nedarimHook: "" }] },
          ],
        },
      }),
      prisma.student.count({
        where: {
          year,
          AND: [
            active,
            { paymentMethod: { not: "ימות המשיח" } },
            { OR: [{ nedarimHook: null }, { nedarimHook: "" }] },
          ],
        },
      }),
    ]);

  const yemotCodes = await prisma.yemotCreditCard.findMany({
    where: { year, status: "מאושר" },
    select: { personalCode: true },
    distinct: ["personalCode"],
  });
  const yemotSet = new Set(yemotCodes.map((r) => r.personalCode));
  const unmatchedYemot = yemotSet.size
    ? yemotSet.size -
      (await prisma.student.count({
        where: { year, personalCode: { in: [...yemotSet] } },
      }))
    : 0;

  return {
    totalRegistered,
    yemotCount,
    nedarimWithHook,
    nedarimNoHook,
    yemotSlikot: yemotSet.size,
    unmatchedYemot: Math.max(0, unmatchedYemot),
  };
}

async function getUnmatchedCodes(year: string): Promise<Set<string>> {
  const yemotCodes = await prisma.yemotCreditCard.findMany({
    where: { year, status: "מאושר" },
    select: { personalCode: true },
    distinct: ["personalCode"],
  });
  if (yemotCodes.length === 0) return new Set();
  const codes = yemotCodes.map((r) => r.personalCode).filter(Boolean);
  const matched = await prisma.student.findMany({
    where: { year, personalCode: { in: codes } },
    select: { personalCode: true },
  });
  const matchedSet = new Set(matched.map((s) => s.personalCode));
  return new Set(codes.filter((c) => !matchedSet.has(c)));
}

export default async function CreditCardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const yearFilter = sp.year?.trim() || "all";
  const statFilter = (sp.stat ?? "all") as StatFilter;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const activeYear = await getActiveYear();

  const statsYear = yearFilter !== "all" ? yearFilter : activeYear;

  const unmatchedCodes =
    statFilter === "unmatched"
      ? await getUnmatchedCodes(statsYear)
      : new Set<string>();

  const where = {
    ...(yearFilter !== "all" ? { year: yearFilter } : {}),
    ...(statFilter === "unmatched"
      ? {
          year: statsYear,
          status: "מאושר",
          personalCode: { in: [...unmatchedCodes] },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { personalCode: { contains: q } },
            { phone: { contains: q } },
            { approvalNum: { contains: q } },
            { customerName: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, total, agg, years, stats] = await Promise.all([
    prisma.yemotCreditCard.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.yemotCreditCard.count({ where }),
    prisma.yemotCreditCard.aggregate({ where, _sum: { amount: true } }),
    prisma.yemotCreditCard.groupBy({ by: ["year"] }),
    registrationStats(statsYear),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalAmt = Number(agg._sum.amount ?? 0);

  const uniqueYears = years
    .map((y) => y.year)
    .filter((y): y is string => !!y)
    .sort()
    .reverse();

  const pageCodes = [
    ...new Set(rows.map((r) => r.personalCode).filter(Boolean)),
  ];
  const students = pageCodes.length
    ? await prisma.student.findMany({
        where: { personalCode: { in: pageCodes } },
        select: {
          id: true,
          personalCode: true,
          year: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { year: "desc" },
      })
    : [];
  const studentByYearCode = new Map<string, (typeof students)[number]>();
  const studentByCode = new Map<string, (typeof students)[number]>();
  for (const s of students) {
    studentByYearCode.set(`${s.year}|${s.personalCode}`, s);
    if (!studentByCode.has(s.personalCode))
      studentByCode.set(s.personalCode, s);
  }

  function tileHref(stat: StatFilter) {
    const params = new URLSearchParams();
    if (yearFilter !== "all") params.set("year", yearFilter);
    if (q) params.set("q", q);
    if (stat !== "all") params.set("stat", stat);
    const qs = params.toString();
    return `/yemot/credit-cards${qs ? `?${qs}` : ""}`;
  }

  const tiles = [
    {
      label: "רשומים סה״כ",
      value: stats.totalRegistered,
      color: "var(--color-primary)",
    },
    {
      label: "נדרים + הוק",
      value: stats.nedarimWithHook,
      color: "var(--color-accent)",
    },
    {
      label: "נדרים ללא הוק",
      value: stats.nedarimNoHook,
      color: "var(--color-warning, #d97706)",
    },
    {
      label: "ימות המשיח",
      value: stats.yemotCount,
      color: "var(--color-success)",
    },
    {
      label: "ללא התאמה",
      value: stats.unmatchedYemot,
      color: "var(--color-muted-foreground)",
      stat: "unmatched" as StatFilter,
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/settings/yemot" className="hover:underline">
            ימות המשיח
          </Link>
        </div>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            סליקות אשראי
          </h1>
          <CreditCardSyncButton />
        </div>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {formatNum(total)} סליקות · סה״כ {formatILS(totalAmt)}
          {yearFilter !== "all" && ` · ${yearFilter}`}
          {q && ` · חיפוש: "${q}"`}
          {statFilter === "unmatched" && " · ללא התאמה בלבד"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t) => {
          const href = t.stat ? tileHref(t.stat) : undefined;
          const isActive = t.stat === statFilter;
          const activeCls = isActive
            ? " ring-2 ring-[var(--color-accent)] ring-offset-2"
            : "";
          const inner = (
            <>
              <div className="text-2xl font-bold" style={{ color: t.color }}>
                {formatNum(t.value)}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)] mt-1">
                {t.label}
              </div>
            </>
          );
          if (href) {
            return (
              <Link
                key={t.label}
                href={href}
                className={
                  "bg-white rounded-xl card-shadow px-4 py-3 text-center hover:shadow-md transition-shadow" +
                  activeCls
                }
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={t.label}
              className="bg-white rounded-xl card-shadow px-4 py-3 text-center"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {statFilter === "unmatched" && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
          מציג רק סליקות מאושרות שהקוד האישי שלהן לא נמצא במאגר התלמידים
          לשנת {statsYear}.{" "}
          <Link
            href={tileHref("all")}
            className="text-[var(--color-accent)] hover:underline font-medium"
          >
            הצג הכל ←
          </Link>
        </div>
      )}

      <div className="text-xs text-[var(--color-muted-foreground)] mb-4 bg-white rounded-lg card-shadow px-4 py-2">
        רישום {statsYear}:{" "}
        <b>{formatNum(stats.nedarimWithHook + stats.nedarimNoHook)}</b> נדרים
        פלוס ·{" "}
        <b>{formatNum(stats.yemotCount)}</b> ימות המשיח ·{" "}
        <b>{formatNum(stats.yemotSlikot)}</b> סליקות (
        {stats.unmatchedYemot > 0
          ? `${stats.unmatchedYemot} ללא התאמה`
          : "כולן התאימו"}
        )
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={{
            pathname: "/yemot/credit-cards",
            query: { ...(q ? { q } : {}) },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (yearFilter === "all" && statFilter === "all"
              ? "pill-active"
              : "pill-idle")
          }
        >
          הכל
        </Link>
        {uniqueYears.map((y) => (
          <Link
            key={y}
            href={{
              pathname: "/yemot/credit-cards",
              query: { year: y, ...(q ? { q } : {}) },
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
              (yearFilter === y && statFilter === "all"
                ? "pill-active"
                : "pill-idle")
            }
          >
            {y}
          </Link>
        ))}
      </div>

      <div className="mb-4">
        <SearchBox placeholder="קוד אישי / טלפון / מספר אישור / שם..." />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="px-5 py-3 border-b border-[var(--color-border)] rounded-t-xl">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {formatNum(total)} סליקות
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
                  שנה
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  קוד אישי
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
                  תשלומים
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  מס׳ אישור (הו״ק)
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const yearStudent =
                  r.personalCode && r.year
                    ? studentByYearCode.get(`${r.year}|${r.personalCode}`)
                    : undefined;
                const anyStudent = r.personalCode
                  ? studentByCode.get(r.personalCode)
                  : undefined;
                const isUnmatched =
                  r.status === "מאושר" &&
                  r.personalCode &&
                  !yearStudent;
                return (
                  <tr
                    key={r.id}
                    className={
                      "border-t border-[var(--color-border)]/60" +
                      (isUnmatched ? " bg-amber-50" : "")
                    }
                  >
                    <td className="py-2.5 pe-5 ps-5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                      {r.date ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                      {r.year ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 font-medium font-mono text-xs">
                      {yearStudent ? (
                        <Link
                          href={`/bachurim/${yearStudent.id}`}
                          className="text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                          title={`${yearStudent.lastName} ${yearStudent.firstName} · ${yearStudent.year}`}
                        >
                          {r.personalCode}
                        </Link>
                      ) : (
                        <span
                          className={
                            isUnmatched
                              ? "text-amber-700 font-semibold"
                              : r.personalCode
                              ? ""
                              : "text-[var(--color-muted-foreground)]"
                          }
                        >
                          {r.personalCode || "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-sm">
                      {yearStudent ? (
                        <Link
                          href={`/bachurim/${yearStudent.id}`}
                          className="text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                        >
                          {yearStudent.lastName} {yearStudent.firstName}
                        </Link>
                      ) : isUnmatched && anyStudent ? (
                        <span className="text-amber-700 text-xs">
                          {anyStudent.lastName} {anyStudent.firstName}{" "}
                          <span className="opacity-70">
                            (קיים ב{anyStudent.year})
                          </span>
                        </span>
                      ) : isUnmatched ? (
                        <span className="text-amber-700 text-xs">
                          לא נמצא במאגר
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">
                          —
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs"
                      dir="ltr"
                    >
                      {r.phone ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                      {r.amount !== null ? formatILS(r.amount) : "—"}
                      {r.currency === 2 && (
                        <span className="text-xs opacity-60"> ($)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {r.installments ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">
                      {r.approvalNum ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {r.status === "מאושר" ? (
                        <span className="text-[var(--color-success)] font-medium">
                          {r.status}
                        </span>
                      ) : (
                        r.status ?? "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-[var(--color-muted-foreground)]"
                  >
                    {statFilter === "unmatched" ? (
                      <>
                        אין סליקות ללא התאמה.{" "}
                        <Link
                          href={tileHref("all")}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          הצג הכל ←
                        </Link>
                      </>
                    ) : (
                      <>
                        אין סליקות במאגר.{" "}
                        <Link
                          href="/settings/yemot"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          סנכרן מימות המשיח
                        </Link>
                        .
                      </>
                    )}
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
        basePath="/yemot/credit-cards"
      />
    </div>
  );
}
