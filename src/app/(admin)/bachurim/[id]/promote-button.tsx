"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteStudentToYear } from "../actions";

/**
 * "העתק לשנה" — one-click duplicate the current student to another year,
 * keeping the same personalCode. The target year is user-picked — this
 * used to auto-target the "active year" but that hid the button whenever
 * the active year happened to be the student's own year, blocking the
 * common workflow of prepping next year's roster.
 */
export function PromoteStudentButton({
  studentId,
  currentYear,
  suggestedYears,
}: {
  studentId: string;
  currentYear: string;
  /** Years already known to the app (from AppSetting/other students), for
   *  a datalist. User can also type a fresh year. */
  suggestedYears: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(
    suggestedYears.find((y) => y !== currentYear) ?? ""
  );
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    const t = target.trim();
    if (!t) {
      setErr("בחר שנת יעד");
      return;
    }
    if (t === currentYear) {
      setErr("הבחור כבר קיים בשנה הזו");
      return;
    }
    if (!confirm(`להעתיק את הבחור ל-${t}? הקוד האישי יישמר.`)) return;
    setErr(null);
    startTransition(async () => {
      try {
        const r = await promoteStudentToYear(studentId, t);
        router.push(`/bachurim/${r.id}`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] flex items-center"
      >
        העתק לשנה
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5">
        <input
          list="promote-years"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder='תשפ"ז'
          className="w-28 h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
        />
        <datalist id="promote-years">
          {suggestedYears
            .filter((y) => y !== currentYear)
            .map((y) => (
              <option key={y} value={y} />
            ))}
        </datalist>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="px-3 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {pending ? "..." : "העתק"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 h-10 rounded-lg text-sm text-[var(--color-muted-foreground)] hover:text-red-600"
          title="בטל"
        >
          ✕
        </button>
      </div>
      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5">
          {err}
        </div>
      )}
    </div>
  );
}
