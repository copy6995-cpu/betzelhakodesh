"use client";

import { useMemo, useState, useTransition } from "react";
import { addManualBedReservation } from "./actions";

export type RosterEntry = { code: string; name: string; yeshiva: string };
export type WeekOption = {
  weekKey: string;
  label: string;
  date: string | null;
  hebDate: string | null;
};

/**
 * "רישום ידני" — add a bed booking for a student who didn't come through the
 * phone system. Picks an existing week (so the entry lands in a real column and
 * we never invent a mismatched week number) and any active-year student.
 */
export function ManualBedButton({
  roster,
  weeks,
}: {
  roster: RosterEntry[];
  weeks: WeekOption[];
}) {
  const [open, setOpen] = useState(false);
  const [studentText, setStudentText] = useState("");
  const [weekKey, setWeekKey] = useState(weeks[weeks.length - 1]?.weekKey ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = useMemo(
    () => roster.map((r) => ({ ...r, value: `${r.name} — ${r.code}` })),
    [roster]
  );

  function resolveStudent(): RosterEntry | null {
    const t = studentText.trim();
    if (!t) return null;
    // The datalist value is "name — code"; also accept a bare code or name.
    const byCode = roster.find((r) => r.code === t);
    if (byCode) return byCode;
    const trailing = t.match(/(\d{3,})\s*$/);
    if (trailing) {
      const m = roster.find((r) => r.code === trailing[1]);
      if (m) return m;
    }
    return roster.find((r) => r.name === t) ?? null;
  }

  function submit() {
    setErr(null);
    const s = resolveStudent();
    if (!s) {
      setErr("בחר תלמיד מהרשימה");
      return;
    }
    const w = weeks.find((x) => x.weekKey === weekKey);
    if (!w) {
      setErr("בחר שבוע");
      return;
    }
    start(async () => {
      const r = await addManualBedReservation({
        personalCode: s.code,
        name: s.name,
        weekKey: w.weekKey,
        date: w.date,
        hebDate: w.hebDate,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setStudentText("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr(null);
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
              מסמן את התלמיד כמי שהזמין מיטה לשבוע שנבחר. רישום ידני נשמר גם אחרי
              סנכרון.
            </p>

            <label className="block text-sm font-medium mb-1">תלמיד</label>
            <input
              list="manual-bed-roster"
              value={studentText}
              onChange={(e) => setStudentText(e.target.value)}
              placeholder="שם או קוד אישי…"
              autoFocus
              className="w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm mb-4"
            />
            <datalist id="manual-bed-roster">
              {options.map((o) => (
                <option key={o.code} value={o.value}>
                  {o.yeshiva}
                </option>
              ))}
            </datalist>

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

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
              >
                ביטול
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
