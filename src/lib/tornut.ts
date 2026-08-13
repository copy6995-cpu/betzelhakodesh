/**
 * Shabbat duty rotation (תורנות). The admin defines levels (רמות) with a
 * per-level pick limit, and a list of duty Shabbatot each tagged with a level.
 * A yeshiva rep claims open Shabbatot for their own yeshiva, bounded by the
 * limit of that level. Reps see the level but never the limit numbers.
 */
import { prisma } from "./prisma";

export type DutyLevel = { name: string; limit: number };

export type DutyRow = {
  id: string;
  label: string;
  level: string;
  assignedYeshiva: string | null;
  assignedByRep: string | null;
};

export type TornutData = {
  levels: DutyLevel[];
  rows: DutyRow[];
  /** counts[yeshiva][level] = Shabbatot that yeshiva already holds at a level. */
  counts: Record<string, Record<string, number>>;
};

const levelsKey = (year: string) => `duty_levels:${year}`;

export async function loadLevels(year: string): Promise<DutyLevel[]> {
  const s = await prisma.appSetting.findUnique({ where: { key: levelsKey(year) } });
  if (!s) return [];
  try {
    const a = JSON.parse(s.value);
    if (!Array.isArray(a)) return [];
    return a
      .map((x) => ({ name: String(x?.name ?? "").trim(), limit: Number(x?.limit) || 0 }))
      .filter((x) => x.name);
  } catch {
    return [];
  }
}

export async function saveLevels(year: string, levels: DutyLevel[]): Promise<void> {
  const clean = levels
    .map((l) => ({ name: String(l.name ?? "").trim(), limit: Math.max(0, Number(l.limit) || 0) }))
    .filter((l) => l.name);
  await prisma.appSetting.upsert({
    where: { key: levelsKey(year) },
    create: { key: levelsKey(year), value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
}

export function limitFor(levels: DutyLevel[], level: string): number | null {
  const l = levels.find((x) => x.name === level);
  return l ? l.limit : null; // null = no configured limit for this level
}

export async function loadTornut(year: string): Promise<TornutData> {
  const [levels, shabbatot] = await Promise.all([
    loadLevels(year),
    prisma.dutyShabbat.findMany({
      where: { year },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const counts: Record<string, Record<string, number>> = {};
  for (const s of shabbatot) {
    if (!s.assignedYeshiva) continue;
    const byLevel = (counts[s.assignedYeshiva] ??= {});
    byLevel[s.level] = (byLevel[s.level] ?? 0) + 1;
  }
  return {
    levels,
    rows: shabbatot.map((s) => ({
      id: s.id,
      label: s.label,
      level: s.level,
      assignedYeshiva: s.assignedYeshiva,
      assignedByRep: s.assignedByRep,
    })),
    counts,
  };
}
