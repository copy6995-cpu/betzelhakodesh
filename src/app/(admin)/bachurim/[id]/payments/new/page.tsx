import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PaymentForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { payments: { select: { paymentNumber: true } } },
  });
  if (!student) return notFound();
  const usedNumbers = new Set(student.payments.map((p) => p.paymentNumber));
  const availableNumbers = [0, 1, 2, 3, 4, 5, 6].filter((n) => !usedNumbers.has(n));

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">
        תשלום חדש: {student.firstName} {student.lastName}
      </h1>
      <PaymentForm
        studentId={student.id}
        availableNumbers={availableNumbers.length ? availableNumbers : [0, 1, 2, 3, 4, 5, 6]}
      />
    </div>
  );
}
