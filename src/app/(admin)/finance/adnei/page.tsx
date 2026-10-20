import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function AdneiPage() {
  const year = await getActiveYear();
  const [entries, session] = await Promise.all([
    prisma.financeEntry.findMany({
      where: { year, kind: "expense", category: "adnei" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    auth(),
  ]);

  const u = session?.user as
    | { role?: string; repKind?: string | null }
    | undefined;
  const isRep = u?.role === "rep";
  const canEdit = !isRep; // admin / finance user
  const canApprove = u?.role === "admin" || (isRep && u?.repKind === "adnei");

  const fmtVal = (k: string, v: unknown) =>
    v === null || v === undefined || v === ""
      ? "—"
      : k === "amount"
      ? `₪${Math.round(Number(v)).toLocaleString("he-IL")}`
      : String(v);

  const rows: AdneiRow[] = entries.map((e) => {
    const m = parseMeta(e.meta);
    const cur: Record<string, unknown> = {
      date: isoDate(e.date),
      amount: e.amount,
      ptype: e.label ?? null,
      from: m.from ?? null,
      to: m.to ?? null,
    };
    // If an approved row was edited it's now pending; diff against the snapshot.
    const changes: { label: string; from: string; to: string }[] = [];
    if (!e.approved && e.approvedSnapshot) {
      try {
        const snap = JSON.parse(e.approvedSnapshot) as Record<string, unknown>;
        const fields: [string, string][] = [
          ["תאריך", "date"],
          ["סכום", "amount"],
          ["סוג תשלום", "ptype"],
          ["מ-גוף", "from"],
          ["נמסר ל", "to"],
        ];
        for (const [lbl, k] of fields) {
          const o = snap[k] ?? null;
          const n = cur[k] ?? null;
          if (String(o ?? "") !== String(n ?? "")) {
            changes.push({ label: lbl, from: fmtVal(k, o), to: fmtVal(k, n) });
          }
        }
      } catch {
        /* ignore */
      }
    }
    return {
      id: e.id,
      date: cur.date as string | null,
      amount: e.amount,
      ptype: e.label,
      from: m.from ?? null,
      to: m.to ?? null,
      approved: e.approved,
      approvedAt: isoDate(e.approvedAt),
      changes,
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
            שנת {year} · יומן תנועות.{" "}
            {canEdit
              ? "הסך מצטרף להוצאות בדף הכנסות והוצאות — ממתין לאישור הנציג."
              : "יש לאשר כל תנועה."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/finance/adnei/export"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors whitespace-nowrap"
          >
            ↓ ייצוא לאקסל
          </a>
          {!isRep && (
            <Link
              href="/finance"
              className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
            >
              → חזרה להכנסות והוצאות
            </Link>
          )}
        </div>
      </div>

      <AdneiLedger rows={rows} canEdit={canEdit} canApprove={canApprove} />
    </div>
  );
}
