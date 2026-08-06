"use client";

import { useMemo, useState, useTransition } from "react";
import { addManualBedReservationsBatch } from "./actions";

export type RosterEntry = { code: string; name: string; yeshiva: string };
export type WeekOption = {
  weekKey: string;
  label: string;
  date: string | null;
  hebDate: string | null;
};

/**
 * "רישום ידני" — add bed bookings for students who didn't come through the
 * phone system. Accepts several personal codes at once (one per line / comma /
 * space) for a chosen existing week. Manual entries survive syncs.
 */
export function ManualBedButton({
  roster,
  weeks,
}: {
  roster: RosterEntry[];
  weeks: WeekOption[];
}) {
  const [open, setOpen] = useState(false);
  const [codesText, setCodesText] = useState("");
  const [weekKey, setWeekKey] = useState(weeks[weeks.length - 1]?.weekKey ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    skipped: string[];
  } | null>(null);
  const [pending, start] = useTransition();

  const codes = useMemo(
    () => [
      ...new Set(
        codesText
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ],
    [codesText]
  );
  const rosterCodes = useMemo(() => new Set(roster.map((r) => r.code)), [roster]);
  const matchedCount = codes.filter((c) => rosterCodes.has(c)).length;

  function submit() {
    setErr(null);
    setResult(null);
    if (codes.length === 0) {
      setErr("הזן קוד אישי אחד או יותר");
      return;
    }
    const w = weeks.find((x) => x.weekKey === weekKey);
    if (!w) {
      setErr("בחר שבוע");
      return;
    }
    start(async () => {
      const r = await addManualBedReservationsBatch({
        codes,
        weekKey: w.weekKey,
        date: w.date,
        hebDate: w.hebDate,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setResult({ added: r.added, skipped: r.skipped });
      // Keep only the codes that didn't take, for an easy retry/correction.
      setCodesText(r.skipped.join("\n"));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setResult(null);
          setOpen(true);
        }}
        disabled={weeks.length === 0}
        className="inline-flex items-center px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
        title={weeks.length === 0 ? "אין שבועות — סנכרן קודם" : undefined}
      >
        + רישום ידני
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            dir="rtl"
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-primary)] mb-1">
              רישום מיטה ידני
            </h2>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
              מסמן תלמידים כמי שהזמינו מיטה לשבוע שנבחר. אפשר להזין{" "}
              <b>כמה קודים אישיים בבת אחת</b> (שורה, פסיק או רווח בין קוד לקוד).
              נשמר גם אחרי סנכרון.
            </p>

            <label className="block text-sm font-medium mb-1">
              קודים אישיים
              {codes.length > 0 && (
                <span className="font-normal text-[var(--color-muted-foreground)]">
                  {" · "}
                  {codes.length} קודים · {matchedCount} נמצאו
                </span>
              )}
            </label>
            <textarea
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
              placeholder={"123456\n234567\n…"}
              autoFocus
              rows={5}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm mb-4 font-mono"
            />

            <label className="block text-sm font-medium mb-1">שבוע</label>
            <select
              value={weekKey}
              onChange={(e) => setWeekKey(e.target.value)}
              className="w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm mb-4 bg-white"
            >
              {weeks.map((w) => (
                <option key={w.weekKey} value={w.weekKey}>
                  {w.label}
                </option>
              ))}
            </select>

            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            {result && (
              <div className="text-sm mb-3">
                <p className="text-green-700 font-medium">
                  ✓ נוספו {result.added} רישומים
                </p>
                {result.skipped.length > 0 && (
                  <p className="text-red-600 mt-1">
                    לא נמצאו במערכת ({result.skipped.length}):{" "}
                    {result.skipped.join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
              >
                סגור
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {pending ? "שומר…" : "הוסף"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
