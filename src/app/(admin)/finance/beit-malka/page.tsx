import Link from "next/link";
import { getActiveYear } from "@/lib/year";
import { loadBeitMalka } from "@/lib/beit-malka";
import { BeitMalkaGrid } from "./ui";

export const dynamic = "force-dynamic";

export default async function BeitMalkaPage() {
  const year = await getActiveYear();
  const data = await loadBeitMalka(year);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            בית מלכה — מיטות
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            שנת {year} · שורת ״מיטות״ מחושבת ₪22 למיטה, שורת ״אחר״ סכום חופשי.
            הסכומים נשמרים אוטומטית.
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
        >
          → חזרה להכנסות והוצאות
        </Link>
      </div>

      <BeitMalkaGrid data={data} />
    </div>
  );
}
