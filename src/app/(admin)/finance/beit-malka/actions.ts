"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { rowAmount } from "@/lib/beit-malka";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

export type RowInput = {
  reason: string;
  kind: string; // "מיטות" | "אחר"
  beds: number;
  amount: number; // for "אחר": the flat sum; for "מיטות": ignored (beds×22)
  paid: number;
  method: string;
  date: string | null;
};

export async function addBeitMalkaRow(input: RowInput): Promise<void> {
  await requireUser();
  const year = await getActiveYear();
  const kind = input.kind === "אחר" ? "אחר" : "מיטות";
  const beds = Math.max(0, Math.floor(input.beds || 0));
  const last = await prisma.beitMalkaRow.findFirst({
    where: { year },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.beitMalkaRow.create({
    data: {
      year,
      reason: input.reason.trim(),
      kind,
      beds,
      amount: rowAmount(kind, beds, input.amount),
      paid: Math.max(0, input.paid || 0),
      method: input.method.trim() || null,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/finance/beit-malka");
  revalidatePath("/finance");
}

export async function updateBeitMalkaRow(
  id: string,
  fields: Partial<RowInput>
): Promise<void> {
  await requireUser();
  const row = await prisma.beitMalkaRow.findUnique({ where: { id } });
  if (!row) return;
  const kind =
    fields.kind !== undefined ? (fields.kind === "אחר" ? "אחר" : "מיטות") : row.kind;
  const beds =
    fields.beds !== undefined ? Math.max(0, Math.floor(fields.beds || 0)) : row.beds;
  const flat = fields.amount !== undefined ? fields.amount : row.amount;
  await prisma.beitMalkaRow.update({
    where: { id },
    data: {
      ...(fields.reason !== undefined ? { reason: fields.reason.trim() } : {}),
      kind,
      beds,
      amount: rowAmount(kind, beds, flat),
      ...(fields.paid !== undefined ? { paid: Math.max(0, fields.paid || 0) } : {}),
      ...(fields.method !== undefined
        ? { method: fields.method.trim() || null }
        : {}),
      ...(fields.date !== undefined
        ? { date: fields.date ? new Date(`${fields.date}T00:00:00`) : null }
        : {}),
    },
  });
  // No revalidate: row edits reflect locally; totals recompute client-side.
}

export async function deleteBeitMalkaRow(id: string): Promise<void> {
  await requireUser();
  await prisma.beitMalkaRow.delete({ where: { id } });
  revalidatePath("/finance/beit-malka");
  revalidatePath("/finance");
}
