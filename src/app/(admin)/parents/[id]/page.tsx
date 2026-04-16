import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { ParentEditForm } from "./form";
import { MergeParentButton } from "./merge-button";
import { AddStudentButton } from "./add-student-button";

export const dynamic = "force-dynamic";

export default async function ParentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await prisma.parent.findUnique({
    where: { id },
    include: {
      students: {
        orderBy: [{ year: "desc" }, { firstName: "asc" }],
        include: { payments: { select: { amount: true } } },
      },
    },
  });
  if (!parent) return notFound();

  // group aggregated debt by year
  const byYear = new Map<string, { count: number; price: number; paid: number }>();
  for (const s of parent.students) {
    const slot = byYear.get(s.year) ?? { count: 0, price: 0, paid: 0 };
    slot.count++;
    slot.price += s.price ?? 0;
    slot.paid += s.payments.reduce((a, p) => a + Number(p.amount), 0);
    byYear.set(s.year, slot);
  }

  const totalPrice = parent.students.reduce((a, s) => a + (s.price ?? 0), 0);
  const totalPaid = parent.students.reduce(
    (a, s) => a + s.payments.reduce((b, p) => b + Number(p.amount), 0),
    0
  );
  const totalRemaining = totalPrice - totalPaid;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/parents" className="hover:underline">
              הורים
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
            {parent.lastName} {parent.firstName}
          </h1>
        </div>
        <div className="flex gap-2">
          <AddStudentButton
            targetParentId={parent.id}
            targetParentName={`${parent.firstName} ${parent.lastName}`}
          />
          <MergeParentButton
            keepParentId={parent.id}
            keepParentName={`${parent.firstName} ${parent.lastName}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
              ילדים ({formatNum(parent.students.length)})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="py-2 pe-4 font-semibold">שם</th>
                    <th className="py-2 px-4 font-semibold">שנה</th>
                    <th className="py-2 px-4 font-semibold">ישיבה</th>
                    <th className="py-2 px-4 font-semibold">מחיר</th>
                    <th className="py-2 px-4 font-semibold">שולם</th>
                    <th className="py-2 px-4 font-semibold">יתרה</th>
                  </tr>
                </thead>
                <tbody>
                  {parent.students.map((s) => {
                    const paid = s.payments.reduce((a, p) => a + Number(p.amount), 0);
                    const price = s.price ?? 0;
                    const remaining = price - paid;
                    return (
                      <tr key={s.id} className="border-b border-[var(--color-border)]/40">
                        <td className="py-2.5 pe-4">
                          <Link
                            href={`/bachurim/${s.id}`}
                            className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                          >
                            {s.firstName} {s.lastName}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4">{s.year}</td>
                        <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                          {s.yeshiva}
                        </td>
                        <td className="py-2.5 px-4">{formatILS(price)}</td>
                        <td className="py-2.5 px-4 text-[var(--color-success)]">
                          {formatILS(paid)}
                        </td>
                        <td
                          className={`py-2.5 px-4 font-semibold ${
                            remaining > 0
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-success)]"
                          }`}
                        >
                          {formatILS(remaining)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
              סיכום לפי שנה
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="py-2 pe-4 font-semibold">שנה</th>
                    <th className="py-2 px-4 font-semibold">ילדים</th>
                    <th className="py-2 px-4 font-semibold">מחיר</th>
                    <th className="py-2 px-4 font-semibold">שולם</th>
                    <th className="py-2 px-4 font-semibold">יתרה</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byYear.entries()].map(([yr, s]) => {
                    const rem = s.price - s.paid;
                    return (
                      <tr key={yr} className="border-b border-[var(--color-border)]/40">
                        <td className="py-2.5 pe-4 font-semibold">{yr}</td>
                        <td className="py-2.5 px-4">{formatNum(s.count)}</td>
                        <td className="py-2.5 px-4">{formatILS(s.price)}</td>
                        <td className="py-2.5 px-4 text-[var(--color-success)]">
                          {formatILS(s.paid)}
                        </td>
                        <td
                          className={`py-2.5 px-4 font-semibold ${
                            rem > 0
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-success)]"
                          }`}
                        >
                          {formatILS(rem)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
              יתרה כוללת
            </h2>
            <div className="space-y-3">
              <KV label="מחיר" value={formatILS(totalPrice)} />
              <KV label="שולם" value={formatILS(totalPaid)} tone="success" />
              <KV
                label="יתרה"
                value={formatILS(totalRemaining)}
                tone={totalRemaining > 0 ? "warning" : "success"}
                bold
              />
            </div>
          </section>

          <ParentEditForm
            parent={{
              id: parent.id,
              firstName: parent.firstName,
              lastName: parent.lastName,
              tz: parent.tz ?? "",
              phone: parent.phone ?? "",
              email: parent.email ?? "",
              city: parent.city ?? "",
              notes: parent.notes ?? "",
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  tone = "default",
  bold = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  bold?: boolean;
}) {
  const cls =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-foreground)]";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
      <span className={`${bold ? "text-lg font-bold" : "font-medium"} ${cls}`}>
        {value}
      </span>
    </div>
  );
}
