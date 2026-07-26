import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { NedarimTabs } from "../tabs";
import { SyncHoksButton } from "./sync-hoks-button";
import { ChargeButton } from "./charge-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

type SearchParams = { q?: string; page?: string };

export default async function HoksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = q
    ? {
        OR: [
          { kevaId: { contains: q } },
          { clientName: { contains: q } },
          { lastNum: { contains: q } },
          { category: { contains: q } },
        ],
      }
    : {};

  const [hoks, agg] = await Promise.all([
    prisma.nedarimKeva.findMany({
      where,
      orderBy: [{ errorText: "desc" }, { nextDate: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.nedarimKeva.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(agg._count._all / PAGE_SIZE));

  // Join to students by hook — a HoK may attach to multiple students across
  // years, we surface the latest year first for the display link. We only
  // look up students for the hooks on THIS page (SQLite bind-param limit is
  // 999 by default — the raw DB has 4k+ HoKs, so global lookups blow up).
  const hookNums = hoks.map((h) => h.kevaId);
  const students = hookNums.length
    ? await prisma.student.findMany({
        where: { nedarimHook: { in: hookNums } },
        select: {
          id: true,
          year: true,
          nedarimHook: true,
          firstName: true,
          lastName: true,
          parentId: true,
        },
        orderBy: { year: "desc" },
      })
    : [];
  const studentsByHook = new Map<
    string,
    Array<(typeof students)[number]>
  >();
  for (const s of students) {
    if (!s.nedarimHook) continue;
    const arr = studentsByHook.get(s.nedarimHook) ?? [];
    arr.push(s);
    studentsByHook.set(s.nedarimHook, arr);
  }

  const activeCount = hoks.filter((h) => !h.errorText).length;
  const withErrors = hoks.filter((h) => h.errorText).length;
  const totalMonthly = Number(agg._sum.amount ?? 0);

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
            הוראות קבע
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            {formatNum(agg._count._all)} הו״ק · {formatNum(activeCount)} תקינות
            {withErrors > 0 && ` · ${formatNum(withErrors)} עם שגיאה`}
            {" · "}חודשי: {formatILS(totalMonthly)}
          </p>
        </div>
        <SyncHoksButton />
      </div>

      <NedarimTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        <form method="GET" action="/nedarim/hoks" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="שם / קוד הו״ק / 4 ספרות אחרונות / קטגוריה"
            className="w-80 h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
          <button
            type="submit"
            className="px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            חיפוש
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)]">
            <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <th className="py-3 pe-5 ps-5 font-semibold">שם / הו״ק</th>
              <th className="py-3 px-4 font-semibold">תלמיד</th>
              <th className="py-3 px-4 font-semibold">סכום</th>
              <th className="py-3 px-4 font-semibold">בוצע / יתרה</th>
              <th className="py-3 px-4 font-semibold">חיוב הבא</th>
              <th className="py-3 px-4 font-semibold">כרטיס</th>
              <th className="py-3 px-4 font-semibold">קטגוריה</th>
              <th className="py-3 px-4 font-semibold w-32"></th>
            </tr>
          </thead>
          <tbody>
            {hoks.map((h) => {
              const linked = studentsByHook.get(h.kevaId) ?? [];
              const primary = linked[0] ?? null;
              return (
                <tr
                  key={h.id}
                  className={
                    "border-t border-[var(--color-border)]/60 " +
                    (h.errorText ? "bg-red-50/50" : "")
                  }
                >
                  <td className="py-2.5 pe-5 ps-5">
                    <div className="font-medium">{h.clientName ?? "—"}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)] font-mono">
                      #{h.kevaId}
                    </div>
                    {h.errorText && (
                      <div className="text-xs text-red-700 mt-0.5">
                        ⚠️ {h.errorText}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-sm">
                    {primary ? (
                      <Link
                        href={`/bachurim/${primary.id}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                      >
                        {primary.lastName} {primary.firstName}
                        <span className="text-xs opacity-60"> · {primary.year}</span>
                      </Link>
                    ) : (
                      <span className="text-[var(--color-muted-foreground)] text-xs">
                        לא משוייך
                      </span>
                    )}
                    {linked.length > 1 && (
                      <div className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                        +{linked.length - 1} רשומות נוספות של אותו בחור
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                    {h.amount !== null ? formatILS(h.amount) : "—"}
                    {h.currency === 2 && (
                      <span className="text-xs opacity-60"> ($)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    <span className="font-semibold text-[var(--color-success)]">
                      {h.success ?? 0}
                    </span>
                    {" / "}
                    <span className="font-semibold text-[var(--color-accent)]">
                      {h.itra ?? 0}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[var(--color-muted-foreground)] font-mono whitespace-nowrap">
                    {h.nextDate ?? "—"}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-mono text-[var(--color-muted-foreground)]">
                    {h.lastNum ? `**** ${h.lastNum}` : "—"}
                    {h.tokef && (
                      <span className="ms-1 opacity-70">({h.tokef})</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    {h.category ?? "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    <ChargeButton
                      kevaId={h.kevaId}
                      defaultAmount={h.amount}
                      clientName={h.clientName}
                    />
                  </td>
                </tr>
              );
            })}
            {hoks.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-10 text-center text-[var(--color-muted-foreground)]"
                >
                  אין הוראות קבע במאגר.{" "}
                  {!q && "לחץ &quot;סנכרן הו״ק&quot; כדי למשוך מנדרים."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={sp as Record<string, string>}
        basePath="/nedarim/hoks"
      />
    </div>
  );
}
