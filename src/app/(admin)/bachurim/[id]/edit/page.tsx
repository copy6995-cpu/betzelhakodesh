import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BachurEditForm } from "./form";

export const dynamic = "force-dynamic";

export default async function EditBachurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, yeshivot, shiurim, years] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: { parent: true, debts: { orderBy: { year: "asc" } } },
    }),
    prisma.yeshiva.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.shiur.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.student.groupBy({ by: ["year"], orderBy: { year: "desc" } }),
  ]);
  if (!student) return notFound();

  // Debt-year options: all known years (newest first), plus any already on a
  // debt row, so an existing value never disappears.
  const yearOptions = [
    ...new Set([...years.map((y) => y.year), ...student.debts.map((d) => d.year)]),
  ].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">
        עריכה: {student.lastName} {student.firstName}
      </h1>
      <BachurEditForm
        student={{
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          fatherName: student.fatherName,
          city: student.city ?? "",
          yeshiva: student.yeshiva,
          shiur: student.shiur ?? "",
          ariChul: student.ariChul ?? "",
          price: student.price ?? null,
          paymentMethod: student.paymentMethod ?? "",
          paymentsCount: student.paymentsCount ?? null,
          nedarimHook: student.nedarimHook ?? "",
          endDateLabel: student.endDateLabel ?? "",
          registeredEshel: student.registeredEshel,
          frozen: student.frozen,
          frozenReason: student.frozenReason ?? "",
          notes: student.notes ?? "",
          debts: student.debts.map((d) => ({
            year: d.year,
            amount: d.amount,
            note: d.note ?? "",
          })),
          parent: {
            id: student.parent.id,
            firstName: student.parent.firstName,
            lastName: student.parent.lastName,
            tz: student.parent.tz ?? "",
            phone: student.parent.phone ?? "",
            email: student.parent.email ?? "",
          },
        }}
        yeshivot={yeshivot.map((y) => y.name)}
        shiurim={shiurim.map((s) => s.name)}
        yearOptions={yearOptions}
      />
    </div>
  );
}
