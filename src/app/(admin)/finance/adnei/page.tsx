import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { AdneiLedger, type AdneiRow } from "./ui";

export const dynamic = "force-dynamic";

function parseMeta(s: string | null): { from?: string; to?: string } {
  if (!s) return {};
  try {
    return JSON.parse(s) ?? {};
  } catch {
    return {};
  }
}

export default async function AdneiPage() {
  const year = await getActiveYear();
  const entries = await prisma.financeEntry.findMany({
    where: { year, kind: "expense", category: "adnei" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const rows: AdneiRow[] = entries.map((e) => {
    const m = parseMeta(e.meta);
    return {
      id: e.id,
      date: e.date ? e.date.toISOString().slice(0, 10) : null,
      amount: e.amount,
      ptype: e.label,
      from: m.from ?? null,
      to: m.to ?? null,
    };
  });

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            אדני הקודש
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            שנת {year} · יומן תנועות. הסך מצטרף להוצאות בדף הכנסות והוצאות.
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
        >
          → חזרה להכנסות והוצאות
        </Link>
      </div>

      <AdneiLedger rows={rows} />
    </div>
  );
}
