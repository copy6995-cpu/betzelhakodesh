import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { formatILS, formatNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getStats(year: string) {
  const [
    studentCount,
    parentCount,
    byYeshiva,
    priceAgg,
    paymentAgg,
  ] = await Promise.all([
    prisma.student.count({ where: { year, archived: false } }),
    prisma.parent.count({
      where: { students: { some: { year, archived: false } } },
    }),
    prisma.student.groupBy({
      by: ["yeshiva"],
      where: { year, archived: false },
      _count: { _all: true },
      _sum: { price: true },
      orderBy: { _count: { yeshiva: "desc" } },
    }),
    prisma.student.aggregate({
      where: { year, archived: false },
      _sum: { price: true },
    }),
    prisma.payment.aggregate({
      where: { student: { year, archived: false } },
      _sum: { amount: true },
    }),
  ]);
  const totalPrice = Number(priceAgg._sum.price ?? 0);
  const totalPaid = Number(paymentAgg._sum.amount ?? 0);
  const remaining = totalPrice - totalPaid;
  return { studentCount, parentCount, byYeshiva, totalPrice, totalPaid, remaining };
}

export default async function DashboardPage() {
  const year = await getActiveYear();
  const stats = await getStats(year);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          דשבורד
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          סיכום תלמידים ותשלומים לשנת {year}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="תלמידים" value={formatNum(stats.studentCount)} />
        <StatCard label="הורים" value={formatNum(stats.parentCount)} />
        <StatCard
          label="סה״כ שולם"
          value={formatILS(stats.totalPaid)}
          tone="success"
        />
        <StatCard
          label="יתרה לגבייה"
          value={formatILS(stats.remaining)}
          tone={stats.remaining > 0 ? "warning" : "success"}
        />
      </div>

      <div className="bg-white rounded-xl card-shadow p-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
          תלמידים לפי ישיבה
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="py-2 pe-4 font-semibold">ישיבה</th>
                <th className="py-2 px-4 font-semibold">תלמידים</th>
                <th className="py-2 px-4 font-semibold">סה״כ מחיר</th>
              </tr>
            </thead>
            <tbody>
              {stats.byYeshiva.map((r) => (
                <tr key={r.yeshiva} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2.5 pe-4 font-medium">{r.yeshiva}</td>
                  <td className="py-2.5 px-4">{formatNum(r._count._all)}</td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                    {formatILS(Number(r._sum.price ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-primary)]";
  return (
    <div className="bg-white rounded-xl card-shadow p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}
