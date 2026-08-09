import { getActiveYear } from "@/lib/year";
import { loadFinance } from "@/lib/finance";
import { FinanceUI } from "./ui";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const year = await getActiveYear();
  const data = await loadFinance(year);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          הכנסות והוצאות
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          שנת {year} · הקופה = סה״כ הכנסות פחות סה״כ הוצאות ששולמו.
        </p>
      </div>

      <FinanceUI data={data} />
    </div>
  );
}
