"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";

type StudentPayload = {
  id?: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  city: string;
  yeshiva: string;
  shiur: string;
  ariChul: string;
  price: number | null;
  paymentMethod: string;
  paymentsCount: number | null;
  nedarimHook: string;
  endDateLabel: string;
  registeredEshel: boolean;
  notes: string;
  parent: {
    id?: string;
    firstName: string;
    lastName: string;
    tz: string;
    phone: string;
    email: string;
  };
};

function nullIfEmpty(s: string): string | null {
  return s.trim() === "" ? null : s.trim();
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function uniqueCode(year: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    const hit = await prisma.student.findUnique({
      where: { year_personalCode: { year, personalCode: code } },
    });
    if (!hit) return code;
  }
  throw new Error("Unable to generate unique code");
}

async function upsertParent(parent: StudentPayload["parent"]): Promise<string> {
  if (parent.id) {
    await prisma.parent.update({
      where: { id: parent.id },
      data: {
        firstName: parent.firstName.trim(),
        lastName: parent.lastName.trim(),
        tz: nullIfEmpty(parent.tz),
        phone: nullIfEmpty(parent.phone),
        email: nullIfEmpty(parent.email),
      },
    });
    return parent.id;
  }
  const created = await prisma.parent.create({
    data: {
      firstName: parent.firstName.trim(),
      lastName: parent.lastName.trim(),
      tz: nullIfEmpty(parent.tz),
      phone: nullIfEmpty(parent.phone),
      email: nullIfEmpty(parent.email),
    },
  });
  return created.id;
}

export async function updateStudent(payload: StudentPayload): Promise<void> {
  if (!payload.id) throw new Error("Missing student id");
  const parentId = await upsertParent(payload.parent);
  await prisma.student.update({
    where: { id: payload.id },
    data: {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      fatherName: payload.fatherName.trim(),
      city: nullIfEmpty(payload.city),
      yeshiva: payload.yeshiva,
      shiur: nullIfEmpty(payload.shiur),
      ariChul: nullIfEmpty(payload.ariChul),
      price: payload.price,
      paymentMethod: nullIfEmpty(payload.paymentMethod),
      paymentsCount: payload.paymentsCount,
      nedarimHook: nullIfEmpty(payload.nedarimHook),
      endDateLabel: nullIfEmpty(payload.endDateLabel),
      registeredEshel: payload.registeredEshel,
      notes: nullIfEmpty(payload.notes),
      parentId,
    },
  });
  revalidatePath(`/bachurim/${payload.id}`);
  revalidatePath("/bachurim");
}

export async function createStudent(payload: StudentPayload): Promise<string> {
  const year = await getActiveYear();
  const parentId = await upsertParent(payload.parent);
  const personalCode = await uniqueCode(year);
  const created = await prisma.student.create({
    data: {
      year,
      personalCode,
      parentId,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      fatherName: payload.fatherName.trim(),
      city: nullIfEmpty(payload.city),
      yeshiva: payload.yeshiva,
      shiur: nullIfEmpty(payload.shiur),
      ariChul: nullIfEmpty(payload.ariChul),
      price: payload.price,
      paymentMethod: nullIfEmpty(payload.paymentMethod),
      paymentsCount: payload.paymentsCount,
      nedarimHook: nullIfEmpty(payload.nedarimHook),
      endDateLabel: nullIfEmpty(payload.endDateLabel),
      registeredEshel: payload.registeredEshel,
      notes: nullIfEmpty(payload.notes),
    },
  });
  revalidatePath("/bachurim");
  return created.id;
}

export async function addPayment(payload: {
  studentId: string;
  paymentNumber: number;
  amount: number;
  method: string | null;
  date: string | null;
  externalRef: string | null;
  notes: string | null;
}): Promise<void> {
  await prisma.payment.create({
    data: {
      studentId: payload.studentId,
      paymentNumber: payload.paymentNumber,
      amount: payload.amount,
      method: payload.method,
      date: payload.date ? new Date(payload.date) : null,
      externalRef: payload.externalRef,
      notes: payload.notes,
    },
  });
  revalidatePath(`/bachurim/${payload.studentId}`);
  revalidatePath("/payments");
}
