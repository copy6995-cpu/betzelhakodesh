"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

function rev() {
  revalidatePath("/finance/adnei");
  revalidatePath("/finance");
}

export type AdneiInput = {
  date: string | null;
  amount: number;
  ptype: string; // סוג תשלום
  from: string; // מ-גוף
  to: string; // נמסר ל
};

export async function addAdneiEntry(input: AdneiInput): Promise<void> {
  await requireUser();
  const year = await getActiveYear();
  await prisma.financeEntry.create({
    data: {
      year,
      kind: "expense",
      category: "adnei",
      label: input.ptype.trim() || null,
      amount: Number(input.amount) || 0,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      meta: JSON.stringify({
        from: input.from.trim() || null,
        to: input.to.trim() || null,
      }),
    },
  });
  rev();
}

export async function deleteAdneiEntry(id: string): Promise<void> {
  await requireUser();
  await prisma.financeEntry.delete({ where: { id } });
  rev();
}
