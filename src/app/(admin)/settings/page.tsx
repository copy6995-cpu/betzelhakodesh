import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { SettingsYearForm } from "./year-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [activeYear, availableYears, yeshivot, shiurim, endDates] = await Promise.all([
    getActiveYear(),
    getAvailableYears(),
    prisma.yeshiva.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.shiur.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.endDateOption.findMany({ orderBy: [{ year: "desc" }, { label: "asc" }] }),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-8">הגדרות</h1>

      <div className="space-y-6">
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
            תאריכי סיום (לפי שנה)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <th className="py-2 pe-4 font-semibold">שנה</th>
                  <th className="py-2 px-4 font-semibold">תווית</th>
                  <th className="py-2 px-4 font-semibold">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {endDates.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-border)]/50">
                    <td className="py-2 pe-4 font-medium">{e.year}</td>
                    <td className="py-2 px-4">{e.label}</td>
                    <td className="py-2 px-4 text-[var(--color-muted-foreground)]">
                      {e.date ? new Date(e.date).toLocaleDateString("he-IL") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
