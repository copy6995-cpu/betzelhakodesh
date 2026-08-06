"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { revalidatePath } from "next/cache";

/**
 * Manually-entered bed reservations live under a dedicated source so the phone
 * sync never touches them: syncItems() deletes rows by (configured source,
 * weekKey), and "manual" is never a configured source. Same shape as a synced
 * "מאושר" row so it flows through loadBedsMatrix unchanged.
 */
const MANUAL_SOURCE = "manual";

type Result = { ok: true } | { ok: false; error: string };

/** Mark a student as having booked a bed for an existing week, by hand. */
export async function addManualBedReservation(input: {
  personalCode: string;
  name: string;
  weekKey: string;
  date: string | null; // dd/mm/yyyy — the week's representative date
  hebDate: string | null;
}): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "לא מורשה" };

  const personalCode = input.personalCode.trim();
  const weekKey = input.weekKey.trim();
  const name = input.name.trim() || null;
  if (!personalCode) return { ok: false, error: "חסר קוד תלמיד" };
  if (!weekKey) return { ok: false, error: "חסר שבוע" };

  await prisma.yemotBedReservation.upsert({
    where: {
      source_weekKey_personalCode: {
        source: MANUAL_SOURCE,
        weekKey,
        personalCode,
      },
    },
    create: {
      source: MANUAL_SOURCE,
      weekKey,
      personalCode,
      name,
      status: "מאושר",
      date: input.date,
      hebDate: input.hebDate,
      raw: JSON.stringify({ manual: true }),
    },
    update: {
      name,
      status: "מאושר",
      date: input.date,
      hebDate: input.hebDate,
    },
  });

  revalidatePath("/yemot/beds");
  return { ok: true };
}

/** Add manual bed reservations for MANY personal codes at once (one week).
 *  Only codes that match an active-year student are added; the rest are
 *  returned as `skipped` so the user sees what didn't take. */
export async function addManualBedReservationsBatch(input: {
  codes: string[];
  weekKey: string;
  date: string | null;
  hebDate: string | null;
}): Promise<
  { ok: true; added: number; skipped: string[] } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "לא מורשה" };

  const weekKey = input.weekKey.trim();
  if (!weekKey) return { ok: false, error: "חסר שבוע" };

  const codes = [
    ...new Set(input.codes.map((c) => c.trim()).filter(Boolean)),
  ];
  if (codes.length === 0) return { ok: false, error: "לא הוזנו קודים" };

  const activeYear = await getActiveYear();
  const students = await prisma.student.findMany({
    where: { year: activeYear, personalCode: { in: codes } },
    select: { personalCode: true, firstName: true, lastName: true },
  });
  const nameByCode = new Map(
    students.map((s) => [s.personalCode, `${s.firstName} ${s.lastName}`.trim()])
  );

  const matched = codes.filter((c) => nameByCode.has(c));
  const skipped = codes.filter((c) => !nameByCode.has(c));

  // Upsert in parallel chunks — sequential awaits over the pooler are slow.
  for (let i = 0; i < matched.length; i += 25) {
    const chunk = matched.slice(i, i + 25);
    await Promise.all(
      chunk.map((personalCode) =>
        prisma.yemotBedReservation.upsert({
          where: {
            source_weekKey_personalCode: {
              source: MANUAL_SOURCE,
              weekKey,
              personalCode,
            },
          },
          create: {
            source: MANUAL_SOURCE,
            weekKey,
            personalCode,
            name: nameByCode.get(personalCode) ?? null,
            status: "מאושר",
            date: input.date,
            hebDate: input.hebDate,
            raw: JSON.stringify({ manual: true }),
          },
          update: {
            name: nameByCode.get(personalCode) ?? null,
            status: "מאושר",
            date: input.date,
            hebDate: input.hebDate,
          },
        })
      )
    );
  }

  revalidatePath("/yemot/beds");
  return { ok: true, added: matched.length, skipped };
}

/** Undo a manual entry (does nothing to synced reservations). */
export async function removeManualBedReservation(input: {
  personalCode: string;
  weekKey: string;
}): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "לא מורשה" };

  await prisma.yemotBedReservation.deleteMany({
    where: {
      source: MANUAL_SOURCE,
      weekKey: input.weekKey.trim(),
      personalCode: input.personalCode.trim(),
    },
  });

  revalidatePath("/yemot/beds");
  return { ok: true };
}
