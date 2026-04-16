import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { DeleteStudentButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function BachurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parent: { include: { students: { select: { id: true, year: true, firstName: true, lastName: true } } } },
      payments: { orderBy: { paymentNumber: "asc" } },
    },
  });

  if (!student) return notFound();

  const paid = student.payments.reduce((a, p) => a + Number(p.amount), 0);
  const price = student.price ?? 0;
  const remaining = price - paid;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/bachurim" className="hover:underline">
              בחורים
            </Link>
            {" / "}
            <span>{student.yeshiva}</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
            {student.lastName} {student.firstName}
          </h1>
          <div className="text-[var(--color-muted-foreground)] mt-1">
            {student.fatherName && `בן ${student.fatherName}`}
            {" · קוד אישי: "}
            <span className="font-mono font-medium text-[var(--color-foreground)]">
              {student.personalCode}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/bachurim/${student.id}/edit`}
            className="px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors flex items-center"
          >
            עריכה
          </Link>
          <DeleteStudentButton
            studentId={student.id}
            studentName={`${student.firstName} ${student.lastName}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
              פרטים
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="ישיבה" value={student.yeshiva} />
              <Field label="שיעור" value={student.shiur} />
              <Field label='אר"י/חו"ל' value={student.ariChul} />
              <Field label="עיר" value={student.city} />
              <Field label="שנה" value={student.year} />
              <Field label="רשום באש״ל" value={student.registeredEshel ? "כן" : "לא"} />
              <Field label="אמצעי תשלום" value={student.paymentMethod} />
              <Field label="תשלומים" value={student.paymentsCount?.toString()} />
              <Field label="מספר הוק בנדרים" value={student.nedarimHook} />
              <Field label="תאריך סיום" value={student.endDateLabel} />
              {student.notes && (
                <div className="col-span-full">
                  <FieldLabel>הערות</FieldLabel>
                  <div className="whitespace-pre-wrap text-sm mt-1">
                    {student.notes}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl card-shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                תשלומים
              </h2>
              <Link
                href={`/bachurim/${student.id}/payments/new`}
                className="px-3 h-8 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors flex items-center"
              >
                + תשלום חדש
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="py-2 pe-4 font-semibold">מס׳</th>
                    <th className="py-2 px-4 font-semibold">סכום</th>
                    <th className="py-2 px-4 font-semibold">אמצעי</th>
                    <th className="py-2 px-4 font-semibold">תאריך</th>
                    <th className="py-2 px-4 font-semibold">אסמכתא</th>
                  </tr>
                </thead>
                <tbody>
                  {student.payments.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2.5 pe-4">
                        {p.paymentNumber === 0 ? "נדרים" : `#${p.paymentNumber}`}
                      </td>
                      <td className="py-2.5 px-4 font-semibold">
                        {formatILS(Number(p.amount))}
                      </td>
                      <td className="py-2.5 px-4">{p.method ?? "—"}</td>
                      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                        {p.date ? new Date(p.date).toLocaleDateString("he-IL") : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                        {p.externalRef ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {student.payments.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-[var(--color-muted-foreground)]"
                      >
                        אין תשלומים לבחור זה עדיין.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
              תשלום
            </h2>
            <div className="space-y-3">
              <KV label="מחיר" value={formatILS(price)} />
              <KV label="שולם" value={formatILS(paid)} tone="success" />
              <KV
                label="יתרה"
                value={formatILS(remaining)}
                tone={remaining > 0 ? "warning" : "success"}
                bold
              />
            </div>
          </section>

          <section className="bg-white rounded-xl card-shadow p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
              הורה
            </h2>
            <Link
              href={`/parents/${student.parent.id}`}
              className="block text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium"
            >
              {student.parent.firstName} {student.parent.lastName}
            </Link>
            {student.parent.phone && (
              <div className="text-sm text-[var(--color-muted-foreground)] mt-1" dir="ltr">
                {student.parent.phone}
              </div>
            )}
            {student.parent.email && (
              <div
                className="text-sm text-[var(--color-muted-foreground)] mt-1 truncate"
                dir="ltr"
              >
                {student.parent.email}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
                כל הילדים ({formatNum(student.parent.students.length)})
              </div>
              <ul className="space-y-1">
                {student.parent.students.map((sib) => (
                  <li key={sib.id}>
                    <Link
                      href={`/bachurim/${sib.id}`}
                      className={`text-sm hover:underline ${
                        sib.id === student.id ? "font-semibold" : ""
                      }`}
                    >
                      {sib.firstName} {sib.lastName}{" "}
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        · {sib.year}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
      {children}
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
