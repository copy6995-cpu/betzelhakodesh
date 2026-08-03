"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Let the signed-in user change their own password after re-entering the
 *  current one. Works for any authenticated user (admin or not). */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new Error("לא מחובר");
  if (newPassword.length < 6)
    throw new Error("הסיסמה החדשה חייבת להכיל לפחות 6 תווים");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("המשתמש לא נמצא");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("הסיסמה הנוכחית שגויה");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
}
