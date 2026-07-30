import Link from "next/link";
import { formatNum, formatILS } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { loadBedGroupReport } from "@/lib/bed-groups";

export const dynamic = "force-dynamic";

/** Colour the week turnout by how many "regulars" actually booked. */
function turnoutTone(booked: number, total: number): string {
  if (total === 0) return "text-[var(--color-muted-foreground)]";
  const pct = booked / total;
  if (pct < 0.5) return "text-red-700 font-bold";
  if (pct < 0.75) return "text-amber-700 font-semibold";
  return "text-green-700";
}

export default async function BedGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string; detail?: string }>;
}) {
  const sp = await searchParams;
  const activeYear = await getActiveYear(sp.year);
  const {
    rows,
    totals,
    crossGroupStudents,
    weeks,
    selectedWeek,
    groups,
    detailGroup,
    weeklyDetail,
    detailTotals,
  } = await loadBedGroupReport(activeYear, sp.week, sp.detail);

  const pct = (b: number, t: number) =>
    t === 0 ? "" : ` (${Math.round((b / t) * 100)}%)`;
  const selectedLabel =
    weeks.find((w) => w.weekKey === selectedWeek)?.label ?? "";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/settings/yemot" className="hover:underline">
            ימות המשיח
          </Link>
          {" · "}
          <Link href="/yemot/beds" className="hover:underline">
            הזמנות מיטה
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          דוח קבוצות מיטה
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          לפי קבוצה (CutList8). כל תלמיד נספר פעם אחת — בקבוצה שבה הזמין הכי הרבה.
          {crossGroupStudents > 0 && (
            <>
              {" "}
              {formatNum(crossGroupStudents)} תלמידים הזמינו ביותר מקבוצה אחת
              ושויכו לקבוצתם העיקרית.
            </>
          )}
        </p>
      </div>

      {weeks.length > 0 && (
        <form method="GET" className="mb-4 flex items-end gap-2 flex-wrap">
          <label className="flex flex-col text-xs">
            <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
              נרשמו לשבוע
            </span>
            <select
              name="week"
              defaultValue={selectedWeek ?? ""}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
            >
              {weeks.map((w) => (
                <option key={w.weekKey} value={w.weekKey}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            הצג
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl card-shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-muted)] text-right">
              <th className="py-2.5 px-4 font-semibold">קבוצה</th>
              <th className="py-2.5 px-4 font-semibold text-center">תלמידים</th>
              <th className="py-2.5 px-4 font-semibold text-center">
                קבועים (אש״ל)
              </th>
              <th className="py-2.5 px-4 font-semibold text-center bg-[var(--color-accent)]/10">
                נרשמו השבוע
              </th>
              <th className="py-2.5 px-4 font-semibold text-center">לא מנויים</th>
              <th className="py-2.5 px-4 font-semibold text-center">
                לא ברשימה
              </th>
              <th className="py-2.5 px-4 font-semibold text-start">
                סליקה בשבוע
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.group}
                className="border-t border-[var(--color-border)]/50 hover:bg-[var(--color-muted)]/40"
              >
                <td className="py-2 px-4 font-semibold">{r.group}</td>
                <td className="py-2 px-4 text-center">
                  {formatNum(r.students)}
                </td>
                <td className="py-2 px-4 text-center text-green-700">
                  {formatNum(r.subscribers)}
                </td>
                <td
                  className={
                    "py-2 px-4 text-center bg-[var(--color-accent)]/5 " +
                    turnoutTone(r.bookedThisWeek, r.subscribers)
                  }
                >
                  {formatNum(r.bookedThisWeek)} מתוך {formatNum(r.subscribers)}
                  <span className="text-xs opacity-80">
                    {pct(r.bookedThisWeek, r.subscribers)}
                  </span>
                </td>
                <td className="py-2 px-4 text-center">
                  {formatNum(r.nonSubscribers)}
                </td>
                <td className="py-2 px-4 text-center text-[var(--color-muted-foreground)]">
                  {r.notInRoster ? formatNum(r.notInRoster) : "—"}
                </td>
                <td className="py-2 px-4 text-start font-mono">
                  {formatILS(r.payment)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--color-primary)] text-white font-bold">
              <td className="py-2.5 px-4">סה״כ (ללא כפילויות)</td>
              <td className="py-2.5 px-4 text-center">
                {formatNum(totals.students)}
              </td>
              <td className="py-2.5 px-4 text-center">
                {formatNum(totals.subscribers)}
              </td>
              <td className="py-2.5 px-4 text-center">
                {formatNum(totals.bookedThisWeek)} מתוך{" "}
                {formatNum(totals.subscribers)}
                <span className="text-xs opacity-80">
                  {pct(totals.bookedThisWeek, totals.subscribers)}
                </span>
              </td>
              <td className="py-2.5 px-4 text-center">
                {formatNum(totals.nonSubscribers)}
              </td>
              <td className="py-2.5 px-4 text-center">
                {totals.notInRoster ? formatNum(totals.notInRoster) : "—"}
              </td>
              <td className="py-2.5 px-4 text-start font-mono">
                {formatILS(totals.payment)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)] mt-3">
        &quot;נרשמו השבוע&quot; = כמה מהקבועים (רשומי אש״ל) בקבוצה הזמינו מיטה
        לשבוע שנבחר, מתוך כלל הקבועים. אדום = פחות מ-50%. &quot;סליקה בשבוע&quot;
        = סכום &quot;סכום לתשלום&quot; (חיוב המיטה) של הזמנות הקבוצה באותו שבוע.
      </p>

      {/* Weekly breakdown for one group (defaults to 23) — like the calendar. */}
      <div className="mt-10">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-[var(--color-primary)]">
            פירוט שבועי — קבוצה {detailGroup ?? ""}
          </h2>
          <form method="GET" className="flex items-end gap-2">
            {selectedWeek && (
              <input type="hidden" name="week" value={selectedWeek} />
            )}
            <label className="flex flex-col text-xs">
              <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
                קבוצה
              </span>
              <select
                name="detail"
                defaultValue={detailGroup ?? ""}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
              >
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
            >
              הצג
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl card-shadow overflow-x-auto max-w-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)] text-right">
                <th className="py-2.5 px-4 font-semibold">שבוע</th>
                <th className="py-2.5 px-4 font-semibold text-center">הזמנות</th>
                <th className="py-2.5 px-4 font-semibold text-start">
                  נכנס (סליקה)
                </th>
              </tr>
            </thead>
            <tbody>
              {weeklyDetail.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-4 px-4 text-center text-[var(--color-muted-foreground)]"
                  >
                    אין נתונים לקבוצה זו.
                  </td>
                </tr>
              ) : (
                weeklyDetail.map((w) => (
                  <tr
                    key={w.weekKey}
                    className={
                      "border-t border-[var(--color-border)]/50 hover:bg-[var(--color-muted)]/40 " +
                      (w.weekKey === selectedWeek ? "bg-[var(--color-accent)]/5" : "")
                    }
                  >
                    <td className="py-2 px-4 font-medium">{w.label}</td>
                    <td className="py-2 px-4 text-center">
                      {formatNum(w.bookings)}
                    </td>
                    <td className="py-2 px-4 text-start font-mono">
                      {w.payment ? formatILS(w.payment) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--color-primary)] text-white font-bold">
                <td className="py-2.5 px-4">סה״כ</td>
                <td className="py-2.5 px-4 text-center">
                  {formatNum(detailTotals.bookings)}
                </td>
                <td className="py-2.5 px-4 text-start font-mono">
                  {formatILS(detailTotals.payment)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)] mt-2">
          כמה הזמנות וכמה כסף (&quot;סכום לתשלום&quot;) נכנסו בכל שבוע לקבוצה
          שנבחרה. השבוע שנבחר למעלה מודגש.
        </p>
      </div>
    </div>
  );
}
