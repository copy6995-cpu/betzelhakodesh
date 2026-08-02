"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getToken,
  saveToken,
  syncFull as apiSyncFull,
  syncLatest as apiSyncLatest,
  syncLogCreditCard,
} from "@/lib/yemot";

export async function saveYemotToken(token: string): Promise<void> {
  await saveToken(token);
  revalidatePath("/settings/yemot");
}

export async function addYemotSource(
  path: string,
  current: boolean,
  label: string,
  kind: "booking" | "cancellation" = "booking"
): Promise<void> {
  const p = path.trim();
  if (!p) throw new Error("נתיב חסר");
  const max = await prisma.yemotSource.aggregate({ _max: { order: true } });
  await prisma.yemotSource.create({
    data: {
      path: p,
      current,
      label: label.trim() || null,
      kind: kind === "cancellation" ? "cancellation" : "booking",
      order: (max._max.order ?? 0) + 1,
    },
  });
  revalidatePath("/settings/yemot");
  revalidatePath("/yemot/beds");
}

/** Flip a source between a bookings feed and a cancellations feed. */
export async function toggleYemotSourceKind(id: string): Promise<void> {
  const src = await prisma.yemotSource.findUnique({ where: { id } });
  if (!src) return;
  await prisma.yemotSource.update({
    where: { id },
    data: { kind: src.kind === "cancellation" ? "booking" : "cancellation" },
  });
  revalidatePath("/settings/yemot");
  revalidatePath("/yemot/beds");
}

export async function removeYemotSource(id: string): Promise<void> {
  const src = await prisma.yemotSource.findUnique({ where: { id } });
  if (!src) return;
  // Also delete this source's reservations so the beds view stops showing them.
  await prisma.yemotBedReservation.deleteMany({ where: { source: src.path } });
  await prisma.yemotSource.delete({ where: { id } });
  revalidatePath("/settings/yemot");
  revalidatePath("/yemot/beds");
}

export async function toggleYemotSourceCurrent(id: string): Promise<void> {
  const src = await prisma.yemotSource.findUnique({ where: { id } });
  if (!src) return;
  await prisma.yemotSource.update({
    where: { id },
    data: { current: !src.current },
  });
  revalidatePath("/settings/yemot");
}

/**
 * Return the caught error as data instead of throwing, so the actual
 * message survives the production server-action layer (Next.js masks
 * thrown errors with a generic "Server Components render" digest in
 * production). Client code checks `ok`.
 */
export type SyncResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function safe<T>(fn: () => Promise<T>): Promise<SyncResult<T>> {
  try {
    const data = await fn();
    return { ok: true, ...data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא ידועה",
    };
  }
}

export async function syncYemotFull(): Promise<
  SyncResult<{ inserted: number; weeks: number }>
> {
  return safe(async () => {
    const token = await getToken();
    if (!token) throw new Error("לא הוגדר טוקן ימות המשיח");
    const sources = await prisma.yemotSource.findMany({
      orderBy: { order: "asc" },
    });
    if (sources.length === 0) throw new Error("לא הוגדרו נתיבי מקור");
    const result = await apiSyncFull({
      token,
      sources: sources.map((s) => ({ path: s.path, kind: s.kind })),
    });
    await prisma.appSetting.upsert({
      where: { key: "yemot_last_sync" },
      update: { value: new Date().toISOString() },
      create: { key: "yemot_last_sync", value: new Date().toISOString() },
    });
    revalidatePath("/settings/yemot");
    revalidatePath("/yemot/beds");
    return result;
  });
}

export async function syncYemotCreditCards(): Promise<
  SyncResult<{
    total: number;
    stored: number;
    approved: number;
    matched: number;
    eshelFlipped: number;
    hookSet: number;
    unmatched: number;
    perYear: Array<{ year: string; matched: number; unmatched: number }>;
  }>
> {
  return safe(async () => {
    const token = await getToken();
    if (!token) throw new Error("לא הוגדר טוקן ימות המשיח");
    const result = await syncLogCreditCard({ token });
    revalidatePath("/settings/yemot");
    revalidatePath("/bachurim");
    return result;
  });
}

export async function syncYemotLatest(): Promise<
  SyncResult<{ inserted: number; weekKey: string | null }>
> {
  return safe(async () => {
    const token = await getToken();
    if (!token) throw new Error("לא הוגדר טוקן ימות המשיח");
    const sources = await prisma.yemotSource.findMany({
      orderBy: { order: "asc" },
    });
    if (sources.length === 0) throw new Error("לא הוגדרו נתיבי מקור");
    const result = await apiSyncLatest({
      token,
      sources: sources.map((s) => ({
        path: s.path,
        current: s.current,
        kind: s.kind,
      })),
    });
    await prisma.appSetting.upsert({
      where: { key: "yemot_last_sync" },
      update: { value: new Date().toISOString() },
      create: { key: "yemot_last_sync", value: new Date().toISOString() },
    });
    revalidatePath("/settings/yemot");
    revalidatePath("/yemot/beds");
    return result;
  });
}
