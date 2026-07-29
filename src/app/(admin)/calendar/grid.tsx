"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDayRow } from "@/lib/hebrew-calendar";
import type { CalendarCounts } from "@/lib/calendar-export";
import { saveCalendarConfig, saveCalendarWeek } from "./actions";

const SUP_COUNT = 9;

export type WeekValues = {
  /** Editable cell per yeshiva, keyed by yeshiva name. */
  yeshivot: Record<string, string>;
  linaChul: string;
  linaAri: string;
  sup: { lina: string; kima: string }[];
};

function emptyValues(): WeekValues {
  return {
    yeshivot: {},
    linaChul: "",
    linaAri: "",
    sup: Array.from({ length: SUP_COUNT }, () => ({ lina: "", kima: "" })),
  };
}

/** Merge a stored (possibly partial) value blob into a full-shape object. */
function normalize(v: Partial<WeekValues> | undefined): WeekValues {
  const base = emptyValues();
  if (!v) return base;
  return {
    // Guard against legacy array-shaped data — start fresh if so.
    yeshivot:
      v.yeshivot && !Array.isArray(v.yeshivot) ? { ...v.yeshivot } : {},
    linaChul: v.linaChul ?? "",
    linaAri: v.linaAri ?? "",
    sup: base.sup.map((_, i) => ({
      lina: v.sup?.[i]?.lina ?? "",
      kima: v.sup?.[i]?.kima ?? "",
    })),
  };
}

const cellInput =
  "w-full min-w-[64px] px-1.5 h-8 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-[var(--color-accent)]/50 rounded";

