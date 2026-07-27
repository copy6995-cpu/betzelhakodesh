import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { SettingsYearForm } from "./year-form";
import { EndDatesEditor } from "./end-dates-editor";
import { ensureEndDateOptions } from "./actions";
import { END_DATE_SEASONS, orderSeasons } from "@/lib/eshel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const activeYear = await getActiveYear();
  // Guarantee the active year always has its four season rows to edit.
  await ensureEndDateOptions(activeYear);

  const [availableYears, yeshivot, shiurim, endDates, studentLabelRows] =
    await Promise.all([
      getAvailableYears(),
      prisma.yeshiva.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.shiur.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.endDateOption.findMany({ orderBy: [{ year: "desc" }, { label: "asc" }] }),
      // Distinct season labels students in the active year are actually tagged
      // with — real data carries labels beyond the standard four (e.g. "תשרי").
      prisma.student.findMany({
        where: { year: activeYear, endDateLabel: { not: null } },
        select: { endDateLabel: true },
        distinct: ["endDateLabel"],
      }),
    ]);

  // Editable rows = union of standard seasons + labels students actually use +
  // labels that already have an option row, in chronological order.
  const activeYearOptions = endDates.filter((e) => e.year === activeYear);
  const unionLabels = orderSeasons([
    ...new Set([
      ...END_DATE_SEASONS,
      ...studentLabelRows.map((r) => r.endDateLabel!).filter(Boolean),
      ...activeYearOptions.map((o) => o.label),
    ]),
  ]);
  const activeSeasons = unionLabels.map((label) => {
    const row = activeYearOptions.find((e) => e.label === label);
    return {
      label,
      date: row?.date ? row.date.toISOString().slice(0, 10) : null,
    };
  });
  // Any other years with dates already set — shown read-only for reference.
  const otherYearDates = endDates.filter(
    (e) => e.year !== activeYear && e.date
  );

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-8">הגדרות</h1>

      <div className="space-y-6">
        <section className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-primary)]">
              ייבוא מאקסל
            </h2>
            <Link
              href="/settings/import"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              פתח ←
            </Link>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            העלאת קובץ <code>בצילא [שנה].xlsx</code> ליצירת/החלפת תלמידים ותשלומים.
          </p>
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-primary)]">
              נדרים פלוס
            </h2>
            <Link
              href="/settings/nedarim"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              פתח ←
            </Link>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            חיבור לAPI של נדרים פלוס: היסטוריית עסקאות אשראי + טפסים.
          </p>
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-primary)]">
              ימות המשיח
            </h2>
            <Link
              href="/settings/yemot"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              פתח ←
            </Link>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            סנכרון הזמנות מיטה מ-IVR ימות המשיח לפי שבוע ותלמיד.
          </p>
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
            שנה פעילה
          </h2>
          <SettingsYearForm activeYear={activeYear} availableYears={availableYears} />
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-primary)]">ישיבות</h2>
            <Link
              href="/settings/yeshivot"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              ניהול ←
            </Link>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {yeshivot.map((y) => (
              <li
                key={y.id}
                className={`px-3 py-2 rounded-md border ${
                  y.active
                    ? "border-[var(--color-border)] bg-[var(--color-muted)]"
                    : "border-[var(--color-border)] text-[var(--color-muted-foreground)] line-through"
                }`}
              >
                {y.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
            שיעורים
          </h2>
          <div className="flex flex-wrap gap-2">
            {shiurim.map((s) => (
              <span
                key={s.id}
                className="px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] text-sm"
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl card-shadow p-6">
          <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
            תאריכי סיום — {activeYear}
          </h2>
          <EndDatesEditor year={activeYear} seasons={activeSeasons} />

          {otherYearDates.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
                שנים קודמות
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {otherYearDates.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--color-border)]/40 text-[var(--color-muted-foreground)]"
                    >
                      <td className="py-1.5 pe-4 font-medium">{e.year}</td>
                      <td className="py-1.5 px-4">{e.label}</td>
                      <td className="py-1.5 px-4">
                        {e.date
                          ? new Date(e.date).toLocaleDateString("he-IL")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
