import { prisma } from "@/lib/prisma";
import { NewBachurForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewBachurPage() {
  const [yeshivot, shiurim] = await Promise.all([
    prisma.yeshiva.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.shiur.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">בחור חדש</h1>
      <NewBachurForm
        yeshivot={yeshivot.map((y) => y.name)}
        shiurim={shiurim.map((s) => s.name)}
      />
    </div>
  );
}
