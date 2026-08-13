import Link from "next/link";
import { getActiveYear } from "@/lib/year";
import { loadChulReps } from "@/lib/reps";
import { ChulRepList } from "./ui";

export const dynamic = "force-dynamic";

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export default async function ChulPage() {
  const year = await getActiveYear();
  const reps = await loadChulReps(year);
  const total = reps.reduce((a, r) => a + r.total, 0);

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            נציגי חול
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            שנת {year} · {reps.length} נציגים · סה״כ נכנס{" "}
            <span className="font-semibold text-green-700">{nis(total)}</span>
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
        >
          → חזרה להכנסות והוצאות
        </Link>
      </div>

      <ChulRepList reps={reps} />
    </div>
  );
}
