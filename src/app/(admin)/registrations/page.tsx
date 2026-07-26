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

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const from = sp.from ?? iso(startOfSunday(today));
  const to = sp.to ?? iso(today);
  const year = await getActiveYear(sp.year);

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");
  const loaded = await loadRegistrationsByYeshiva({
    from: fromDate,
    to: toDate,
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
