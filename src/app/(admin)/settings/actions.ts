"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function setActiveYear(year: string): Promise<void> {
  if (!year) throw new Error("שנה ריקה");
  await prisma.appSetting.upsert({
    where: { key: "active_year" },
    update: { value: year },
    create: { key: "active_year", value: year },
  });
  revalidatePath("/");
  revalidatePath("/bachurim");
  revalidatePath("/parents");
  revalidatePath("/settings");
}

export async function addYeshiva(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("שם ריק");
  const max = await prisma.yeshiva.aggregate({ _max: { displayOrder: true } });
  await prisma.yeshiva.create({
    data: {
      name: trimmed,
      displayOrder: (max._max.displayOrder ?? 0) + 1,
      active: true,
    },
  });
  revalidatePath("/settings/yeshivot");
}

export async function toggleYeshivaActive(id: string): Promise<void> {
  const y = await prisma.yeshiva.findUnique({ where: { id } });
  if (!y) throw new Error("ישיבה לא נמצאה");
  await prisma.yeshiva.update({
    where: { id },
    data: { active: !y.active },
  });
  revalidatePath("/settings/yeshivot");
}

export async function renameYeshiva(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("שם ריק");
  await prisma.yeshiva.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/settings/yeshivot");
}
