import Link from "next/link";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";
import { loadPriorYearDebt } from "@/lib/prior-year-debt";

export const dynamic = "force-dynamic";

type SearchParams = { since?: string };

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseISODateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

export default async function PriorYearsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const activeYear = await getActiveYear();

  // Default season start = 1 June of the current calendar year (the summer
  // collection push for the upcoming school year).
  const now = new Date();
  const defaultSince = new Date(now.getFullYear(), 5, 1);
  const since = parseISODateLocal(sp.since) ?? defaultSince;
  const sinceStr = iso(since);

  const report = await loadPriorYearDebt({ activeYear, since });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/payments" className="hover:underline">
            תשלומים
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          גביית שנים קודמות
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          חוב פתוח משנים קודמות, וכמה ממנו נגבה מאז{" "}
          <b>{since.toLocaleDateString("he-IL")}</b> — כלומר כסף שנכנס בעונה
          הנוכחית אך משלם על התחייבות של שנה קודמת. השנה הפעילה: {activeYear}.
        </p>
      </div>

      {/* Season-start picker */}
      <form
        method="GET"
        className="mb-6 bg-white rounded-xl card-shadow p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col text-xs">
          <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
            נגבה מתאריך
          </span>
          <input
            type="date"
            name="since"
            defaultValue={sinceStr}
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
        >
          החל
        </button>
      </form>

      {report.summaries.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-10 text-center">
          <p className="text-[var(--color-muted-foreground)]">
            אין חוב פתוח משנים קודמות.
          </p>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl card-shadow px-4 py-3 text-center">
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {formatILS(report.totals.outstanding)}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)] mt-1">
                חוב פתוח (שנים קודמות)
              </div>
            </div>
            <div className="bg-white rounded-xl card-shadow px-4 py-3 text-center">
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {formatILS(report.totals.collectedSince)}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)] mt-1">
                נגבה מאז {since.toLocaleDateString("he-IL")}
              </div>
            </div>
            <div className="bg-white rounded-xl card-shadow px-4 py-3 text-center">
              <div className="text-2xl font-bold text-[var(--color-primary)]">
                {formatNum(report.totals.studentsWithDebt)}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)] mt-1">
                תלמידים עם חוב פתוח
              </div>
            </div>
          </div>

          {/* Per-year breakdown */}
          {report.summaries.length > 1 && (
            <div className="mb-6 bg-white rounded-xl card-shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                    <th className="py-3 pe-5 ps-5 font-semibold">שנה</th>
                    <th className="py-3 px-4 font-semibold">תלמידים עם חוב</th>
                    <th className="py-3 px-4 font-semibold">חוב פתוח</th>
                    <th className="py-3 px-4 font-semibold">נגבה בעונה</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summaries.map((s) => (
                    <tr
                      key={s.year}
                      className="border-b border-[var(--color-border)]/50"
                    >
                      <td className="py-2.5 pe-5 ps-5 font-medium">{s.year}</td>
                      <td className="py-2.5 px-4">
                        {formatNum(s.studentsWithDebt)}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-accent)]">
                        {formatILS(s.outstandingTotal)}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-success)]">
                        {formatILS(s.collectedSince)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overpaid warning */}
          {report.overpaid.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
              <b>{formatNum(report.overpaid.length)} תלמידים בשנה הפעילה שולם
              להם ביתר</b> (יתכן ששילמו חוב ישן דרך ההו״ק החדשה):{" "}
              {report.overpaid
                .slice(0, 6)
                .map((o) => `${o.name} (+${formatILS(o.over)})`)
                .join(" · ")}
              {report.overpaid.length > 6 && " …"}
            </div>
          )}

          {/* Drill-down */}
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <div className="text-sm font-semibold text-[var(--color-primary)]">
                {formatNum(report.students.length)} תלמידים · חוב פתוח או גבייה
                בעונה
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                    <th className="py-3 pe-5 ps-5 font-semibold">בחור</th>
                    <th className="py-3 px-4 font-semibold">שנה</th>
                    <th className="py-3 px-4 font-semibold">מחיר</th>
                    <th className="py-3 px-4 font-semibold">שולם</th>
                    <th className="py-3 px-4 font-semibold">יתרה</th>
                    <th className="py-3 px-4 font-semibold">נגבה בעונה</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((s) => (
                    <tr
                      key={s.studentId}
                      className="border-b border-[var(--color-border)]/50"
                    >
                      <td className="py-2.5 pe-5 ps-5">
                        <Link
                          href={`/bachurim/${s.studentId}`}
                          className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                        >
                          {s.name}
                        </Link>
                        <div className="text-xs text-[var(--color-muted-foreground)] font-mono">
                          {s.code}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                        {s.year}
                      </td>
                      <td className="py-2.5 px-4">{formatILS(s.price)}</td>
                      <td className="py-2.5 px-4 text-[var(--color-success)]">
                        {formatILS(s.paid)}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-semibold ${
                          s.balance > 1
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-success)]"
                        }`}
                      >
                        {formatILS(s.balance)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                        {s.collectedSince > 0 ? formatILS(s.collectedSince) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
