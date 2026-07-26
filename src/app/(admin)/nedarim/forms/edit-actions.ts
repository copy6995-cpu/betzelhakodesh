"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { attachFormsToStudents } from "@/lib/form-attachment";

/**
 * Hard-delete a single form submission — used for pruning duplicates spotted
 * via the "כפולים" card. The next attach run will detect the new state and
 * re-establish the correct student ↔ hook mapping automatically.
 */
export async function deleteFormSubmission(
  submissionId: string
): Promise<{ ok: true }> {
  const s = await prisma.nedarimFormSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, tofesId: true },
  });
  if (!s) throw new Error("הגשה לא נמצאה");
  await prisma.nedarimFormSubmission.delete({ where: { id: submissionId } });
  revalidatePath("/nedarim/forms");
  return { ok: true };
}

/**
 * Edit a specific field inside a form submission's raw JSON. Kept generic
 * so the same action can fix `Kod_1` typos and any other field the Nedarim
 * form filled wrong. After the write we re-run the attach step so the
 * student side updates immediately.
 */
export async function updateFormSubmissionField(
  submissionId: string,
  field: string,
  value: string
): Promise<{ ok: true; submissionId: string; field: string; value: string }> {
  const s = await prisma.nedarimFormSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!s) throw new Error("הגשה לא נמצאה");

  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(s.raw);
  } catch {
    throw new Error("לא ניתן לפרש את התוכן של ההגשה");
  }
  obj[field] = value.trim();

  await prisma.nedarimFormSubmission.update({
    where: { id: submissionId },
    data: { raw: JSON.stringify(obj) },
  });

  // Re-run attach for this form so the student side follows immediately.
  await attachFormsToStudents({ tofesId: s.tofesId });

  revalidatePath("/nedarim/forms");
  revalidatePath("/bachurim");
  revalidatePath("/yemot/beds");
  return { ok: true, submissionId, field, value: value.trim() };
}
