"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNum } from "@/lib/utils";

type Result = {
  year: string;
  sheetName: string;
  rowsInSheet: number;
  studentsDeleted: number;
  parentsCreated: number;
  studentsCreated: number;
  studentsUpdated: number;
  paymentsCreated: number;
  rowsSkipped: number;
};

type Mode = "update-existing" | "replace-year" | "skip-if-any-exist";

export function ImportForm({
  activeYear,
  availableYears,
}: {
  activeYear: string;
  availableYears: string[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(activeYear);
  const [mode, setMode] = useState<Mode>("update-existing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const suggestions = Array.from(new Set(["תשפ\"ו", "תשפ\"ז", "תשפ\"ח", ...availableYears]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("בחר קובץ xlsx להעלאה");
      return;
    }
    if (!year.trim()) {
      setError("חסר שם שנה");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("year", year.trim());
      fd.set("mode", mode);
      const res = await fetch("/api/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "שגיאה בייבוא");
      }
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl card-shadow p-6 space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-900">
          <div className="font-semibold mb-2">✓ ייבוא הושלם בהצלחה</div>
          <ul className="space-y-0.5">
            <li>שנה: <b>{result.year}</b></li>
            <li>שורות בגיליון: {formatNum(result.rowsInSheet)}</li>
            {result.studentsDeleted > 0 && (
              <li>תלמידים שנמחקו (החלפה): {formatNum(result.studentsDeleted)}</li>
            )}
            <li>הורים חדשים: <b>{formatNum(result.parentsCreated)}</b></li>
            {result.studentsUpdated > 0 && (
              <li>תלמידים שעודכנו: <b>{formatNum(result.studentsUpdated)}</b></li>
            )}
            <li>תלמידים חדשים: <b>{formatNum(result.studentsCreated)}</b></li>
            <li>תשלומים שנוצרו: <b>{formatNum(result.paymentsCreated)}</b></li>
            <li>שורות שדולגו (ריקות/חסרות שם): {formatNum(result.rowsSkipped)}</li>
          </ul>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          קובץ Excel (.xlsx)
        </span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full mt-1 text-sm file:ms-0 file:me-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:text-white file:px-4 file:py-2 file:text-sm file:font-medium file:cursor-pointer hover:file:bg-[var(--color-primary-hover)]"
          required
        />
        {file && (
          <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            {file.name} · {formatNum(Math.round(file.size / 1024))} KB
          </div>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          שנה
        </span>
        <input
          list="year-import-options"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="block w-full mt-1 h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
        <datalist id="year-import-options">
          {suggestions.map((y) => (
            <option key={y} value={y} />
          ))}
        </datalist>
      </label>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
          אופן הייבוא
        </legend>
        <div className="space-y-2">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="update-existing"
              checked={mode === "update-existing"}
              onChange={() => setMode("update-existing")}
              className="mt-1"
            />
            <span>
              <b>עדכון בלבד (מומלץ)</b>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                מתאים כל שורה לתלמיד קיים (לפי קוד אישי, ואם אין — לפי שם ייחודי)
                ומעדכן רק את השדות שבקובץ. <b>לא מוחק</b> תשלומים, מיטות או חדרים.
                שורות ללא התאמה ייווצרו כתלמידים חדשים. שדה שריק בקובץ לא ידרוס
                ערך קיים.
              </div>
            </span>
          </label>
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="replace-year"
              checked={mode === "replace-year"}
              onChange={() => setMode("replace-year")}
              className="mt-1"
            />
            <span>
              <b>החלפה (Replace-year)</b>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                מוחק את כל התלמידים + תשלומיהם לשנה הנבחרת, ויוצר מחדש מהקובץ. מומלץ בייבוא ראשון ובסנכרון מחדש.
              </div>
            </span>
          </label>
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="skip-if-any-exist"
              checked={mode === "skip-if-any-exist"}
              onChange={() => setMode("skip-if-any-exist")}
              className="mt-1"
            />
            <span>
              <b>דילוג (Skip)</b>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                לא מייבא אם כבר יש תלמידים לשנה. שימושי לוודא שלא מיובאים נתונים בטעות.
              </div>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-6 h-11 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60"
        >
          {loading ? "מייבא... (עד דקה)" : "התחל ייבוא"}
        </button>
      </div>
    </form>
  );
}
