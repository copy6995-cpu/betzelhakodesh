"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveYear } from "@/app/(admin)/settings/actions";

const KNOWN_YEARS = ['תשפ"ו', 'תשפ"ז', 'תשפ"ח', 'תשפ"ט'];

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

  // Close on outside click
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

  function select(year: string) {
    setOpen(false);
    startTransition(async () => {
      await setActiveYear(year);
      router.refresh();
    });
  }

  return (
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
        <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-white shadow-xl border border-[var(--color-border)] overflow-hidden z-50">
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
                  onClick={() => select(y)}
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
  );
}
