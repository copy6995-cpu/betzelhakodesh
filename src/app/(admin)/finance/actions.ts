"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

export type EntryInput = {
  kind: string; // "income" | "expense"
  category: string;
  label: string;
  amount: number;
  date: string | null; // yyyy-mm-dd
  meta?: Record<string, unknown> | null;
};

export async function addFinanceEntry(input: EntryInput): Promise<void> {
  await requireUser();
  const year = await getActiveYear();
  await prisma.financeEntry.create({
    data: {
      year,
      kind: input.kind === "income" ? "income" : "expense",
      category: input.category.trim() || "misc",
      label: input.label.trim() || null,
      amount: Number(input.amount) || 0,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
  revalidatePath("/finance");
}

export async function updateFinanceEntry(
  id: string,
  input: Partial<EntryInput>
): Promise<void> {
  await requireUser();
  await prisma.financeEntry.update({
    where: { id },
    data: {
      ...(input.category !== undefined
        ? { category: input.category.trim() || "misc" }
        : {}),
      ...(input.label !== undefined ? { label: input.label.trim() || null } : {}),
      ...(input.amount !== undefined ? { amount: Number(input.amount) || 0 } : {}),
      ...(input.date !== undefined
        ? { date: input.date ? new Date(`${input.date}T00:00:00`) : null }
        : {}),
      ...(input.meta !== undefined
        ? { meta: input.meta ? JSON.stringify(input.meta) : null }
        : {}),
    },
  });
  revalidatePath("/finance");
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  await requireUser();
  await prisma.financeEntry.delete({ where: { id } });
  revalidatePath("/finance");
}
