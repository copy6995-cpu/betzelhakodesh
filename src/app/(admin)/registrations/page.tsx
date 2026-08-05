import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadRegistrationsByYeshiva } from "@/lib/registration-export";
import { getActiveYear } from "@/lib/year";
import { RegistrationsUI } from "./ui";

export const dynamic = "force-dynamic";

/** Start of the current Sunday (Israeli work week). Time reset to 00:00. */
function startOfSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // 0 = Sunday
  return x;
}

function isoDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** Parse a UI value (date-only or datetime-local) into a Date. */
function parseRange(s: string, endOfDay: boolean): Date {
  return new Date(
    s.includes("T") ? s : `${s}T${endOfDay ? "23:59:59" : "00:00:00"}`
  );
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  // Normalize to datetime-local format ("YYYY-MM-DDTHH:MM") for the inputs.
  const norm = (s: string, end: string) =>
    s.includes("T") ? s.slice(0, 16) : `${s}T${end}`;
  const from = norm(sp.from ?? isoDT(startOfSunday(today)), "00:00");
  const to = norm(sp.to ?? isoDT(today), "23:59");
  const year = await getActiveYear(sp.year);

  const loaded = await loadRegistrationsByYeshiva({
    from: parseRange(from, false),
    to: parseRange(to, true),
    year,
  });
  const counts = [...loaded.groups.entries()]
    .map(([yeshiva, rows]) => ({ yeshiva, count: rows.length }))
    .sort((a, b) => b.count - a.count);

  // Fallback state for the UI empty case.
  const anyBedsEver = await prisma.yemotBedReservation.count();

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          רישומים שבועיים
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          מי הזמין מיטה בטווח התאריכים (מקור: ימות המשיח, סטטוס &quot;מאושר&quot;),
          מקובץ לפי ישיבה מתוך הרשימה של שנת {year}. אפשר להוריד קובץ אחד עם
          גיליון לכל ישיבה, או קובץ נפרד לכל ישיבה (כמו הסקריפט הישן
          פיצול_לפי_ישיבה.py).
        </p>
      </div>

      <RegistrationsUI
        from={from}
        to={to}
        year={year}
        counts={counts}
        totalRows={loaded.totalRows}
        noYemotData={anyBedsEver === 0}
      />
    </div>
  );
}
