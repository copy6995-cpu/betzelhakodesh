import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { settleDebts } from "@/lib/debts";

export const dynamic = "force-dynamic";

const PAID_C = "#3b6fb0"; // blue — collected
const REM_C = "#e8843a"; // orange — remaining

export default async function DebtsPage() {
  const students = await prisma.student.findMany({
    where: { debts: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personalCode: true,
      price: true,
      debts: { select: { year: true, amount: true } },
      payments: { select: { amount: true } },
    },
  });

  type YAgg = { total: number; collected: number; remaining: number; students: number };
  const byYear = new Map<string, YAgg>();
  type DrillRow = {
    studentId: string;
    name: string;
    code: string;
    year: string;
    amount: number;
    collected: number;
    remaining: number;
  };
  const drill: DrillRow[] = [];

  for (const s of students) {
    const paid = s.payments.reduce((a, p) => a + Number(p.amount), 0);
    const st = settleDebts(
      s.debts.map((d) => ({ year: d.year, amount: d.amount })),
      s.price ?? 0,
      paid
    );
    for (const d of st.debts) {
      const a =
        byYear.get(d.year) ?? { total: 0, collected: 0, remaining: 0, students: 0 };
      a.total += d.amount;
      a.collected += d.paid;
      a.remaining += d.remaining;
      a.students += 1;
      byYear.set(d.year, a);
      drill.push({
        studentId: s.id,
        name: `${s.lastName} ${s.firstName}`.trim(),
        code: s.personalCode,
        year: d.year,
        amount: d.amount,
        collected: d.paid,
        remaining: d.remaining,
      });
    }
  }

  const years = [...byYear.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
  const totals = years.reduce(
    (acc, y) => ({
      total: acc.total + y.total,
      collected: acc.collected + y.collected,
      remaining: acc.remaining + y.remaining,
    }),
    { total: 0, collected: 0, remaining: 0 }
  );
  drill.sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, "he"));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/payments" className="hover:underline">
            תשלומים
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          חובות — סיכום לפי שנים
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          חובות משנים קודמות שנרשמו על הבחורים. תשלומים נסגרים קודם על החובות
          (מהישן לחדש) ואז על השנתי.
        </p>
      </div>

      {years.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-10 text-center">
          <p className="text-[var(--color-muted-foreground)]">
            אין חובות רשומים.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="סה״כ חובות" value={formatILS(totals.total)} tone="primary" />
            <Stat label="נגבה" value={formatILS(totals.collected)} tone="success" />
            <Stat label="נשאר לגבות" value={formatILS(totals.remaining)} tone="accent" />
          </div>

          {/* Pie per year */}
          <div className="bg-white rounded-xl card-shadow mb-6 p-5">
            <div className="text-sm font-semibold text-[var(--color-primary)] mb-4">
              נגבה מול נשאר — לכל שנה
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
              {years.map((y) => (
                <div key={y.year} className="flex flex-col items-center text-center">
                  <div className="text-sm font-semibold mb-1">{y.year}</div>
                  <Pie collected={y.collected} remaining={y.remaining} size={96} />
                  <div className="text-[11px] text-[var(--color-muted-foreground)] mt-1 leading-tight">
                    נשאר{" "}
                    <span className="text-red-600 font-semibold">
                      {formatILS(y.remaining)}
                    </span>
                    <br />
                    מתוך {formatILS(y.total)} · {formatNum(y.students)} בחורים
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drill-down */}
          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <div className="text-sm font-semibold text-[var(--color-primary)]">
                {formatNum(drill.length)} שורות חוב
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                    <th className="py-3 pe-5 ps-5 font-semibold">בחור</th>
                    <th className="py-3 px-4 font-semibold">שנת חוב</th>
                    <th className="py-3 px-4 font-semibold">חוב</th>
                    <th className="py-3 px-4 font-semibold">נגבה</th>
                    <th className="py-3 px-4 font-semibold">נשאר</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2.5 pe-5 ps-5">
                        <Link
                          href={`/bachurim/${r.studentId}`}
                          className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                        >
                          {r.name}
                        </Link>
                        <div className="text-xs text-[var(--color-muted-foreground)] font-mono">
                          {r.code}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                        {r.year}
                      </td>
                      <td className="py-2.5 px-4">{formatILS(r.amount)}</td>
                      <td className="py-2.5 px-4 text-[var(--color-success)]">
                        {formatILS(r.collected)}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-semibold ${
                          r.remaining > 0
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-success)]"
                        }`}
                      >
                        {r.remaining > 0 ? formatILS(r.remaining) : "שולם ✓"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "accent";
}) {
  const c =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "accent"
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-primary)]";
  return (
    <div className="bg-white rounded-xl card-shadow px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${c}`}>{value}</div>
      <div className="text-xs text-[var(--color-muted-foreground)] mt-1">{label}</div>
    </div>
  );
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a0 = 2 * Math.PI * from - Math.PI / 2;
  const a1 = 2 * Math.PI * to - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function Pie({
  collected,
  remaining,
  size = 96,
}: {
  collected: number;
  remaining: number;
  size?: number;
}) {
  const total = collected + remaining;
  const f = total > 0 ? collected / total : 0;
  const r = size / 2;
  const pct = (f * 100).toFixed(1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={r} cy={r} r={r} fill={REM_C} />
      {f >= 1 ? (
        <circle cx={r} cy={r} r={r} fill={PAID_C} />
      ) : (
        f > 0 && <path d={arc(r, r, r, 0, f)} fill={PAID_C} />
      )}
      <text
        x={r}
        y={r}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={size * 0.2}
        fontWeight="700"
      >
        {pct}%
      </text>
    </svg>
  );
}
