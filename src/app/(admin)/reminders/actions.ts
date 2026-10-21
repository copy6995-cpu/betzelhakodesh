"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
}

function rev(studentId?: string) {
  revalidatePath("/reminders");
  revalidatePath("/");
  if (studentId) revalidatePath(`/bachurim/${studentId}`);
}

export async function addReminder(
  studentId: string,
  text: string,
  dueDate: string
): Promise<void> {
  await requireUser();
  if (!text.trim()) throw new Error("טקסט חסר");
  if (!dueDate) throw new Error("תאריך חסר");
  await prisma.reminder.create({
    data: {
      studentId,
      text: text.trim(),
      dueDate: new Date(`${dueDate}T00:00:00`),
    },
  });
  rev(studentId);
}

export async function completeReminder(id: string): Promise<void> {
  await requireUser();
  const r = await prisma.reminder.update({
    where: { id },
    data: { done: true, doneAt: new Date() },
    select: { studentId: true },
  });
  rev(r.studentId);
}

export async function snoozeReminder(id: string, dueDate: string): Promise<void> {
  await requireUser();
  if (!dueDate) throw new Error("תאריך חסר");
  const r = await prisma.reminder.update({
    where: { id },
    data: { dueDate: new Date(`${dueDate}T00:00:00`), done: false, doneAt: null },
    select: { studentId: true },
  });
  rev(r.studentId);
}

export async function deleteReminder(id: string): Promise<void> {
  await requireUser();
  const r = await prisma.reminder.delete({
    where: { id },
    select: { studentId: true },
  });
  rev(r.studentId);
}
