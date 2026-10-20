"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { revalidatePath } from "next/cache";

type SessionUser = { role?: string; repKind?: string | null };

async function sessionUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user) throw new Error("לא מורשה");
  return s.user as SessionUser;
}

/** Add / edit / delete entries — the office (admin or a finance user), not a rep. */
async function requireEditor() {
  const u = await sessionUser();
  if (u.role === "rep") throw new Error("אין הרשאה לעריכה");
}

/** Approve entries — the admin, or the adnei rep who signs off. */
async function requireApprover() {
  const u = await sessionUser();
  const ok = u.role === "admin" || (u.role === "rep" && u.repKind === "adnei");
  if (!ok) throw new Error("אין הרשאת אישור");
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

/** JSON snapshot of an entry's approvable values (for the "what changed" diff). */
function snapshotOf(e: {
  date: Date | null;
  amount: number;
  label: string | null;
  meta: string | null;
}): string {
  let m: { from?: string | null; to?: string | null } = {};
  try {
    m = e.meta ? JSON.parse(e.meta) : {};
  } catch {
    /* ignore */
  }
  return JSON.stringify({
    date: e.date ? e.date.toISOString().slice(0, 10) : null,
    amount: e.amount,
    ptype: e.label ?? null,
    from: m.from ?? null,
    to: m.to ?? null,
  });
}

export async function addAdneiEntry(input: AdneiInput): Promise<void> {
  await requireEditor();
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

export async function updateAdneiEntry(
  id: string,
  input: AdneiInput
): Promise<void> {
  await requireEditor();
  const e = await prisma.financeEntry.findUnique({ where: { id } });
  if (!e || e.category !== "adnei") return;
  await prisma.financeEntry.update({
    where: { id },
    data: {
      label: input.ptype.trim() || null,
      amount: Number(input.amount) || 0,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      meta: JSON.stringify({
        from: input.from.trim() || null,
        to: input.to.trim() || null,
      }),
      // Editing sends an approved row back to pending; keep approvedSnapshot so
      // the rep can see what changed before re-approving.
      approved: false,
      approvedAt: null,
    },
  });
  rev();
}

export async function deleteAdneiEntry(id: string): Promise<void> {
  await requireEditor();
  await prisma.financeEntry.delete({ where: { id } });
  rev();
}

export async function approveAdneiEntry(id: string): Promise<void> {
  await requireApprover();
  const e = await prisma.financeEntry.findUnique({ where: { id } });
  if (!e || e.category !== "adnei") return;
  await prisma.financeEntry.update({
    where: { id },
    data: {
      approved: true,
      approvedAt: new Date(),
      approvedSnapshot: snapshotOf(e),
    },
  });
  rev();
}

export async function approveAllPendingAdnei(): Promise<void> {
  await requireApprover();
  const year = await getActiveYear();
  const pending = await prisma.financeEntry.findMany({
    where: { year, kind: "expense", category: "adnei", approved: false },
  });
  for (const e of pending) {
    await prisma.financeEntry.update({
      where: { id: e.id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedSnapshot: snapshotOf(e),
      },
    });
  }
  rev();
}
