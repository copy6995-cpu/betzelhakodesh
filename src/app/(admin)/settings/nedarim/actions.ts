"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  saveCreds,
  saveFormsPassword,
  getCreds,
  getFormsCreds,
  syncTransactionsAll,
  syncFormAll,
  syncKevaList,
  chargeSingleFromKeva,
} from "@/lib/nedarim";
import { attachFormsToStudents, type AttachResult } from "@/lib/form-attachment";

export async function saveNedarimCreds(
  mosadId: string,
  apiPassword: string
): Promise<void> {
  const m = mosadId.trim();
  const p = apiPassword.trim();
  if (!m) throw new Error("מזהה מוסד חסר");
  if (!p) throw new Error("סיסמת API חסרה");
  await saveCreds({ mosadId: m, apiPassword: p });
  revalidatePath("/settings/nedarim");
}

export async function saveNedarimFormsPassword(password: string): Promise<void> {
  const p = password.trim();
  if (!p) throw new Error("סיסמת API טפסים חסרה");
  await saveFormsPassword(p);
  revalidatePath("/settings/nedarim");
}

export async function saveMinStartId(minStartId: string): Promise<void> {
  const s = minStartId.trim();
  await prisma.appSetting.upsert({
    where: { key: "nedarim_min_start_id" },
    update: { value: s },
    create: { key: "nedarim_min_start_id", value: s },
  });
  revalidatePath("/settings/nedarim");
}

export async function syncTransactionsNow(): Promise<{
  totalUpserted: number;
  pages: number;
}> {
  const creds = await getCreds();
  if (!creds) throw new Error("חסרים פרטי חיבור לנדרים פלוס");
  const minStart = await prisma.appSetting.findUnique({
    where: { key: "nedarim_min_start_id" },
  });
  const result = await syncTransactionsAll({
    creds,
    minStartId: minStart?.value || undefined,
  });
  await prisma.appSetting.upsert({
    where: { key: "nedarim_last_sync_tx" },
    update: { value: new Date().toISOString() },
    create: { key: "nedarim_last_sync_tx", value: new Date().toISOString() },
  });
  revalidatePath("/settings/nedarim");
  revalidatePath("/nedarim/transactions");
  return result;
}

export async function addNedarimForm(
  tofesId: string,
  label: string
): Promise<void> {
  const t = tofesId.trim();
  const l = label.trim();
  if (!t) throw new Error("מזהה טופס חסר");
  if (!l) throw new Error("שם לתצוגה חסר");
  const max = await prisma.nedarimFormConfig.aggregate({ _max: { order: true } });
  await prisma.nedarimFormConfig.create({
    data: { tofesId: t, label: l, order: (max._max.order ?? 0) + 1 },
  });
  revalidatePath("/settings/nedarim");
}

export async function removeNedarimForm(id: string): Promise<void> {
  const form = await prisma.nedarimFormConfig.findUnique({ where: { id } });
  if (!form) return;
  // Also delete cached submissions so they don't linger orphaned.
  await prisma.nedarimFormSubmission.deleteMany({
    where: { tofesId: form.tofesId },
  });
  await prisma.nedarimFormConfig.delete({ where: { id } });
  revalidatePath("/settings/nedarim");
  revalidatePath("/nedarim/forms");
}

export async function syncFormNow(tofesId: string): Promise<{
  totalUpserted: number;
  pages: number;
  attach: AttachResult;
}> {
  const creds = await getFormsCreds();
  if (!creds) throw new Error("חסרים פרטי חיבור לטפסים בנדרים פלוס");
  const result = await syncFormAll({ creds, tofesId });
  // Immediately re-attach so newly-arrived forms flip their students' hook
  // + eshel flag without waiting for the user to click "attach".
  const attach = await attachFormsToStudents({ tofesId });
  await prisma.appSetting.upsert({
    where: { key: `nedarim_last_sync_form_${tofesId}` },
    update: { value: new Date().toISOString() },
    create: {
      key: `nedarim_last_sync_form_${tofesId}`,
      value: new Date().toISOString(),
    },
  });
  revalidatePath("/settings/nedarim");
  revalidatePath("/nedarim/forms");
  revalidatePath("/bachurim");
  revalidatePath("/yemot/beds");
  return { ...result, attach };
}

/** Manual re-run of the attach step for the given form (or all forms). Safe
 *  to call repeatedly — the attach action is idempotent. */
export async function attachFormsNow(
  tofesId?: string
): Promise<AttachResult> {
  const result = await attachFormsToStudents({ tofesId });
  revalidatePath("/nedarim/forms");
  revalidatePath("/bachurim");
  revalidatePath("/yemot/beds");
  return result;
}

/** Pull the whole GetKevaNew list and mirror into NedarimKeva. Wrapped
 *  in a safe() shape (like the Yemot actions) so real error messages
 *  reach the UI even in production. */
export async function syncKevasNow(): Promise<
  | {
      ok: true;
      totalUpserted: number;
      totalMonth: number;
      totalMonth2: number;
      totalYear: number;
      totalYear2: number;
    }
  | { ok: false; error: string }
> {
  try {
    const creds = await getCreds();
    if (!creds) throw new Error("חסרים פרטי חיבור לנדרים פלוס");
    const r = await syncKevaList({ creds });
    await prisma.appSetting.upsert({
      where: { key: "nedarim_last_sync_kevas" },
      update: { value: new Date().toISOString() },
      create: { key: "nedarim_last_sync_kevas", value: new Date().toISOString() },
    });
    revalidatePath("/nedarim/hoks");
    revalidatePath("/settings/nedarim");
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Fire off a single one-shot charge against an existing HoK. */
export async function chargeKevaOnce(opts: {
  kevaId: string;
  amount: number;
  currency?: 1 | 2;
  tashloumim?: number;
  comments?: string;
  joinToKevaId?: "Join" | "NoJoin";
}): Promise<{ ok: boolean; message: string }> {
  try {
    const creds = await getCreds();
    if (!creds) return { ok: false, message: "חסרים פרטי חיבור לנדרים פלוס" };
    const r = await chargeSingleFromKeva({ creds, ...opts });
    if (r.ok) {
      revalidatePath("/nedarim/hoks");
      revalidatePath("/nedarim/transactions");
      revalidatePath("/bachurim");
    }
    return r;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "שגיאה",
    };
  }
}
