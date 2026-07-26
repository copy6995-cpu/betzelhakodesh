"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewPromotion,
  promoteToYear,
  setActiveYear,
} from "@/app/(admin)/settings/actions";

const KNOWN_YEARS = ['תשפ"ו', 'תשפ"ז', 'תשפ"ח', 'תשפ"ט'];

type Preview = {
  eligible: number;
  skippedArchived: number;
  skippedYeshiva: number;
  stayingAtT: number;
};

export function YearSwitcher({
  activeYear,
  availableYears,
}: {
  activeYear: string;
  availableYears: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // If the user picks a year that doesn't yet have students, we pause and
  // open a confirmation dialog offering to bulk-promote from the current
  // active year. `newYear` is set only while that dialog is open.
  const [newYear, setNewYear] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options = Array.from(new Set([...availableYears, ...KNOWN_YEARS])).filter(
    (y) => y !== activeYear
  );

  function pick(year: string) {
    setOpen(false);
    const isNew = !availableYears.includes(year);
    if (isNew) {
      // Load the preview counts and open the promotion dialog.
      setNewYear(year);
      setPreview(null);
      startTransition(async () => {
        const p = await previewPromotion(activeYear);
        setPreview(p);
      });
      return;
    }
    // Existing year — just switch immediately.
    startTransition(async () => {
      await setActiveYear(year);
      router.refresh();
    });
  }

  function confirmPromote() {
    if (!newYear) return;
    const target = newYear;
    setNewYear(null);
    setPreview(null);
    startTransition(async () => {
      await promoteToYear(activeYear, target);
      await setActiveYear(target);
      router.refresh();
    });
  }

  function confirmEmpty() {
    if (!newYear) return;
    const target = newYear;
    setNewYear(null);
    setPreview(null);
    startTransition(async () => {
      await setActiveYear(target);
      router.refresh();
    });
  }

  function cancelNewYear() {
    setNewYear(null);
    setPreview(null);
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-white/20 bg-white/5 text-sm text-white/80 hover:text-white hover:border-white/40 hover:bg-white/10 transition-colors disabled:opacity-60"
        >
          <span className="text-xs text-white/60">שנה פעילה:</span>
          <span className="font-semibold text-white">
            {pending ? "..." : activeYear}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 6"
            fill="none"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-white shadow-xl border border-[var(--color-border)] overflow-hidden z-50">
            <div className="py-1">
              <div className="px-3 py-1.5 text-xs text-[var(--color-muted-foreground)]">
                בחר שנה פעילה
              </div>
              {options.map((y) => {
                const isExisting = availableYears.includes(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => pick(y)}
                    className="w-full text-right px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)] flex items-center justify-between"
                  >
                    <span className="font-medium">{y}</span>
                    {!isExisting && (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        (חדש)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {newYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-1">
              יצירת שנה חדשה: {newYear}
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
              משנת <b>{activeYear}</b> ל-<b>{newYear}</b>. שיעור יעלה מעלה
              (א→ב, ב→ג, וכו&apos;). תלמידי <b>ט</b> יישארו ב-ט.
              תלמידים ב-<b>ארכיון</b> וב-<b>&quot;שיעור א&apos; - לא
              שובץ&quot;</b> לא יועברו (נשארים במאגר בשנה הישנה).
            </p>

            {preview === null ? (
              <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-muted-foreground)] mb-4">
                טוען נתונים...
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3 text-sm mb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span>יועברו:</span>
                  <span className="font-semibold text-[var(--color-primary)]">
                    {preview.eligible.toLocaleString("he-IL")} בחורים
                  </span>
                </div>
                {preview.stayingAtT > 0 && (
                  <div className="flex items-center justify-between text-[var(--color-muted-foreground)] text-xs">
                    <span>מתוכם ב-ט (יישארו בשיעור ט):</span>
                    <span>{preview.stayingAtT}</span>
                  </div>
                )}
                {preview.skippedYeshiva > 0 && (
                  <div className="flex items-center justify-between text-[var(--color-muted-foreground)] text-xs">
                    <span>ארכיון / שיעור א&apos; - לא שובץ (נשארים בשנה הישנה):</span>
                    <span>{preview.skippedYeshiva}</span>
                  </div>
                )}
                {preview.skippedArchived > 0 && (
                  <div className="flex items-center justify-between text-[var(--color-muted-foreground)] text-xs">
                    <span>מסומנים כמאורכבים:</span>
                    <span>{preview.skippedArchived}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                type="button"
                onClick={cancelNewYear}
                className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmEmpty}
                disabled={pending}
                className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
              >
                שנה ריקה
              </button>
              <button
                type="button"
                onClick={confirmPromote}
                disabled={pending || preview === null || preview.eligible === 0}
                className="px-4 h-9 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {pending ? "מעביר..." : "כן, העבר תלמידים"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