export function CalendarGrid({
  yearLabel,
  startISO,
  endISO,
  supervisorNames,
  yeshivot,
  days,
  savedValues,
  counts,
}: {
  yearLabel: string;
  startISO: string;
  endISO: string;
  supervisorNames: string[];
  yeshivot: string[];
  days: CalendarDayRow[];
  savedValues: Record<string, Partial<WeekValues>>;
  counts: CalendarCounts;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("");

  // Mutable stores — typing updates refs (no re-render); blur persists.
  const valuesRef = useRef<Record<string, WeekValues>>(
    Object.fromEntries(
      days.map((d) => [d.dayKey, normalize(savedValues[d.dayKey])])
    )
  );
  const rangeRef = useRef({ start: startISO, end: endISO });
  const namesRef = useRef<string[]>(
    Array.from({ length: SUP_COUNT }, (_, i) => supervisorNames[i] ?? "")
  );

  function flash(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 1500);
  }

  function saveWeek(weekKey: string) {
    startTransition(async () => {
      try {
        await saveCalendarWeek(yearLabel, weekKey, valuesRef.current[weekKey]);
        flash("נשמר");
      } catch {
        flash("שגיאה בשמירה");
      }
    });
  }

  function saveConfig(reloadHeaders = false) {
    startTransition(async () => {
      try {
        await saveCalendarConfig(
          yearLabel,
          rangeRef.current.start,
          rangeRef.current.end,
          namesRef.current
        );
        flash("נשמר");
        if (reloadHeaders) router.refresh();
      } catch {
        flash("שגיאה בשמירה");
      }
    });
  }

  return (
    <div>
      {/* Config bar: year range */}
      <div className="mb-4 bg-white rounded-xl card-shadow p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs">
          <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
            מתאריך
          </span>
          <input
            type="date"
            defaultValue={startISO}
            onChange={(e) => (rangeRef.current.start = e.target.value)}
            onBlur={() => saveConfig(true)}
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="text-[var(--color-muted-foreground)] font-semibold uppercase tracking-wider mb-1">
            עד תאריך
          </span>
          <input
            type="date"
            defaultValue={endISO}
            onChange={(e) => (rangeRef.current.end = e.target.value)}
            onBlur={() => saveConfig(true)}
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => saveConfig(true)}
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
        >
          עדכן טווח
        </button>
        <span className="text-xs text-[var(--color-muted-foreground)] pb-2">
          {pending ? "שומר…" : status}
        </span>
      </div>

      <div className="bg-white rounded-xl card-shadow overflow-auto max-h-[calc(100vh-14rem)]">
        {/* border-separate (not collapse) — collapse breaks position:sticky on
            <th> in Chromium, so the header wouldn't stay pinned on scroll. */}
        <table className="text-sm border-separate border-spacing-0 whitespace-nowrap">
          <thead>
            <tr className="bg-[var(--color-muted)] text-xs">
              <th rowSpan={2} className="sticky right-0 top-0 z-30 bg-[var(--color-muted)] w-[84px] min-w-[84px] py-2 px-2 border-e border-[var(--color-border)]">
                תאריך
              </th>
              <th rowSpan={2} className="sticky right-[84px] top-0 z-30 bg-[var(--color-muted)] w-[52px] min-w-[52px] py-2 px-2 border-e border-[var(--color-border)]">
                יום
              </th>
              <th rowSpan={2} className="sticky right-[136px] top-0 z-30 bg-[var(--color-muted)] w-[100px] min-w-[100px] py-2 px-2 border-e border-[var(--color-border)]">
                תאריך עברי
              </th>
              <th rowSpan={2} className="sticky right-[236px] top-0 z-30 bg-[var(--color-muted)] w-[80px] min-w-[80px] py-2 px-2 border-e border-[var(--color-border)]">
                פרשה
              </th>
              <th rowSpan={2} className="sticky right-[316px] top-0 z-30 bg-[var(--color-muted)] w-[150px] min-w-[150px] py-2 px-2 border-e-2 border-[var(--color-border)]">
                הערה
              </th>
              {yeshivot.map((name) => (
                <th key={name} rowSpan={2} className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 font-normal whitespace-nowrap">
                  {name}
                </th>
              ))}
              <th rowSpan={2} className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 border-s border-[var(--color-border)] font-normal">
                לינה חו״ל
              </th>
              <th rowSpan={2} className="sticky top-0 z-20 bg-[var(--color-muted)] py-2 px-2 border-e-2 border-[var(--color-border)] font-normal">
                לינה אר״י
              </th>
              {Array.from({ length: SUP_COUNT }, (_, i) => (
                <th
                  key={i}
                  colSpan={2}
                  className="sticky top-0 z-20 bg-[var(--color-muted)] h-9 py-1 px-1 border-s border-[var(--color-border)] text-center"
                >
                  <input
                    defaultValue={supervisorNames[i] ?? ""}
                    placeholder={`משגיח ${i + 1}`}
                    onChange={(e) => (namesRef.current[i] = e.target.value)}
                    onBlur={() => saveConfig(true)}
                    className="w-full min-w-[90px] px-1 h-7 text-xs text-center border border-[var(--color-border)] rounded bg-white"
                  />
                </th>
              ))}
            </tr>
            <tr className="bg-[var(--color-muted)] text-[10px] text-[var(--color-muted-foreground)]">
              {Array.from({ length: SUP_COUNT }, (_, i) => (
                <Fragment key={i}>
                  <th className="sticky top-9 z-20 bg-[var(--color-muted)] h-6 py-1 px-1 border-s border-[var(--color-border)] font-normal">
                    לינה
                  </th>
                  <th className="sticky top-9 z-20 bg-[var(--color-muted)] h-6 py-1 px-1 font-normal">קימה</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const v = valuesRef.current[d.dayKey];
              const rowBg = d.isYomTov
                ? "bg-amber-50"
                : d.isShabbat
                ? "bg-blue-50"
                : "";
              const stickyBg = d.isYomTov
                ? "bg-amber-50"
                : d.isShabbat
                ? "bg-blue-50"
                : "bg-white";
              const save = () => saveWeek(d.dayKey);
              return (
                <tr
                  key={d.dayKey}
                  className={`[&>td]:border-t [&>td]:border-[var(--color-border)]/40 ${rowBg}`}
                >
                  <td className={`sticky right-0 z-10 ${stickyBg} w-[84px] min-w-[84px] py-1 px-2 font-mono text-xs text-[var(--color-muted-foreground)] border-e border-[var(--color-border)]`}>
                    {d.greg}
                  </td>
                  <td className={`sticky right-[84px] z-10 ${stickyBg} w-[52px] min-w-[52px] py-1 px-2 text-xs border-e border-[var(--color-border)]`}>
                    {d.dayName}
                  </td>
                  <td className={`sticky right-[136px] z-10 ${stickyBg} w-[100px] min-w-[100px] py-1 px-2 text-xs border-e border-[var(--color-border)]`}>
                    {d.heb}
                  </td>
                  <td className={`sticky right-[236px] z-10 ${stickyBg} w-[80px] min-w-[80px] py-1 px-2 text-xs border-e border-[var(--color-border)]`}>
                    {d.parasha}
                  </td>
                  <td className={`sticky right-[316px] z-10 ${stickyBg} w-[150px] min-w-[150px] py-1 px-2 text-xs font-medium text-[var(--color-accent)] border-e-2 border-[var(--color-border)] whitespace-normal break-words leading-tight`}>
                    {d.note}
                  </td>
                  {yeshivot.map((name) => (
                    <td key={name} className="p-0 border-s border-[var(--color-border)]/30">
                      <input
                        defaultValue={v.yeshivot[name] ?? ""}
                        onChange={(e) => (v.yeshivot[name] = e.target.value)}
                        onBlur={save}
                        className={cellInput}
                      />
                    </td>
                  ))}
                  <td className="p-0 border-s border-[var(--color-border)]">
                    <input
                      defaultValue={v.linaChul}
                      onChange={(e) => (v.linaChul = e.target.value)}
                      onBlur={save}
                      className={cellInput}
                    />
                  </td>
                  <td className="p-0 border-e-2 border-[var(--color-border)]">
                    <input
                      defaultValue={v.linaAri}
                      onChange={(e) => (v.linaAri = e.target.value)}
                      onBlur={save}
                      className={cellInput}
                    />
                  </td>
                  {Array.from({ length: SUP_COUNT }, (_, i) => (
                    <Fragment key={i}>
                      <td className="p-0 border-s border-[var(--color-border)]">
                        <input
                          defaultValue={v.sup[i].lina}
                          onChange={(e) => (v.sup[i].lina = e.target.value)}
                          onBlur={save}
                          className={cellInput}
                        />
                      </td>
                      <td className="p-0 border-s border-[var(--color-border)]/30">
                        <input
                          defaultValue={v.sup[i].kima}
                          onChange={(e) => (v.sup[i].kima = e.target.value)}
                          onBlur={save}
                          className={cellInput}
                        />
                      </td>
                    </Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--color-primary)] text-white font-semibold text-xs">
              <td className="sticky right-0 bottom-0 z-30 bg-[var(--color-primary)] w-[84px] py-1.5 px-2 border-t-2 border-[var(--color-primary)]">
                סיכום
              </td>
              <td className="sticky right-[84px] bottom-0 z-30 bg-[var(--color-primary)] w-[52px] py-1.5 border-t-2 border-[var(--color-primary)]" />
              <td className="sticky right-[136px] bottom-0 z-30 bg-[var(--color-primary)] w-[100px] py-1.5 border-t-2 border-[var(--color-primary)]" />
              <td className="sticky right-[236px] bottom-0 z-30 bg-[var(--color-primary)] w-[80px] py-1.5 border-t-2 border-[var(--color-primary)]" />
              <td className="sticky right-[316px] bottom-0 z-30 bg-[var(--color-primary)] w-[150px] py-1.5 px-2 border-t-2 border-e-2 border-[var(--color-primary)] whitespace-nowrap">
                ימים מלאים
              </td>
              {yeshivot.map((name) => (
                <td key={name} className="sticky bottom-0 z-20 bg-[var(--color-primary)] py-1.5 px-2 text-center border-t-2 border-[var(--color-primary)]">
                  {counts.yeshivot[name] || ""}
                </td>
              ))}
              <td className="sticky bottom-0 z-20 bg-[var(--color-primary)] py-1.5 px-2 text-center border-t-2 border-[var(--color-primary)]">
                {counts.linaChul || ""}
              </td>
              <td className="sticky bottom-0 z-20 bg-[var(--color-primary)] py-1.5 px-2 text-center border-t-2 border-[var(--color-primary)]">
                {counts.linaAri || ""}
              </td>
              {Array.from({ length: SUP_COUNT }, (_, i) => (
                <Fragment key={i}>
                  <td className="sticky bottom-0 z-20 bg-[var(--color-primary)] py-1.5 px-1 text-center border-t-2 border-[var(--color-primary)]">
                    {counts.sup[i]?.lina || ""}
                  </td>
                  <td className="sticky bottom-0 z-20 bg-[var(--color-primary)] py-1.5 px-1 text-center border-t-2 border-[var(--color-primary)]">
                    {counts.sup[i]?.kima || ""}
                  </td>
                </Fragment>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
