import Link from "next/link";
import { ImportUI } from "./ui";

export const dynamic = "force-dynamic";

export default function RoomsImportPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/rooms" className="hover:underline">
            חלוקת חדרים
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          ייבוא היסטוריה
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          העלה קובץ Excel עם שיבוצי חדרים היסטוריים כדי להזין אותם למאגר.
          שיבוצים קיימים באותו שבוע + חדר יידרסו.
        </p>
      </div>

      <section className="bg-white rounded-xl card-shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-3">
          פורמט הקובץ
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
          הקובץ יכול להיות בשתי צורות:
        </p>

        <div className="space-y-4 text-sm">
          <div>
            <div className="font-semibold text-[var(--color-primary)] mb-1">
              1. גיליון יחיד — רשימה שטוחה
            </div>
            <div className="text-[var(--color-muted-foreground)] mb-2">
              כותרות עמודות: <b>שבוע</b> · <b>חדר</b> · <b>ישיבה</b> · הערה
              (אופציונלי)
            </div>
            <div className="border border-[var(--color-border)] rounded overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-[var(--color-muted)]">
                  <tr>
                    <th className="py-1.5 px-3 text-right font-semibold">
                      שבוע
                    </th>
                    <th className="py-1.5 px-3 text-right font-semibold">
                      חדר
                    </th>
                    <th className="py-1.5 px-3 text-right font-semibold">
                      ישיבה
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--color-border)]/50">
                    <td className="py-1 px-3 font-mono">2026-07-13</td>
                    <td className="py-1 px-3 font-mono">א100</td>
                    <td className="py-1 px-3">ברכת אהרן</td>
                  </tr>
                  <tr className="border-t border-[var(--color-border)]/50">
                    <td className="py-1 px-3 font-mono">2026-07-13</td>
                    <td className="py-1 px-3 font-mono">א101</td>
                    <td className="py-1 px-3">חיפה</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-[var(--color-muted-foreground)] mt-2">
              תאריך שבוע יכול להיות <code>YYYY-MM-DD</code> או{" "}
              <code>dd/mm/yyyy</code>. המערכת תעגל אוטומטית ליום ראשון של השבוע.
            </div>
          </div>

          <div>
            <div className="font-semibold text-[var(--color-primary)] mb-1">
              2. מספר גיליונות — שם הגיליון הוא השבוע
            </div>
            <div className="text-[var(--color-muted-foreground)] mb-2">
              כל גיליון בשם התאריך של השבוע (למשל &quot;2026-07-13&quot;), בפנים
              רק שתי עמודות: <b>חדר</b> · <b>ישיבה</b>.
            </div>
          </div>
        </div>
      </section>

      <ImportUI />
    </div>
  );
}
