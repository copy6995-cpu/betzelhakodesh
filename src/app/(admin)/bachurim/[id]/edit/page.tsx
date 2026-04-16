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
  const [student, yeshivot, shiurim] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: { parent: true },
    }),
    prisma.yeshiva.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.shiur.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);
  if (!student) return notFound();

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
          notes: student.notes ?? "",
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
      />
    </div>
  );
}
