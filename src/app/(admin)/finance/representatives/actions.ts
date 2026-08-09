"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { parseAmounts } from "@/lib/reps";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

function revalidate() {
  revalidatePath("/finance/representatives");
  revalidatePath("/finance");
}

export async function addRep(name: string, yeshiva: string): Promise<void> {
  await requireUser();
  const year = await getActiveYear();
  if (!name.trim()) return;
  const last = await prisma.representative.findFirst({
    where: { year, kind: "yeshiva" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.representative.create({
    data: {
      year,
      kind: "yeshiva",
      name: name.trim(),
      yeshiva: yeshiva.trim() || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidate();
}

export async function updateRep(
  id: string,
  fields: { name?: string; yeshiva?: string; note?: string }
): Promise<void> {
  await requireUser();
  await prisma.representative.update({
    where: { id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name.trim() || "—" } : {}),
      ...(fields.yeshiva !== undefined
        ? { yeshiva: fields.yeshiva.trim() || null }
        : {}),
      ...(fields.note !== undefined ? { note: fields.note.trim() || null } : {}),
    },
  });
  // No revalidate: name/yeshiva edits are reflected locally; avoids a refresh
  // that would steal focus mid-typing.
}

export async function deleteRep(id: string): Promise<void> {
  await requireUser();
  await prisma.representative.delete({ where: { id } });
  revalidate();
}

/** Set one month's ₪ amount for a rep, merging into the JSON map. */
export async function setRepAmount(
  id: string,
  monthKey: string,
  amount: number
): Promise<void> {
  await requireUser();
  const rep = await prisma.representative.findUnique({
    where: { id },
    select: { amounts: true },
  });
  if (!rep) return;
  const amounts = parseAmounts(rep.amounts);
  const n = Number(amount) || 0;
  if (n) amounts[monthKey] = n;
  else delete amounts[monthKey];
  await prisma.representative.update({
    where: { id },
    data: { amounts: JSON.stringify(amounts) },
  });
  revalidate();
}
