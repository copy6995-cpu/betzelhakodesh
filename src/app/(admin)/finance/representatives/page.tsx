import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { fiscalMonths, loadReps } from "@/lib/reps";
import { RepsGrid } from "./ui";

export const dynamic = "force-dynamic";

export default async function RepresentativesPage() {
  const year = await getActiveYear();
  const [reps, yeshivot] = await Promise.all([
    loadReps(year, "yeshiva"),
    prisma.yeshiva.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      select: { name: true },
    }),
  ]);
  const months = fiscalMonths(year);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            תשלום לנציגים בישיבות
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            שנת {year} · סכום ששולם לכל נציג בכל חודש. הסכומים נשמרים אוטומטית.
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
        >
          → חזרה להכנסות והוצאות
        </Link>
      </div>

      <RepsGrid
        months={months}
        reps={reps}
        yeshivot={yeshivot.map((y) => y.name)}
      />
    </div>
  );
}
