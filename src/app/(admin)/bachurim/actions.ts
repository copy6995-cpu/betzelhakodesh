"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";

// Mirror of SHIUR_NEXT in settings/actions.ts. Kept here so single-student
// promotions can bump the shiur the same way the bulk year-promotion does.
// ט stays at ט — students who finished ט stay in the same shiur unless they
// were manually moved to ארכיון.
const SHIUR_NEXT: Record<string, string | null> = {
  "א": "ב",
  "ב": "ג",
  "ג": "ד",
  "ד": "ה",
  "ה": "ו",
  "ו": "ז",
  "ז": "ח",
  "ח": "ט",
  "ט": "ט",
};

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
      source: "manual",
    },
  });
  revalidatePath(`/bachurim/${payload.studentId}`);
  revalidatePath("/payments");
}

/**
 * Copy a single student to another school year while KEEPING their existing
 * personalCode (that's the whole point — bulk import gave them a random new
 * code and the admin ended up managing duplicates). Roster fields carry over,
 * shiur bumps one grade (ט stays at ט), and every money/registration field
 * resets — those are per-year and the admin fills them fresh via forms.
 *
 * Returns the newly-created student's id so the caller can redirect to it.
 * Throws when the same (year, personalCode) already exists, so the button
 * never silently creates a duplicate.
 */
export async function promoteStudentToYear(
  sourceStudentId: string,
  targetYear: string
): Promise<{ id: string }> {
  const target = targetYear.trim();
  if (!target) throw new Error("שנת יעד חסרה");

  const source = await prisma.student.findUnique({
    where: { id: sourceStudentId },
  });
  if (!source) throw new Error("הבחור לא נמצא");
  if (source.year === target) throw new Error("הבחור כבר קיים בשנה הזו");

  const existing = await prisma.student.findUnique({
    where: {
      year_personalCode: { year: target, personalCode: source.personalCode },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `בחור עם קוד ${source.personalCode} כבר קיים ב-${target}`
    );
  }

  const nextShiur = source.shiur
    ? SHIUR_NEXT[source.shiur] ?? source.shiur
    : null;

  const created = await prisma.student.create({
    data: {
      year: target,
      personalCode: source.personalCode,
      parentId: source.parentId,
      firstName: source.firstName,
      lastName: source.lastName,
      fatherName: source.fatherName,
      city: source.city,
      yeshiva: source.yeshiva,
      shiur: nextShiur,
      ariChul: source.ariChul,
      branch: source.branch,
      yeshivaCode: source.yeshivaCode,
      notes: source.notes,
      // Fresh year — everything money/registration-related resets.
      price: null,
      paymentMethod: null,
      paymentsCount: null,
      nedarimHook: null,
      endDateLabel: null,
      endDate: null,
      registeredEshel: false,
      archived: false,
    },
  });

  revalidatePath("/bachurim");
  revalidatePath(`/bachurim/${sourceStudentId}`);
  revalidatePath(`/parents/${source.parentId}`);
  return { id: created.id };
}

/**
 * Delete a single NON-Nedarim payment (manual / other / legacy). Nedarim Plus
 * payments are materialized from synced transactions and would just
 * re-appear on the next payment-sync, so deleting them is refused.
 *
 * Gated by re-entering the admin password — verified server-side against the
 * logged-in user's bcrypt hash, so a client can't bypass it.
 */
export async function deletePayment(
  paymentId: string,
  password: string
): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("לא מחובר");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("משתמש לא נמצא");
  const ok = await bcrypt.compare(password ?? "", user.passwordHash);
  if (!ok) throw new Error("סיסמה שגויה");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, source: true, method: true },
  });
  if (!payment) throw new Error("תשלום לא נמצא");
  if (payment.source === "nedarim" || payment.method === "נדרים פלוס") {
    throw new Error("לא ניתן למחוק תשלום של נדרים פלוס");
  }

  await prisma.payment.delete({ where: { id: payment.id } });
  revalidatePath(`/bachurim/${payment.studentId}`);
  revalidatePath("/payments");
  revalidatePath("/bachurim");
}

/**
 * Hard-delete a student and all their payments. Payments are cascade-deleted
 * by the schema (Payment.student has onDelete: Cascade). Returns the
 * parentId so the caller can redirect to the parent page.
 */
export async function deleteStudent(id: string): Promise<{ parentId: string }> {
  const student = await prisma.student.findUnique({
    where: { id },
    select: { parentId: true },
  });
  if (!student) throw new Error("הבחור לא נמצא");
  await prisma.student.delete({ where: { id } });
  revalidatePath("/bachurim");
  revalidatePath(`/parents/${student.parentId}`);
  revalidatePath("/payments");
  return { parentId: student.parentId };
}
