"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { END_DATE_SEASONS } from "@/lib/eshel";

export async function setActiveYear(year: string): Promise<void> {
  if (!year) throw new Error("שנה ריקה");
  await prisma.appSetting.upsert({
    where: { key: "active_year" },
    update: { value: year },
    create: { key: "active_year", value: year },
  });
  revalidatePath("/");
  revalidatePath("/bachurim");
  revalidatePath("/parents");
  revalidatePath("/settings");
}

export async function addYeshiva(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("שם ריק");
  const max = await prisma.yeshiva.aggregate({ _max: { displayOrder: true } });
  await prisma.yeshiva.create({
    data: {
      name: trimmed,
      displayOrder: (max._max.displayOrder ?? 0) + 1,
      active: true,
    },
  });
  revalidatePath("/settings/yeshivot");
}

export async function toggleYeshivaActive(id: string): Promise<void> {
  const y = await prisma.yeshiva.findUnique({ where: { id } });
  if (!y) throw new Error("ישיבה לא נמצאה");
  await prisma.yeshiva.update({
    where: { id },
    data: { active: !y.active },
  });
  revalidatePath("/settings/yeshivot");
}

export async function renameYeshiva(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("שם ריק");
  await prisma.yeshiva.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/settings/yeshivot");
}

/** Make sure `year` has a row for each standard season (create-only, no date).
 *  Idempotent — safe to call on every settings page load. */
export async function ensureEndDateOptions(year: string): Promise<void> {
  const existing = await prisma.endDateOption.findMany({
    where: { year },
    select: { label: true },
  });
  const have = new Set(existing.map((e) => e.label));
  const missing = END_DATE_SEASONS.filter((l) => !have.has(l));
  if (missing.length === 0) return;
  await prisma.endDateOption.createMany({
    data: missing.map((label) => ({ year, label })),
  });
}

/**
 * Set (or clear) the cutoff date for one season in one year. `dateISO` is a
 * "YYYY-MM-DD" string from an <input type="date">, or null/"" to clear.
 * Parsed as local midnight so the day the office picks is the day it flips.
 */
export async function saveEndDate(
  year: string,
  label: string,
  dateISO: string | null
): Promise<void> {
  if (!year || !label) throw new Error("שנה או תווית חסרות");
  const date =
    dateISO && dateISO.trim()
      ? new Date(`${dateISO.trim()}T00:00:00`)
      : null;
  if (date && isNaN(date.getTime())) throw new Error("תאריך שגוי");
  await prisma.endDateOption.upsert({
    where: { year_label: { year, label } },
    update: { date },
    create: { year, label, date },
  });
  // Registration status is derived from these dates everywhere.
  revalidatePath("/settings");
  revalidatePath("/bachurim");
  revalidatePath("/yemot/credit-cards");
  revalidatePath("/");
}

// Standard promotion of the school shiur (grade). ט stays at ט — students
// who finished ט but aren't in the archive stay in the same shiur (the admin
// moves them to ארכיון manually when they're really done).
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

// Yeshivot that mean "not in a real slot" — students there don't get carried
// forward to the new year.
const SKIP_YESHIVOT = new Set(["ארכיון", "שיעור א' - לא שובץ"]);

/**
 * Report used by the confirmation dialog before running the promotion:
 * how many students in `sourceYear` would actually be promoted, and how
 * many are excluded and why.
 */
export async function previewPromotion(sourceYear: string): Promise<{
  eligible: number;
  skippedArchived: number;
  skippedYeshiva: number;
  stayingAtT: number; // in ט, will be copied but stay at ט
}> {
  const students = await prisma.student.findMany({
    where: { year: sourceYear },
    select: { yeshiva: true, shiur: true, archived: true },
  });
  let eligible = 0;
  let skippedArchived = 0;
  let skippedYeshiva = 0;
  let stayingAtT = 0;
  for (const s of students) {
    if (s.archived) { skippedArchived++; continue; }
    if (SKIP_YESHIVOT.has(s.yeshiva)) { skippedYeshiva++; continue; }
    eligible++;
    if (s.shiur === "ט") stayingAtT++;
  }
  return { eligible, skippedArchived, skippedYeshiva, stayingAtT };
}

/**
 * Copy eligible students from `sourceYear` to `targetYear`, promoting shiur
 * one grade (א→ב, ב→ג, …). Payments, price, end date, nedarim hook and
 * "רשום באש״ל" are NOT carried over — they are always per-year and the admin
 * fills them fresh. Personal codes stay the same across years (parent
 * continuity); `@@unique([year, personalCode])` prevents duplicate inserts
 * when a matching row already exists in the target year, so re-running the
 * promotion is a safe no-op.
 */
export async function promoteToYear(
  sourceYear: string,
  targetYear: string
): Promise<{ created: number; skipped: number }> {
  if (!sourceYear || !targetYear) throw new Error("שנה חסרה");
  if (sourceYear === targetYear) throw new Error("שנה מקור וזהות");

  const source = await prisma.student.findMany({ where: { year: sourceYear } });
  const existingCodesForTarget = new Set(
    (
      await prisma.student.findMany({
        where: { year: targetYear },
        select: { personalCode: true },
      })
    ).map((s) => s.personalCode)
  );

  let created = 0;
  let skipped = 0;
  for (const s of source) {
    if (s.archived) { skipped++; continue; }
    if (SKIP_YESHIVOT.has(s.yeshiva)) { skipped++; continue; }
    if (existingCodesForTarget.has(s.personalCode)) { skipped++; continue; }

    // ט stays at ט (see SHIUR_NEXT). null shiur stays null.
    const nextShiur = s.shiur ? SHIUR_NEXT[s.shiur] ?? s.shiur : null;

    await prisma.student.create({
      data: {
        year: targetYear,
        personalCode: s.personalCode,
        parentId: s.parentId,
        firstName: s.firstName,
        lastName: s.lastName,
        fatherName: s.fatherName,
        city: s.city,
        yeshiva: s.yeshiva,
        shiur: nextShiur,
        ariChul: s.ariChul,
        notes: s.notes,
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
    created++;
  }

  revalidatePath("/bachurim");
  revalidatePath("/parents");
  revalidatePath("/");
  return { created, skipped };
}
