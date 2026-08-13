"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

// ---- Reps ----

export async function addChulRep(name: string): Promise<void> {
  await requireUser();
  const year = await getActiveYear();
  if (!name.trim()) return;
  const last = await prisma.representative.findFirst({
    where: { year, kind: "chul" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.representative.create({
    data: {
      year,
      kind: "chul",
      name: name.trim(),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/finance/chul");
  revalidatePath("/finance");
}

export async function renameChulRep(id: string, name: string): Promise<void> {
  await requireUser();
  await prisma.representative.update({
    where: { id },
    data: { name: name.trim() || "—" },
  });
  revalidatePath("/finance/chul");
}

export async function deleteChulRep(id: string): Promise<void> {
  await requireUser();
  await prisma.representative.delete({ where: { id } });
  revalidatePath("/finance/chul");
  revalidatePath("/finance");
}

// ---- Donations ----

export type DonationInput = {
  donor: string;
  date: string | null;
  usd: number;
  rate: number | null;
  ils: number;
  notes: string;
};

/** ₪ falls back to usd×rate when not entered directly. */
function ilsOf(input: { usd: number; rate: number | null; ils: number }): number {
  if (input.ils) return input.ils;
  if (input.usd && input.rate) return Math.round(input.usd * input.rate);
  return 0;
}

export async function addDonation(
  repId: string,
  input: DonationInput
): Promise<void> {
  await requireUser();
  const last = await prisma.chulDonation.findFirst({
    where: { repId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.chulDonation.create({
    data: {
      repId,
      donor: input.donor.trim(),
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      usd: Number(input.usd) || 0,
      rate: input.rate ? Number(input.rate) : null,
      ils: ilsOf(input),
      notes: input.notes.trim() || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/finance/chul`);
  revalidatePath("/finance");
}

export async function updateDonation(
  id: string,
  fields: Partial<DonationInput>
): Promise<void> {
  await requireUser();
  await prisma.chulDonation.update({
    where: { id },
    data: {
      ...(fields.donor !== undefined ? { donor: fields.donor.trim() } : {}),
      ...(fields.date !== undefined
        ? { date: fields.date ? new Date(`${fields.date}T00:00:00`) : null }
        : {}),
      ...(fields.usd !== undefined ? { usd: Number(fields.usd) || 0 } : {}),
      ...(fields.rate !== undefined
        ? { rate: fields.rate ? Number(fields.rate) : null }
        : {}),
      ...(fields.ils !== undefined ? { ils: Number(fields.ils) || 0 } : {}),
      ...(fields.notes !== undefined
        ? { notes: fields.notes.trim() || null }
        : {}),
    },
  });
  // No revalidate: donation cell edits reflect locally.
}

export async function deleteDonation(id: string): Promise<void> {
  await requireUser();
  await prisma.chulDonation.delete({ where: { id } });
  revalidatePath("/finance/chul");
  revalidatePath("/finance");
}
