/**
 * Excel export of the whole calendar board + a totals row. The totals count
 * FILLED cells per column (how many days each yeshiva / each supervisor
 * לינה/קימה is set) — same aggregation the on-screen summary row uses.
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { buildCalendarDays, defaultRangeForYear } from "./hebrew-calendar";

const SUP_COUNT = 9;
const EXCLUDED = new Set(["ארכיון", "שיעור א' - לא שובץ"]);
const PRIORITY = ["ברכת אהרן", "ירושלים"];

/** Active yeshivot minus the admin buckets, ordered ברכת אהרן, ירושלים, then
 *  the rest alphabetically. Shared by the calendar page and this export. */
export function orderCalendarYeshivot(activeNames: string[]): string[] {
  const names = activeNames.filter((n) => !EXCLUDED.has(n));
  return [
    ...PRIORITY.filter((p) => names.includes(p)),
    ...names
      .filter((n) => !PRIORITY.includes(n))
      .sort((a, b) => a.localeCompare(b, "he")),
  ];
}

type WeekValues = {
  yeshivot?: Record<string, string>;
  linaChul?: string;
  linaAri?: string;
  sup?: { lina: string; kima: string }[];
};

export type CalendarCounts = {
  yeshivot: Record<string, number>;
  linaChul: number;
  linaAri: number;
  sup: { lina: number; kima: number }[];
};

const filled = (s: string | undefined) => !!(s ?? "").trim();

export function computeCalendarCounts(
  dayKeys: string[],
  savedValues: Record<string, WeekValues>,
  yeshivot: string[]
): CalendarCounts {
  const counts: CalendarCounts = {
    yeshivot: Object.fromEntries(yeshivot.map((y) => [y, 0])),
    linaChul: 0,
    linaAri: 0,
    sup: Array.from({ length: SUP_COUNT }, () => ({ lina: 0, kima: 0 })),
  };
  for (const k of dayKeys) {
    const v = savedValues[k];
    if (!v) continue;
    for (const y of yeshivot) if (filled(v.yeshivot?.[y])) counts.yeshivot[y]++;
    if (filled(v.linaChul)) counts.linaChul++;
    if (filled(v.linaAri)) counts.linaAri++;
    for (let i = 0; i < SUP_COUNT; i++) {
      if (filled(v.sup?.[i]?.lina)) counts.sup[i].lina++;
      if (filled(v.sup?.[i]?.kima)) counts.sup[i].kima++;
    }
  }
  return counts;
}

export async function buildCalendarWorkbook(yearLabel: string): Promise<Buffer> {
  const [config, yeshivaRows, savedRows] = await Promise.all([
    prisma.calendarConfig.findUnique({ where: { yearLabel } }),
    prisma.yeshiva.findMany({ where: { active: true }, select: { name: true } }),
    prisma.calendarWeek.findMany({
      where: { yearLabel },
      select: { weekKey: true, values: true },
    }),
  ]);

  const yeshivot = orderCalendarYeshivot(yeshivaRows.map((y) => y.name));
  const supervisorNames: string[] = (() => {
    try {
      const a = JSON.parse(config?.supervisorNames ?? "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  })();
  const range = config
    ? { start: config.startDate, end: config.endDate }
    : defaultRangeForYear(yearLabel);
  const days = buildCalendarDays(range.start, range.end);
  const savedValues: Record<string, WeekValues> = {};
  for (const r of savedRows) {
    try {
      savedValues[r.weekKey] = JSON.parse(r.values);
    } catch {
      savedValues[r.weekKey] = {};
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("לוח שנה", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, rightToLeft: true }],
  });

  const supHeaders: string[] = [];
  for (let i = 0; i < SUP_COUNT; i++) {
    const name = (supervisorNames[i] ?? "").trim() || `משגיח ${i + 1}`;
    supHeaders.push(`${name} - לינה`, `${name} - קימה`);
  }
  const header = [
    "תאריך",
    "יום",
    "תאריך עברי",
    "פרשה",
    "הערה",
    ...yeshivot,
    "לינה חול",
    "לינה ארי",
    ...supHeaders,
  ];
  ws.addRow(header).font = { bold: true };

  for (const d of days) {
    const v = savedValues[d.dayKey] ?? {};
    const supVals: string[] = [];
    for (let i = 0; i < SUP_COUNT; i++) {
      supVals.push(v.sup?.[i]?.lina ?? "", v.sup?.[i]?.kima ?? "");
    }
    ws.addRow([
      d.greg,
      d.dayName,
      d.heb,
      d.parasha,
      d.note,
      ...yeshivot.map((y) => v.yeshivot?.[y] ?? ""),
      v.linaChul ?? "",
      v.linaAri ?? "",
      ...supVals,
    ]);
  }

  const counts = computeCalendarCounts(
    days.map((d) => d.dayKey),
    savedValues,
    yeshivot
  );
  const supCounts: (number | string)[] = [];
  for (let i = 0; i < SUP_COUNT; i++) {
    supCounts.push(counts.sup[i].lina || "", counts.sup[i].kima || "");
  }
  ws.addRow([
    "סיכום",
    "",
    "",
    "",
    "",
    ...yeshivot.map((y) => counts.yeshivot[y] || ""),
    counts.linaChul || "",
    counts.linaAri || "",
    ...supCounts,
  ]).font = { bold: true };

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 18;
  for (let i = 6; i <= header.length; i++) ws.getColumn(i).width = 11;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
