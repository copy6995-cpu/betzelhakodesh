"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updateParent(payload: {
  id: string;
  firstName: string;
  lastName: string;
  tz: string;
  phone: string;
  email: string;
  city: string;
  notes: string;
}): Promise<void> {
  await prisma.parent.update({
    where: { id: payload.id },
    data: {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      tz: payload.tz.trim() || null,
      phone: payload.phone.trim() || null,
      email: payload.email.trim() || null,
      city: payload.city.trim() || null,
      notes: payload.notes.trim() || null,
    },
  });
  revalidatePath(`/parents/${payload.id}`);
  revalidatePath("/parents");
}
