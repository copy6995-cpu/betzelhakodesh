import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatILS, formatNum } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { getExpiredEndDateLabels, isEshelActive } from "@/lib/eshel";
import { DeleteStudentButton } from "./delete-button";
import { PromoteStudentButton } from "./promote-button";

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

  // Suggested target years for the promote button: every year we already
  // know about from other students. The button always shows now — the
  // admin picks the target (or types a fresh year), and the server action
  // still rejects a target that already has this personalCode.
  const activeYear = await getActiveYear();
  const distinctYears = await prisma.student.groupBy({
    by: ["year"],
    orderBy: { year: "desc" },
  });
  const suggestedYears = [
    ...new Set([activeYear, ...distinctYears.map((y) => y.year)]),
  ];

  // Bed reservations from Yemot HaMashiach are matched by personalCode
  // (that's the identifier the phone system uses). Since the same
  // personalCode carries across school years, we scope the visible list to
  // reservations made ON/AFTER the student's row was created — a תשפ״ז
  // record imported in July 2026 shouldn't show reservations from earlier
  // that year (those belong to the תשפ״ו record of the same person).
  const bedReservationsAll = await prisma.yemotBedReservation.findMany({
    where: { personalCode: student.personalCode },
    orderBy: [{ weekKey: "desc" }, { date: "desc" }],
  });
  function parseDmy(d: string | null | undefined): Date | null {
    if (!d) return null;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    if (!m) return null;
    return new Date(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10)
    );
  }
  const cutoff = student.createdAt;
  const bedReservations = bedReservationsAll.filter((r) => {
    const d = parseDmy(r.date);
    // Reservations without a date fall in — they might legitimately belong
    // here and we don't want to silently hide data.
    if (!d) return true;
    return d.getTime() >= cutoff.getTime();
  });
  const approvedBeds = bedReservations.filter((r) => r.status === "מאושר").length;
  const hiddenByYearBoundary = bedReservationsAll.length - bedReservations.length;

  // Nedarim transactions attached to this student's hook. Same year-scoping
  // as bed reservations — only show transactions from ON/AFTER the student
  // row's createdAt so a תשפ״ז record doesn't display תשפ״ו payments.
  const nedarimTxsAll = student.nedarimHook
    ? await prisma.nedarimTransaction.findMany({
        where: { kevaId: student.nedarimHook },
        orderBy: { transactionTime: "desc" },
      })
    : [];
  const nedarimTxs = nedarimTxsAll.filter((t) => {
    if (!t.transactionTime) return true;
    return t.transactionTime.getTime() >= student.createdAt.getTime();
  });
  const nedarimHiddenByYear = nedarimTxsAll.length - nedarimTxs.length;
  const nedarimPaidTotal = nedarimTxs.reduce(
    (a, t) => a + Number(t.amount ?? 0),
    0
  );

  // Yemot credit-card registrations — matched by (personalCode, year). The
  // card rows carry the registration target year, so no createdAt cutoff is
  // needed like the bed/nedarim lists above.
  const yemotCards = await prisma.yemotCreditCard.findMany({
    where: { personalCode: student.personalCode, year: student.year },
    orderBy: { date: "desc" },
  });
  const approvedCards = yemotCards.filter((c) => c.status === "מאושר");

  // Effective אש"ל status: booked AND the season hasn't lapsed. The season's
  // cutoff date lives in EndDateOption(year, endDateLabel).
  const expiredLabels = await getExpiredEndDateLabels(student.year);
  const eshelActive = isEshelActive(
    student.registeredEshel,
    student.endDateLabel,
    expiredLabels
  );
  const eshelLapsed = student.registeredEshel && !eshelActive;
  const seasonOption = student.endDateLabel
    ? await prisma.endDateOption.findUnique({
        where: {
          year_label: { year: student.year, label: student.endDateLabel },
        },
        select: { date: true },
      })
    : null;
  const seasonDate = seasonOption?.date ?? null;
  const eshelValue = eshelActive
    ? "כן"
    : eshelLapsed
    ? "לא (פג תוקף)"
    : "לא";
  const endDateValue = student.endDateLabel
    ? seasonDate
      ? `${student.endDateLabel} · ${seasonDate.toLocaleDateString("he-IL")}`
      : student.endDateLabel
    : null;

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
        <div className="flex gap-2 items-start">
          <PromoteStudentButton
            studentId={student.id}
            currentYear={student.year}
            suggestedYears={suggestedYears}
          />
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
              <Field label="רשום באש״ל" value={eshelValue} />
              <Field label="אמצעי תשלום" value={student.paymentMethod} />
              <Field label="תשלומים" value={student.paymentsCount?.toString()} />
              <Field
                label="מספר הוק בנדרים"
                value={
                  student.nedarimHook ||
                  approvedCards.map((c) => c.approvalNum).join(", ") ||
                  null
                }
              />
              <Field label="תאריך סיום" value={endDateValue} />
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

          <section className="bg-white rounded-xl card-shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                הזמנות מיטה
              </h2>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {approvedBeds > 0
                  ? `${approvedBeds} שבועות מאושרים · ${student.year}`
                  : "אין הזמנות"}
              </div>
            </div>
            {hiddenByYearBoundary > 0 && (
              <div className="mb-3 text-xs text-[var(--color-muted-foreground)] bg-[var(--color-muted)] rounded px-3 py-1.5">
                מוצגות רק הזמנות מתאריך יצירת הרשומה (
                {student.createdAt.toLocaleDateString("he-IL")}) ואילך.{" "}
                <b>{hiddenByYearBoundary}</b> הזמנות נוספות מוקדמות יותר שייכות
                לרשומה של שנה קודמת.
              </div>
            )}
            {bedReservations.length === 0 ? (
              <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                אין הזמנות מיטה מימות המשיח לבחור זה.
                <br />
                <Link
                  href="/settings/yemot"
                  className="text-[var(--color-accent)] hover:underline text-xs"
                >
                  סנכרן נתונים
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <th className="py-2 pe-4 font-semibold">שבוע</th>
                      <th className="py-2 px-4 font-semibold">תאריך עברי</th>
                      <th className="py-2 px-4 font-semibold">תאריך</th>
                      <th className="py-2 px-4 font-semibold">מצב</th>
                      <th className="py-2 px-4 font-semibold">מקור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bedReservations.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[var(--color-border)]/40"
                      >
                        <td className="py-2.5 pe-4 font-mono text-xs">
                          {r.weekKey}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                          {r.hebDate ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                          {r.date ?? "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          {r.status === "מאושר" ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                              מאושר
                            </span>
                          ) : r.status === "אזל" ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">
                              אזל
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted-foreground)] text-xs">
                              {r.status ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs" dir="ltr">
                          {r.source}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {yemotCards.length > 0 && (
            <section className="bg-white rounded-xl card-shadow p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                  סליקות אשראי (ימות המשיח)
                </h2>
                <Link
                  href={`/yemot/credit-cards?year=${encodeURIComponent(
                    student.year
                  )}&q=${encodeURIComponent(student.personalCode)}`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  הצג בעמוד הסליקות ←
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <th className="py-2 pe-4 font-semibold">תאריך</th>
                      <th className="py-2 px-4 font-semibold">סכום</th>
                      <th className="py-2 px-4 font-semibold">תשלומים</th>
                      <th className="py-2 px-4 font-semibold">מס׳ אישור (הו״ק)</th>
                      <th className="py-2 px-4 font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yemotCards.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--color-border)]/40"
                      >
                        <td className="py-2.5 pe-4 text-[var(--color-muted-foreground)] font-mono text-xs whitespace-nowrap">
                          {c.date ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                          {c.amount !== null ? formatILS(Number(c.amount)) : "—"}
                          {c.currency === 2 && (
                            <span className="text-xs opacity-60"> ($)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {c.installments ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs">
                          {c.approvalNum ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          {c.status === "מאושר" ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                              מאושר
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted-foreground)]">
                              {c.status ?? "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {student.nedarimHook && (
            <section className="bg-white rounded-xl card-shadow p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                  עסקאות נדרים
                </h2>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {nedarimTxs.length > 0
                    ? `${nedarimTxs.length} עסקאות · סה״כ ${formatILS(nedarimPaidTotal)}`
                    : "אין עסקאות"}
                  {" · הוראת קבע "}
                  <Link
                    href={`/nedarim/transactions?scope=all&hook=${student.nedarimHook}`}
                    className="font-mono text-[var(--color-accent)] hover:underline"
                  >
                    {student.nedarimHook}
                  </Link>
                </div>
              </div>
              {nedarimHiddenByYear > 0 && (
                <div className="mb-3 text-xs text-[var(--color-muted-foreground)] bg-[var(--color-muted)] rounded px-3 py-1.5">
                  מוצגות רק עסקאות מתאריך יצירת הרשומה (
                  {student.createdAt.toLocaleDateString("he-IL")}) ואילך.{" "}
                  <b>{nedarimHiddenByYear}</b> עסקאות מוקדמות יותר שייכות לרשומה
                  של שנה קודמת.
                </div>
              )}
              {nedarimTxs.length === 0 ? (
                <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                  אין עסקאות שסונכרנו לתלמיד זה עדיין.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                        <th className="py-2 pe-4 font-semibold">תאריך</th>
                        <th className="py-2 px-4 font-semibold">סכום</th>
                        <th className="py-2 px-4 font-semibold">סוג</th>
                        <th className="py-2 px-4 font-semibold">אישור</th>
                        <th className="py-2 px-4 font-semibold">מזהה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nedarimTxs.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-[var(--color-border)]/40"
                        >
                          <td className="py-2.5 pe-4 text-[var(--color-muted-foreground)] whitespace-nowrap">
                            {t.transactionTime
                              ? t.transactionTime.toLocaleDateString("he-IL")
                              : "—"}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[var(--color-success)]">
                            {t.amount !== null ? formatILS(Number(t.amount)) : "—"}
                            {t.currency === 2 && (
                              <span className="text-xs opacity-60"> ($)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            {t.transactionType ?? "—"}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                            {t.confirmation ?? "—"}
                          </td>
                          <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
                            {t.transactionId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
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

          {bedReservations.length > 0 && (
            <section className="bg-white rounded-xl card-shadow p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
                מיטות
              </h2>
              <div className="space-y-3">
                <KV
                  label="שבועות מאושרים"
                  value={formatNum(approvedBeds)}
                  tone={approvedBeds > 0 ? "success" : "default"}
                  bold
                />
                <KV
                  label='רשום באש"ל'
                  value={eshelValue}
                  tone={
                    approvedBeds > 0 && !eshelActive ? "warning" : "success"
                  }
                />
                {approvedBeds > 0 && !eshelActive && (
                  <div className="text-xs text-red-700 pt-2 border-t border-[var(--color-border)]">
                    ⚠️ הזמין מיטה אך {eshelLapsed ? "פג תוקף אש״ל" : "אינו רשום באש״ל"}
                  </div>
                )}
              </div>
            </section>
          )}

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
