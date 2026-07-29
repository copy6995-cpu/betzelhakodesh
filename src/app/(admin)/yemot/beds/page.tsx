import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { loadBedsMatrix, shortDate } from "@/lib/beds-matrix";
import { SearchBox } from "@/components/search-box";
import { SyncBedsButton } from "./sync-beds";
import { BedsExportButton } from "./export-button";
import { ManualBedButton, type WeekOption } from "./manual-entry";
import { ManualCell } from "./manual-cell";

export const dynamic = "force-dynamic";

type SearchParams = {
  year?: string;
  filter?: string; // "not-registered" | ""
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  scope?: string; // "year" | "all"  — default "year" hides reservations
  // whose personalCode isn't in the current-year roster
  q?: string; // free-text: student name / personal code
};

/** Parse a "YYYY-MM-DD" query param into a Date at local midnight. */
function parseISODateLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

export default async function BedsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const activeYear = await getActiveYear(sp.year);
  const filter = sp.filter ?? "";
  const scope = sp.scope ?? "year";
  const fromDate = parseISODateLocal(sp.from);
  const toDate = parseISODateLocal(sp.to);

  const {
    weeks,
    rows: filtered,
    cells: cellsByStudent,
    totalByWeek,
    grandTotal,
    reservationCount,
  } = await loadBedsMatrix({
    activeYear,
    scope: scope === "all" ? "all" : "year",
    filter: filter === "not-registered" ? "not-registered" : "",
    from: fromDate,
    to: toDate,
    q: sp.q,
  });

  // Roster + existing weeks for the manual-entry dialog.
  const rosterRows = await prisma.student.findMany({
    where: { year: activeYear, archived: false },
    select: { personalCode: true, firstName: true, lastName: true, yeshiva: true },
    orderBy: [{ yeshiva: "asc" }, { lastName: "asc" }],
  });
  const roster = rosterRows.map((s) => ({
    code: s.personalCode,
    name: `${s.lastName} ${s.firstName}`,
    yeshiva: s.yeshiva,
  }));
  const weekOptions: WeekOption[] = weeks.map((w) => ({
    weekKey: w.weekKey,
    label: `${w.hebDate ?? w.weekKey} · ${shortDate(w.latestDate)}`,
    date: w.latestDate,
    hebDate: w.hebDate,
  }));

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/settings/yemot" className="hover:underline">
              ימות המשיח
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
            הזמנות מיטה
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            {formatNum(reservationCount)} רשומות · {weeks.length} שבועות ·{" "}
            {formatNum(filtered.length)} תלמידים בתצוגה
            {scope === "year" && ` · תלמידי ${activeYear} בלבד`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/yemot/beds/groups"
            className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
          >
            דוח קבוצות
          </Link>
          <ManualBedButton roster={roster} weeks={weekOptions} />
          <BedsExportButton
            year={sp.year}
            scope={scope}
            filter={filter}
            from={sp.from}
            to={sp.to}
          />
          <SyncBedsButton />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={{
            pathname: "/yemot/beds",
            query: {
              ...(sp.from ? { from: sp.from } : {}),
              ...(sp.to ? { to: sp.to } : {}),
              ...(filter ? { filter } : {}),
            },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (scope === "year" ? "pill-active" : "pill-idle")
          }
        >
          תלמידי {activeYear} בלבד
        </Link>
        <Link
          href={{
            pathname: "/yemot/beds",
            query: {
              scope: "all",
              ...(sp.from ? { from: sp.from } : {}),
              ...(sp.to ? { to: sp.to } : {}),
              ...(filter ? { filter } : {}),
            },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (scope === "all" ? "pill-active" : "pill-idle")
          }
        >
          כל התלמידים
        </Link>
      </div>

      <form
        method="GET"
        className="mb-6 bg-white rounded-xl card-shadow p-4 flex flex-wrap items-end gap-3"
      >
        {scope === "all" && <input type="hidden" name="scope" value="all" />}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <label className="flex flex-col text-xs">
          <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
            מתאריך
          </span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
            עד תאריך
          </span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
        >
          החל
        </button>
        {(sp.from || sp.to) && (
          <Link
            href={{
              pathname: "/yemot/beds",
              query: {
                ...(scope === "all" ? { scope: "all" } : {}),
                ...(filter ? { filter } : {}),
              },
            }}
            className="text-xs text-[var(--color-muted-foreground)] hover:underline pb-2"
          >
            נקה
          </Link>
        )}
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={{
            pathname: "/yemot/beds",
            query: {
              ...(scope === "all" ? { scope: "all" } : {}),
              ...(sp.from ? { from: sp.from } : {}),
              ...(sp.to ? { to: sp.to } : {}),
            },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (filter === "" ? "pill-active" : "pill-idle")
          }
        >
          כל התלמידים
        </Link>
        <Link
          href={{
            pathname: "/yemot/beds",
            query: {
              filter: "not-registered",
              ...(scope === "all" ? { scope: "all" } : {}),
              ...(sp.from ? { from: sp.from } : {}),
              ...(sp.to ? { to: sp.to } : {}),
            },
          }}
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (filter === "not-registered" ? "pill-active" : "pill-idle")
          }
        >
          הזמינו ולא רשומים באש״ל
        </Link>
      </div>

      <div className="mb-6">
        <SearchBox placeholder="חיפוש לפי שם או קוד אישי..." />
      </div>

      {weeks.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-8 text-center">
          <p className="text-[var(--color-muted-foreground)]">
            אין נתונים.{" "}
            <Link
              href="/settings/yemot"
              className="text-[var(--color-accent)] hover:underline"
            >
              הגדר טוקן וסנכרן
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl card-shadow overflow-auto max-h-[calc(100vh-15rem)]">
          {/* border-separate (not collapse) so the sticky header <th>s stay
              pinned on scroll — collapse breaks position:sticky in Chromium. */}
          <table className="text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-[var(--color-muted)]">
                <th className="sticky right-0 top-0 z-30 bg-[var(--color-muted)] py-2 pe-3 ps-3 text-right border-e border-b border-[var(--color-border)] whitespace-nowrap">
                  ישיבה
                </th>
                <th className="sticky right-[80px] top-0 z-30 bg-[var(--color-muted)] py-2 pe-3 ps-3 text-right border-e border-b border-[var(--color-border)] whitespace-nowrap">
                  שם
                </th>
                <th className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 text-center text-xs border-b border-[var(--color-border)] whitespace-nowrap">
                  קוד
                </th>
                <th className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 text-center text-xs border-b border-[var(--color-border)] whitespace-nowrap">
                  שיעור
                </th>
                <th className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 text-center text-xs border-b border-[var(--color-border)] whitespace-nowrap">
                  אש״ל
                </th>
                {weeks.map((w) => (
                  <th
                    key={w.weekKey}
                    className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-1 text-center text-xs font-normal min-w-[60px] border-b border-[var(--color-border)] whitespace-nowrap"
                  >
                    <div className="text-[10px] text-[var(--color-muted-foreground)]">
                      {w.hebDate ?? w.weekKey}
                    </div>
                    <div className="font-semibold">
                      {shortDate(w.latestDate)}
                    </div>
                  </th>
                ))}
                <th className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 text-center text-xs border-b border-[var(--color-border)] whitespace-nowrap">
                  סה״כ
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const cells = cellsByStudent.get(row.code);
                const eshelBg =
                  row.approvedCount > 0 && row.registeredEshel === false
                    ? "bg-red-100"
                    : row.registeredEshel === true
                    ? "bg-green-50"
                    : "";
                return (
                  <tr
                    key={row.code}
                    className="[&>td]:border-t [&>td]:border-[var(--color-border)]/40"
                  >
                    <td className="sticky right-0 z-10 bg-white py-1.5 pe-3 ps-3 text-xs text-[var(--color-muted-foreground)] border-e border-[var(--color-border)] whitespace-nowrap">
                      {row.yeshiva}
                    </td>
                    <td className="sticky right-[80px] z-10 bg-white py-1.5 pe-3 ps-3 whitespace-nowrap border-e border-[var(--color-border)]">
                      {row.fromRoster ? (
                        <Link
                          href={`/bachurim?q=${encodeURIComponent(row.code)}`}
                          className="text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">
                          {row.name} <sup className="text-xs">•</sup>
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center text-xs font-mono text-[var(--color-muted-foreground)]">
                      {row.code}
                    </td>
                    <td className="py-1.5 px-2 text-center text-xs">
                      {row.shiur ?? "—"}
                    </td>
                    <td className={"py-1.5 px-2 text-center text-xs " + eshelBg}>
                      {row.registeredEshel === true
                        ? "✓"
                        : row.registeredEshel === false
                        ? "0"
                        : "—"}
                    </td>
                    {weeks.map((w) => {
                      const c = cells?.get(w.weekKey);
                      if (!c) return <td key={w.weekKey} className="py-1.5" />;
                      if (c.status === "approved") {
                        return (
                          <td
                            key={w.weekKey}
                            className={
                              "text-center " + (c.manual ? "p-0" : "py-1.5 px-1 text-xs bg-[#C6EFCE] font-mono")
                            }
                          >
                            {c.manual ? (
                              <ManualCell
                                personalCode={row.code}
                                weekKey={w.weekKey}
                                label={shortDate(c.date)}
                              />
                            ) : (
                              shortDate(c.date)
                            )}
                          </td>
                        );
                      }
                      if (c.status === "outofstock") {
                        return (
                          <td
                            key={w.weekKey}
                            className="py-1.5 px-1 text-center text-xs bg-[#FFD966]"
                          >
                            אזל
                          </td>
                        );
                      }
                      return <td key={w.weekKey} className="py-1.5" />;
                    })}
                    <td className="py-1.5 px-2 text-center text-sm font-bold bg-[#FCE4D6]">
                      {row.approvedCount || ""}
                    </td>
                  </tr>
                );
              })}
              <tr className="no-hover bg-[var(--color-primary)] text-white [&>td]:border-t-2 [&>td]:border-[var(--color-primary)]">
                <td className="sticky right-0 z-10 bg-[var(--color-primary)] py-2 pe-3 ps-3 text-xs">
                  סיכום
                </td>
                <td className="sticky right-[80px] z-10 bg-[var(--color-primary)] py-2 pe-3 ps-3 text-xs whitespace-nowrap">
                  סה״כ הזמינו בשבוע
                </td>
                <td className="py-2 px-2 text-center text-xs" colSpan={3}></td>
                {weeks.map((w) => (
                  <td
                    key={w.weekKey}
                    className="py-2 px-1 text-center text-xs font-semibold"
                  >
                    {totalByWeek[w.weekKey] || ""}
                  </td>
                ))}
                <td className="py-2 px-2 text-center text-sm font-bold">
                  {grandTotal || ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
