import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { formatNum } from "@/lib/utils";
import { ImportForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [activeYear, availableYears] = await Promise.all([
    getActiveYear(),
    getAvailableYears(),
  ]);

  const counts = await Promise.all(
    availableYears.map(async (y) => ({
      year: y,
      students: await prisma.student.count({ where: { year: y } }),
    }))
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/settings" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
          → הגדרות
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          ייבוא מאקסל
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          העלאה של קובץ <code>xlsx</code> עם גיליון <code>כל הבחורים</code>.
          המערכת מזהה את העמודות אוטומטית לפי הכותרות.
        </p>
      </div>

      {counts.length > 0 && (
        <section className="bg-white rounded-xl card-shadow p-5 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
            מצב נוכחי
          </h2>
          <ul className="space-y-1 text-sm">
            {counts.map((c) => (
              <li key={c.year} className="flex items-center justify-between">
                <span className="font-medium">{c.year}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  {formatNum(c.students)} תלמידים
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ImportForm activeYear={activeYear} availableYears={availableYears} />

      <section className="mt-6 bg-[var(--color-muted)] rounded-xl p-5 text-sm space-y-4">
        <div>
          <h2 className="font-semibold text-[var(--color-primary)] mb-2">
            עמודות מזוהות
          </h2>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            המערכת מזהה את העמודות לפי שם הכותרת (שורה 1 בגיליון). סדר
            העמודות לא חשוב. הכותרות המקובלות:
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-[var(--color-muted-foreground)]">
            <span>קוד התלמיד / קוד אישי</span>
            <span>שם הבחור / שם פרטי</span>
            <span>משפחה / שם משפחה</span>
            <span>שם האב</span>
            <span>עיר</span>
            <span>שיעור</span>
            <span>ישיבה</span>
            <span>מסלול / חו&quot;ל/אר&quot;י</span>
            <span>תוקף / קהילה / סניף</span>
            <span>קוד ישיבה</span>
            <span>טלפון (בית)</span>
            <span>פלאפון (אב)</span>
            <span>פלאפון אם</span>
            <span>מייל</span>
            <span>מחיר <i>(אופציונלי)</i></span>
            <span>הוראת קבע / הוק <i>(אופציונלי)</i></span>
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-[var(--color-primary)] mb-2">שימו לב</h2>
          <ul className="space-y-1 text-[var(--color-muted-foreground)] list-disc ps-5">
            <li>
              במצב <b>החלפה</b>, כל התלמידים ותשלומיהם באותה שנה יימחקו
              ויוחלפו בחדשים מהקובץ. הוקים ורישום לאשל יאבדו — יש להריץ שוב
              &quot;שייך עכשיו&quot; בטפסים אחרי הייבוא.
            </li>
            <li>
              <b>הורים לא נמחקים</b> — הם נשמרים בין שנים ומחוברים לתלמידים
              לפי שם האב + משפחה. אם ההורה קיים כבר במאגר, טלפונים ומייל
              חסרים יושלמו — קיימים לא יידרסו.
            </li>
            <li>שורות ללא שם פרטי ושם משפחה יידלגו אוטומטית.</li>
            <li>
              קודים אישיים באורך 6 ספרות יישמרו. חסרים או קצרים יקבלו קוד
              חדש.
            </li>
            <li>
              אם יש עמודות מחיר או תשלומים בקובץ (הפורמט הישן) הן יטופלו
              אוטומטית. אם אין, ייבוא הרוסטר לבד.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
