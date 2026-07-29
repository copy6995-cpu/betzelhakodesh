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
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const sp = await searchParams;
  const activeYear = await getActiveYear(sp.year);
  const { rows, totals, crossGroupStudents, weeks, selectedWeek } =
    await loadBedGroupReport(activeYear, sp.week);

  const pct = (b: number, t: number) =>
    t === 0 ? "" : ` (${Math.round((b / t) * 100)}%)`;

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
                סכום סליקה
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
                  {formatNum(r.bookedThisWeek)} / {formatNum(r.subscribers)}
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
                {formatNum(totals.bookedThisWeek)} / {formatNum(totals.subscribers)}
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
        לשבוע שנבחר, מתוך כלל הקבועים. אדום = פחות מ-50%. סכום הסליקה = חיובי
        אשראי מאושרים בימות המשיח.
      </p>
    </div>
  );
}
