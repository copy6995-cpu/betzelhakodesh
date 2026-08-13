"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SECTION_KEYS } from "@/lib/sections";

/** Only admins may manage users. Throws otherwise. */
async function requireAdmin(): Promise<string> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || user.role !== "admin") throw new Error("אין הרשאה");
  return user.id ?? "";
}

function cleanSections(sections: string[]): string {
  const keys = Array.isArray(sections)
    ? sections.filter((k) => SECTION_KEYS.includes(k))
    : [];
  return JSON.stringify([...new Set(keys)]);
}

function normalizeRole(role: string): "admin" | "user" | "rep" {
  if (role === "admin") return "admin";
  if (role === "rep") return "rep";
  return "user";
}

export type UserInput = {
  email: string;
  name: string;
  password: string;
  role: string;
  sections: string[];
  repId?: string | null;
};

/** Bind a rep login to its Representative (reverse link, used for display). */
async function linkRep(userId: string, repId: string | null): Promise<void> {
  if (!repId) return;
  await prisma.representative
    .update({ where: { id: repId }, data: { userId } })
    .catch(() => {});
}

export async function createUser(input: UserInput): Promise<void> {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !email.includes("@")) throw new Error("אימייל שגוי");
  if (input.password.length < 6)
    throw new Error("סיסמה חייבת להכיל לפחות 6 תווים");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("כתובת האימייל כבר קיימת");

  const role = normalizeRole(input.role);
  if (role === "rep" && !input.repId) throw new Error("צריך לבחור נציג");

  const created = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await bcrypt.hash(input.password, 10),
      role,
      sections: role === "user" ? cleanSections(input.sections) : "[]",
      repId: role === "rep" ? input.repId ?? null : null,
    },
  });
  if (role === "rep") await linkRep(created.id, input.repId ?? null);
  revalidatePath("/settings/users");
}

export async function updateUser(
  id: string,
  input: {
    name: string;
    role: string;
    sections: string[];
    password?: string;
    repId?: string | null;
  }
): Promise<void> {
  const adminId = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("המשתמש לא נמצא");

  const role = normalizeRole(input.role);

  // Guard: don't let the last admin be demoted (would lock everyone out of
  // user management). Also can't demote yourself.
  if (target.role === "admin" && role !== "admin") {
    if (id === adminId) throw new Error("אי אפשר להוריד הרשאת אדמין מעצמך");
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) throw new Error("חייב להישאר לפחות אדמין אחד");
  }
  if (role === "rep" && !input.repId) throw new Error("צריך לבחור נציג");

  const data: {
    name: string | null;
    role: string;
    sections: string;
    repId: string | null;
    passwordHash?: string;
  } = {
    name: input.name.trim() || null,
    role,
    sections: role === "user" ? cleanSections(input.sections) : "[]",
    repId: role === "rep" ? input.repId ?? null : null,
  };
  if (input.password && input.password.trim()) {
    if (input.password.length < 6)
      throw new Error("סיסמה חייבת להכיל לפחות 6 תווים");
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  await prisma.user.update({ where: { id }, data });
  if (role === "rep") await linkRep(id, input.repId ?? null);
  revalidatePath("/settings/users");
}

export async function deleteUser(id: string): Promise<void> {
  const adminId = await requireAdmin();
  if (id === adminId) throw new Error("אי אפשר למחוק את עצמך");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  if (target.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) throw new Error("חייב להישאר לפחות אדמין אחד");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings/users");
}
