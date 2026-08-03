"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Save the calendar year range + supervisor header names. */
export async function saveCalendarConfig(
  yearLabel: string,
  startISO: string,
  endISO: string,
  supervisorNames: string[]
): Promise<void> {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("תאריך שגוי");
  }
  const names = JSON.stringify(supervisorNames.slice(0, 9));
  await prisma.calendarConfig.upsert({
    where: { yearLabel },
    update: { startDate: start, endDate: end, supervisorNames: names },
    create: {
      yearLabel,
      startDate: start,
      endDate: end,
      supervisorNames: names,
    },
  });
  revalidatePath("/calendar");
}

/** Save the supervisor price table (level → ₪ for לינה and קימה). Stored as a
 *  global AppSetting JSON: { lina: { "1": 500, ... }, kima: { ... } }. */
export async function saveSupervisorPrices(pricesJson: string): Promise<void> {
  // Validate it parses so we never persist junk.
  try {
    JSON.parse(pricesJson);
  } catch {
    throw new Error("מבנה מחירים שגוי");
  }
  await prisma.appSetting.upsert({
    where: { key: "calendar_supervisor_prices" },
    update: { value: pricesJson },
    create: { key: "calendar_supervisor_prices", value: pricesJson },
  });
  revalidatePath("/calendar");
}

/**
 * Persist one Shabbat row's editable cells. `values` is the full per-week
 * object ({ yeshivot, linaChul, linaAri, sup }). No revalidate — the grid is
 * a client component holding its own state; a full reload on every keystroke
 * would be jarring.
 */
export async function saveCalendarWeek(
  yearLabel: string,
  weekKey: string,
  values: unknown
): Promise<void> {
  await prisma.calendarWeek.upsert({
    where: { yearLabel_weekKey: { yearLabel, weekKey } },
    update: { values: JSON.stringify(values ?? {}) },
    create: { yearLabel, weekKey, values: JSON.stringify(values ?? {}) },
  });
}
