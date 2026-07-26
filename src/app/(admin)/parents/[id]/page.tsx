import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { ParentEditForm } from "./form";
import { MergeParentButton } from "./merge-button";
import { AddStudentButton } from "./add-student-button";
import { DeleteParentButton } from "./delete-button";
import { ChargeButton } from "../../nedarim/hoks/charge-button";

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

  // Nedarim HoKs the family holds — via any child's nedarimHook. A single
  // parent may have several HoKs across kids and years (each year is a new
  // HoK per the user's flow).
  const hookNumbers = [
    ...new Set(
      parent.students
        .map((s) => s.nedarimHook)
        .filter((h): h is string => !!h && h.length > 0)
    ),
  ];
  const familyHoks = hookNumbers.length
    ? await prisma.nedarimKeva.findMany({
        where: { kevaId: { in: hookNumbers } },
        orderBy: [{ errorText: "desc" }, { nextDate: "asc" }],
      })
    : [];
  // Reverse map: hook → the students that hold it, so each row can name
  // the specific bachur (with year).
  const studentsByHook = new Map<
    string,
    Array<(typeof parent.students)[number]>
  >();
  for (const s of parent.students) {
    if (!s.nedarimHook) continue;
    const arr = studentsByHook.get(s.nedarimHook) ?? [];
    arr.push(s);
    studentsByHook.set(s.nedarimHook, arr);
  }

  // Family-level Nedarim transaction totals: what the parent actually paid
  // in via credit-card charges across all their kids' hooks.
  const familyTx = hookNumbers.length
    ? await prisma.nedarimTransaction.aggregate({
        where: { kevaId: { in: hookNumbers } },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : { _sum: { amount: null }, _count: { _all: 0 } };
  const nedarimPaidTotal = Number(familyTx._sum.amount ?? 0);
  const nedarimTxCount = familyTx._count._all;

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
            keepParentLastName={parent.lastName}
          />
          <DeleteParentButton
            parentId={parent.id}
            parentName={`${parent.firstName} ${parent.lastName}`}
            studentCount={parent.students.length}
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

          {familyHoks.length > 0 && (
            <section className="bg-white rounded-xl card-shadow p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                  הוראות קבע
                </h2>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {familyHoks.length} הו״ק ·{" "}
                  {formatILS(
                    familyHoks.reduce((a, h) => a + Number(h.amount ?? 0), 0)
                  )}{" "}
                  לחודש
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <th className="py-2 pe-4 font-semibold">הו״ק</th>
                      <th className="py-2 px-4 font-semibold">בחור/שנה</th>
                      <th className="py-2 px-4 font-semibold">חודשי</th>
                      <th className="py-2 px-4 font-semibold">בוצע/יתרה</th>
                      <th className="py-2 px-4 font-semibold">חיוב הבא</th>
                      <th className="py-2 px-4 font-semibold">כרטיס</th>
                      <th className="py-2 px-4 font-semibold w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyHoks.map((h) => {
                      const owners = studentsByHook.get(h.kevaId) ?? [];
                      return (
                        <tr
                          key={h.id}
                          className={
                            "border-b border-[var(--color-border)]/40 " +
                            (h.errorText ? "bg-red-50/40" : "")
                          }
                        >
                          <td className="py-2.5 pe-4 font-mono text-xs text-[var(--color-muted-foreground)]">
                            #{h.kevaId}
                            {h.errorText && (
                              <div className="text-xs text-red-700 mt-0.5 font-sans">
                                ⚠️ {h.errorText}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            {owners.map((o, i) => (
                              <span key={o.id}>
                                {i > 0 && " · "}
                                <Link
                                  href={`/bachurim/${o.id}`}
                                  className="text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                                >
                                  {o.firstName} {o.lastName}
                                  <span className="opacity-60"> · {o.year}</span>
                                </Link>
                              </span>
                            ))}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[var(--color-success)] whitespace-nowrap">
                            {h.amount !== null ? formatILS(h.amount) : "—"}
                            {h.currency === 2 && (
                              <span className="text-xs opacity-60"> ($)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                            <span className="font-semibold text-[var(--color-success)]">
                              {h.success ?? 0}
                            </span>
                            {" / "}
                            <span className="font-semibold text-[var(--color-accent)]">
                              {h.itra ?? 0}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-[var(--color-muted-foreground)] font-mono whitespace-nowrap">
                            {h.nextDate ?? "—"}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-mono text-[var(--color-muted-foreground)] whitespace-nowrap">
                            {h.lastNum ? `**** ${h.lastNum}` : "—"}
                            {h.tokef && (
                              <span className="ms-1 opacity-70">({h.tokef})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <ChargeButton
                              kevaId={h.kevaId}
                              defaultAmount={h.amount}
                              clientName={h.clientName}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {nedarimTxCount > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]">
                  שולם בפועל דרך נדרים פלוס:{" "}
                  <b>{formatILS(nedarimPaidTotal)}</b> ב-{formatNum(nedarimTxCount)}{" "}
                  עסקאות.{" "}
                  <Link
                    href={`/nedarim/transactions?scope=all&q=${encodeURIComponent(
                      hookNumbers.join(" ")
                    )}`}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    צפה בכל העסקאות ←
                  </Link>
                </div>
              )}
            </section>
          )}

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
