import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import {
  buildCalendarDays,
  defaultRangeForYear,
} from "@/lib/hebrew-calendar";
import {
  orderCalendarYeshivot,
  computeCalendarCounts,
} from "@/lib/calendar-export";
import { CalendarGrid, type WeekValues } from "./grid";

export const dynamic = "force-dynamic";

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function CalendarPage() {
  const yearLabel = await getActiveYear();

  const yeshivaRows = await prisma.yeshiva.findMany({
    where: { active: true },
    select: { name: true },
  });
  const yeshivot = orderCalendarYeshivot(yeshivaRows.map((y) => y.name));

  const config = await prisma.calendarConfig.findUnique({
    where: { yearLabel },
  });

  const range = config
    ? { start: config.startDate, end: config.endDate }
    : defaultRangeForYear(yearLabel);

  const supervisorNames: string[] = (() => {
    if (!config) return [];
    try {
      const arr = JSON.parse(config.supervisorNames);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();

  const days = buildCalendarDays(range.start, range.end);

  const savedRows = await prisma.calendarWeek.findMany({
    where: { yearLabel },
    select: { weekKey: true, values: true },
  });
  const savedValues: Record<string, Partial<WeekValues>> = {};
  for (const r of savedRows) {
    try {
      savedValues[r.weekKey] = JSON.parse(r.values);
    } catch {
      savedValues[r.weekKey] = {};
    }
  }

  const counts = computeCalendarCounts(
    days.map((d) => d.dayKey),
    savedValues,
    yeshivot
  );

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            לוח שנה
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            {days.length} ימים · {yearLabel}. תאריך עברי, יום, פרשה וחגים
            מחושבים אוטומטית. שאר העמודות נשמרות עם היציאה מהתא.
          </p>
        </div>
        <Link
          href={`/api/calendar/export?year=${encodeURIComponent(yearLabel)}`}
          className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
        >
          ↓ יצוא לאקסל
        </Link>
      </div>

      <CalendarGrid
        yearLabel={yearLabel}
        startISO={isoOf(range.start)}
        endISO={isoOf(range.end)}
        supervisorNames={supervisorNames}
        yeshivot={yeshivot}
        days={days}
        savedValues={savedValues}
        counts={counts}
      />
    </div>
  );
}
