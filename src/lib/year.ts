import { prisma } from "./prisma";

/**
 * Resolve the active school year. Priority:
 *   1. explicit override (e.g. search param)
 *   2. AppSetting "active_year" (mutable via /settings)
 *   3. ENV ACTIVE_YEAR
 *   4. fallback 'תשפ"ו'
 */
export async function getActiveYear(override?: string | null): Promise<string> {
  if (override && override.trim()) return override.trim();
  const setting = await prisma.appSetting.findUnique({ where: { key: "active_year" } });
  if (setting?.value) return setting.value;
  return process.env.ACTIVE_YEAR ?? 'תשפ"ו';
}

/** Unique set of years currently in the DB (for year-selector dropdown). */
export async function getAvailableYears(): Promise<string[]> {
  const rows = await prisma.student.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year);
}
