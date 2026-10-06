import { cache } from "react";
import { prisma } from "./prisma";

/**
 * Resolve the active school year. Priority:
 *   1. explicit override (e.g. search param)
 *   2. AppSetting "active_year" (mutable via /settings)
 *   3. ENV ACTIVE_YEAR
 *   4. fallback 'תשפ"ו'
 *
 * Wrapped in React `cache()` so the many callers in a single render (header +
 * page + helpers) share one DB lookup instead of each firing their own.
 */
export const getActiveYear = cache(async function getActiveYear(
  override?: string | null
): Promise<string> {
  if (override && override.trim()) return override.trim();
  const setting = await prisma.appSetting.findUnique({ where: { key: "active_year" } });
  if (setting?.value) return setting.value;
  return process.env.ACTIVE_YEAR ?? 'תשפ"ו';
});

/** Unique set of years currently in the DB (for year-selector dropdown). */
export const getAvailableYears = cache(async function getAvailableYears(): Promise<
  string[]
> {
  const rows = await prisma.student.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year);
});
