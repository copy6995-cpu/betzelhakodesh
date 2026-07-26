"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachFormsNow } from "@/app/(admin)/settings/nedarim/actions";
import type { AttachResult } from "@/lib/form-attachment";

export function AttachButton({ tofesId }: { tofesId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AttachResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setErr(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await attachFormsNow(tofesId ?? undefined);
        setResult(r);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {pending ? "משייך..." : "שייך עכשיו לתלמידים"}
      </button>
      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5 max-w-xs">
          {err}
        </div>
      )}
      {result && (
        <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 max-w-sm">
          <div>
            <b>{result.scanned}</b> טפסים · <b>{result.matched}</b> תלמידים אותרו
            {result.unmatched > 0 && ` · ${result.unmatched} לא נמצאו`}
          </div>
          <div className="mt-0.5">
            {result.hookSet} הוקים חדשים · {result.hookChanged} עודכנו ·{" "}
            {result.eshelFlipped} רשמו לאשל
          </div>
          {result.datesBackfilled > 0 && (
            <div className="mt-0.5 text-emerald-700">
              {result.datesBackfilled} תאריכים הושלמו (backfill)
            </div>
          )}
          {result.kevaDashesStripped > 0 && (
            <div className="mt-0.5 text-emerald-700">
              {result.kevaDashesStripped} מקפים הוסרו מהוקים
            </div>
          )}
          {result.misattributionsFixed > 0 && (
            <div className="mt-0.5 text-emerald-700">
              {result.misattributionsFixed} הוקים שגויים נוקו משנה לא נכונה
            </div>
          )}
          {result.perYear.length > 1 && (
            <div className="mt-2 pt-2 border-t border-green-200 space-y-0.5">
              <div className="text-[10px] uppercase opacity-70">פירוק לפי שנה</div>
              {result.perYear.map((y) => (
                <div key={y.year} className="flex justify-between gap-3">
                  <span className="font-semibold">{y.year}</span>
                  <span>
                    {y.matched}/{y.scanned}
                    {y.unmatched > 0 && ` (${y.unmatched} לא נמצאו)`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
