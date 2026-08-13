"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { loadLevels, limitFor, saveLevels, type DutyLevel } from "@/lib/tornut";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const s = await auth();
  const u = s?.user as { role?: string } | undefined;
  if (!u || u.role !== "admin") throw new Error("אין הרשאה");
}

/** The logged-in yeshiva rep + the yeshiva they represent. */
async function requireYeshivaRep(): Promise<{ repId: string; yeshiva: string }> {
  const s = await auth();
  const u = s?.user as { role?: string; repId?: string | null } | undefined;
  if (!u?.repId || u.role !== "rep") throw new Error("אין הרשאה");
  const rep = await prisma.representative.findUnique({
    where: { id: u.repId },
    select: { kind: true, yeshiva: true },
  });
  if (!rep || rep.kind !== "yeshiva" || !rep.yeshiva)
    throw new Error("נציג ישיבה לא מוגדר");
  return { repId: u.repId, yeshiva: rep.yeshiva };
}

// ---- Admin: levels + Shabbatot ----

export async function saveLevelsAction(levels: DutyLevel[]): Promise<void> {
  await requireAdmin();
  const year = await getActiveYear();
  await saveLevels(year, levels);
  revalidatePath("/tornut");
}

export async function addShabbat(label: string, level: string): Promise<void> {
  await requireAdmin();
  const year = await getActiveYear();
  if (!label.trim()) return;
  const last = await prisma.dutyShabbat.findFirst({
    where: { year },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.dutyShabbat.create({
    data: {
      year,
      label: label.trim(),
      level: level.trim(),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/tornut");
}

export async function updateShabbat(
  id: string,
  fields: { label?: string; level?: string }
): Promise<void> {
  await requireAdmin();
  await prisma.dutyShabbat.update({
    where: { id },
    data: {
      ...(fields.label !== undefined ? { label: fields.label.trim() } : {}),
      ...(fields.level !== undefined ? { level: fields.level.trim() } : {}),
    },
  });
  revalidatePath("/tornut");
}

export async function deleteShabbat(id: string): Promise<void> {
  await requireAdmin();
  await prisma.dutyShabbat.delete({ where: { id } });
  revalidatePath("/tornut");
}

/** Admin override: set or clear the yeshiva on any slot (ignores the limit). */
export async function adminAssign(
  id: string,
  yeshiva: string | null
): Promise<void> {
  await requireAdmin();
  await prisma.dutyShabbat.update({
    where: { id },
    data: {
      assignedYeshiva: yeshiva && yeshiva.trim() ? yeshiva.trim() : null,
      assignedByRep: null,
    },
  });
  revalidatePath("/tornut");
}

// ---- Rep: claim / release ----

export async function claimShabbat(id: string): Promise<void> {
  const { repId, yeshiva } = await requireYeshivaRep();
  const shabbat = await prisma.dutyShabbat.findUnique({ where: { id } });
  if (!shabbat) throw new Error("השבת לא נמצאה");
  if (shabbat.assignedYeshiva) throw new Error("השבת כבר תפוסה");

  const levels = await loadLevels(shabbat.year);
  const limit = limitFor(levels, shabbat.level);
  if (limit != null) {
    const held = await prisma.dutyShabbat.count({
      where: { year: shabbat.year, level: shabbat.level, assignedYeshiva: yeshiva },
    });
    if (held >= limit)
      throw new Error("הישיבה כבר בחרה את המקסימום המותר ברמה זו");
  }

  await prisma.dutyShabbat.update({
    where: { id },
    // Guard against a race: only claim if still open.
    data: { assignedYeshiva: yeshiva, assignedByRep: repId },
  });
  revalidatePath("/tornut");
}

export async function releaseShabbat(id: string): Promise<void> {
  const { repId, yeshiva } = await requireYeshivaRep();
  const shabbat = await prisma.dutyShabbat.findUnique({ where: { id } });
  if (!shabbat) return;
  // A rep may only release a slot their own yeshiva holds.
  if (shabbat.assignedYeshiva !== yeshiva && shabbat.assignedByRep !== repId)
    throw new Error("אפשר לשחרר רק בחירה של הישיבה שלך");
  await prisma.dutyShabbat.update({
    where: { id },
    data: { assignedYeshiva: null, assignedByRep: null },
  });
  revalidatePath("/tornut");
}
