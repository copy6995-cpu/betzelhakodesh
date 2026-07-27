"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEndDate } from "./actions";

type Season = { label: string; date: string | null };

/**
 * Editable cutoff date per season for the active year. Changing a date
 * auto-saves and (via revalidate) updates every registered-count downstream —
 * once a season's date passes, its bachurim drop out of "רשום באש"ל".
 */
export function EndDatesEditor({
  year,
  seasons,
}: {
  year: string;
  seasons: Season[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onChange(label: string, value: string) {
    setError(null);
    startTransition(async () => {
      try {
        await saveEndDate(year, label, value || null);
        setSavedLabel(label);
        router.refresh();
        setTimeout(() => setSavedLabel((l) => (l === label ? null : l)), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשמירה");
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
        תאריך סיום לכל עונה בשנת <b>{year}</b>. בתאריך שנבחר (ואילך) תלמיד
        הרשום &quot;עד&quot; אותה עונה מפסיק להיחשב רשום באש&quot;ל — בכל
        הספירות, הסינונים והדוחות. עונה בלי תאריך נשארת פעילה.
      </p>
      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <th className="py-2 pe-4 font-semibold">עונה</th>
              <th className="py-2 px-4 font-semibold">תאריך סיום</th>
              <th className="py-2 px-4 font-semibold w-24"></th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr
                key={s.label}
                className="border-b border-[var(--color-border)]/50"
              >
                <td className="py-2.5 pe-4 font-medium">{s.label}</td>
                <td className="py-2.5 px-4">
                  <input
                    type="date"
                    defaultValue={s.date ?? ""}
                    disabled={pending}
                    onChange={(e) => onChange(s.label, e.target.value)}
                    className="px-3 h-9 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 disabled:opacity-50"
                  />
                </td>
                <td className="py-2.5 px-4 text-xs">
                  {savedLabel === s.label ? (
                    <span className="text-[var(--color-success)]">✓ נשמר</span>
                  ) : s.date ? (
                    <span className="text-[var(--color-muted-foreground)]">
                      פעיל
                    </span>
                  ) : (
                    <span className="text-[var(--color-muted-foreground)]">
                      ללא הגבלה
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
