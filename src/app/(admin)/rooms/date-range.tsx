"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const isoDate = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate()
  ).padStart(2, "0")}`;

/** From/to date-range picker for the rooms demand table. Filters by the Yemot
 *  reservation date, same as the weekly-registrations page. */
export function RoomsDateRange({
  from: initialFrom,
  to: initialTo,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function apply(f = from, t = to) {
    const qs = new URLSearchParams();
    if (f) qs.set("from", f);
    if (t) qs.set("to", t);
    router.push(`/rooms?${qs.toString()}`);
  }

  function thisWeek() {
    const t = new Date();
    const d = new Date(t);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    d.setHours(0, 0, 0, 0);
    const f = isoDate(d);
    const tt = isoDate(t);
    setFrom(f);
    setTo(tt);
    apply(f, tt);
  }

  function lastDays(n: number) {
    const t = new Date();
    const d = new Date(t);
    d.setDate(d.getDate() - (n - 1));
    const f = isoDate(d);
    const tt = isoDate(t);
    setFrom(f);
    setTo(tt);
    apply(f, tt);
  }

  const btn =
    "px-3 h-8 rounded-md border border-[var(--color-border)] text-xs hover:bg-[var(--color-muted)]";

  return (
    <div className="mb-4 bg-white rounded-xl card-shadow p-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs">
        <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
          מתאריך
        </span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
          עד תאריך
        </span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() => apply()}
        className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
      >
        הצג
      </button>
      <div className="flex flex-wrap gap-2 items-center ms-auto">
        <button type="button" onClick={thisWeek} className={btn}>
          השבוע
        </button>
        <button type="button" onClick={() => lastDays(7)} className={btn}>
          7 ימים אחרונים
        </button>
        <button type="button" onClick={() => lastDays(30)} className={btn}>
          30 ימים אחרונים
        </button>
      </div>
    </div>
  );
}
