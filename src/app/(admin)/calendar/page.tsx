import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import {
  buildCalendarWeeks,
  defaultRangeForYear,
} from "@/lib/hebrew-calendar";
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

  const weeks = buildCalendarWeeks(range.start, range.end);

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

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          לוח שנה
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {weeks.length} שבתות · {yearLabel}. תאריך עברי, פרשה והערות השבת
          מחושבים אוטומטית. שאר העמודות נשמרות עם היציאה מהתא.
        </p>
      </div>

      <CalendarGrid
        yearLabel={yearLabel}
        startISO={isoOf(range.start)}
        endISO={isoOf(range.end)}
        supervisorNames={supervisorNames}
        weeks={weeks}
        savedValues={savedValues}
      />
    </div>
  );
}
