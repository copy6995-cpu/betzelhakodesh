"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarWeekRow } from "@/lib/hebrew-calendar";
import { saveCalendarConfig, saveCalendarWeek } from "./actions";

const SUP_COUNT = 9;
const YESHIVA_COUNT = 5;

export type WeekValues = {
  yeshivot: string[];
  linaChul: string;
  linaAri: string;
  sup: { lina: string; kima: string }[];
};

function emptyValues(): WeekValues {
  return {
    yeshivot: Array(YESHIVA_COUNT).fill(""),
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
    yeshivot: base.yeshivot.map((_, i) => v.yeshivot?.[i] ?? ""),
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
  weeks,
  savedValues,
}: {
  yearLabel: string;
  startISO: string;
  endISO: string;
  supervisorNames: string[];
  weeks: CalendarWeekRow[];
  savedValues: Record<string, Partial<WeekValues>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("");

  // Mutable stores — typing updates refs (no re-render); blur persists.
  const valuesRef = useRef<Record<string, WeekValues>>(
    Object.fromEntries(
      weeks.map((w) => [w.weekKey, normalize(savedValues[w.weekKey])])
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

      <div className="bg-white rounded-xl card-shadow overflow-x-auto">
        <table className="text-sm border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-[var(--color-muted)] text-xs">
              <th rowSpan={2} className="sticky right-0 z-20 bg-[var(--color-muted)] py-2 px-2 border-e border-[var(--color-border)]">
                תאריך
              </th>
              <th rowSpan={2} className="py-2 px-2 border-e border-[var(--color-border)]">
                תאריך עברי
              </th>
              <th rowSpan={2} className="py-2 px-2 border-e border-[var(--color-border)]">
                פרשה
              </th>
              <th rowSpan={2} className="py-2 px-2 border-e-2 border-[var(--color-border)]">
                הערה
              </th>
              {Array.from({ length: YESHIVA_COUNT }, (_, i) => (
                <th key={i} rowSpan={2} className="py-2 px-2 font-normal">
                  ישיבה {i + 1}
                </th>
              ))}
              <th rowSpan={2} className="py-2 px-2 border-s border-[var(--color-border)] font-normal">
                לינה חו״ל
              </th>
              <th rowSpan={2} className="py-2 px-2 border-e-2 border-[var(--color-border)] font-normal">
                לינה אר״י
              </th>
              {Array.from({ length: SUP_COUNT }, (_, i) => (
                <th
                  key={i}
                  colSpan={2}
                  className="py-1 px-1 border-s border-[var(--color-border)] text-center"
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
                  <th className="py-1 px-1 border-s border-[var(--color-border)] font-normal">
                    לינה
                  </th>
                  <th className="py-1 px-1 font-normal">קימה</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const v = valuesRef.current[w.weekKey];
              return (
                <tr key={w.weekKey} className="border-t border-[var(--color-border)]/40">
                  <td className="sticky right-0 z-10 bg-white py-1 px-2 font-mono text-xs text-[var(--color-muted-foreground)] border-e border-[var(--color-border)]">
                    {w.greg}
                  </td>
                  <td className="py-1 px-2 text-xs border-e border-[var(--color-border)]">
                    {w.heb}
                  </td>
                  <td className="py-1 px-2 text-xs border-e border-[var(--color-border)]">
                    {w.parasha}
                  </td>
                  <td className="py-1 px-2 text-xs font-medium text-[var(--color-accent)] border-e-2 border-[var(--color-border)]">
                    {w.note}
                  </td>
                  {Array.from({ length: YESHIVA_COUNT }, (_, i) => (
                    <td key={i} className="p-0 border-s border-[var(--color-border)]/30">
                      <input
                        defaultValue={v.yeshivot[i]}
                        onChange={(e) => (v.yeshivot[i] = e.target.value)}
                        onBlur={() => saveWeek(w.weekKey)}
                        className={cellInput}
                      />
                    </td>
                  ))}
                  <td className="p-0 border-s border-[var(--color-border)]">
                    <input
                      defaultValue={v.linaChul}
                      onChange={(e) => (v.linaChul = e.target.value)}
                      onBlur={() => saveWeek(w.weekKey)}
                      className={cellInput}
                    />
                  </td>
                  <td className="p-0 border-e-2 border-[var(--color-border)]">
                    <input
                      defaultValue={v.linaAri}
                      onChange={(e) => (v.linaAri = e.target.value)}
                      onBlur={() => saveWeek(w.weekKey)}
                      className={cellInput}
                    />
                  </td>
                  {Array.from({ length: SUP_COUNT }, (_, i) => (
                    <Fragment key={i}>
                      <td className="p-0 border-s border-[var(--color-border)]">
                        <input
                          defaultValue={v.sup[i].lina}
                          onChange={(e) => (v.sup[i].lina = e.target.value)}
                          onBlur={() => saveWeek(w.weekKey)}
                          className={cellInput}
                        />
                      </td>
                      <td className="p-0 border-s border-[var(--color-border)]/30">
                        <input
                          defaultValue={v.sup[i].kima}
                          onChange={(e) => (v.sup[i].kima = e.target.value)}
                          onBlur={() => saveWeek(w.weekKey)}
                          className={cellInput}
                        />
                      </td>
                    </Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
