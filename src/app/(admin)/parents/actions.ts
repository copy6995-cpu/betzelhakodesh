"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/**
 * Fetch parents whose first or last name matches the query, excluding one
 * specific id (the parent you're currently on). Used by the merge-parent
 * and move-student dialogs.
 */
export async function searchParents(params: {
  q: string;
  excludeId?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    studentCount: number;
  }>
> {
  const q = params.q.trim();
  if (q.length < 2) return [];
  const rows = await prisma.parent.findMany({
    where: {
      AND: [
        params.excludeId ? { id: { not: params.excludeId } } : {},
        {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { tz: { contains: q } },
          ],
        },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: params.limit ?? 10,
    include: { _count: { select: { students: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    studentCount: r._count.students,
  }));
}

export async function searchStudents(params: {
  q: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    fatherName: string;
    year: string;
    yeshiva: string;
    personalCode: string;
    parentId: string;
    parentName: string;
  }>
> {
  const q = params.q.trim();
  if (q.length < 2) return [];
  const rows = await prisma.student.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        { personalCode: { contains: q } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: params.limit ?? 10,
    include: { parent: { select: { firstName: true, lastName: true, id: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    fatherName: s.fatherName,
    year: s.year,
    yeshiva: s.yeshiva,
    personalCode: s.personalCode,
    parentId: s.parent.id,
    parentName: `${s.parent.firstName} ${s.parent.lastName}`,
  }));
}

/**
 * Merge `removeId` into `keepId`: moves every Student of the removed parent
 * over to the kept parent, fills in any empty contact fields on the kept
 * parent from the removed one, then deletes the removed parent.
 */
export async function mergeParents(params: {
  keepId: string;
  removeId: string;
}): Promise<{ studentsMoved: number }> {
  if (params.keepId === params.removeId) {
    throw new Error("אי אפשר למזג הורה עם עצמו");
  }
  const [keep, remove] = await Promise.all([
    prisma.parent.findUnique({ where: { id: params.keepId } }),
    prisma.parent.findUnique({ where: { id: params.removeId } }),
  ]);
  if (!keep || !remove) throw new Error("הורה לא נמצא");

  const studentsMoved = await prisma.$transaction(async (tx) => {
    // Move all students to the kept parent
    const result = await tx.student.updateMany({
      where: { parentId: params.removeId },
      data: { parentId: params.keepId },
    });

    // Fill in any empty fields on the kept parent from the removed one.
    const update: Record<string, string> = {};
    (["tz", "phone", "email", "city"] as const).forEach((f) => {
      if (!keep[f] && remove[f]) update[f] = remove[f] as string;
    });
    if (!keep.notes && remove.notes) update.notes = remove.notes;
    if (Object.keys(update).length > 0) {
      await tx.parent.update({ where: { id: params.keepId }, data: update });
    }

    // Finally, delete the removed parent (its students have been moved so
    // the Restrict FK constraint is satisfied).
    await tx.parent.delete({ where: { id: params.removeId } });
    return result.count;
  });

  revalidatePath(`/parents/${params.keepId}`);
  revalidatePath("/parents");
  return { studentsMoved };
}

/**
 * Reassign a single student to a different parent. Used by the
 * "הוסף ילד קיים" dialog on the parent page.
 */
export async function reassignStudent(params: {
  studentId: string;
  targetParentId: string;
}): Promise<void> {
  await prisma.student.update({
    where: { id: params.studentId },
    data: { parentId: params.targetParentId },
  });
  revalidatePath(`/parents/${params.targetParentId}`);
  revalidatePath("/parents");
  revalidatePath(`/bachurim/${params.studentId}`);
}
