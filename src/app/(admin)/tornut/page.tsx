import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { loadTornut } from "@/lib/tornut";
import { TornutBoard } from "./ui";

export const dynamic = "force-dynamic";

export default async function TornutPage() {
  const session = await auth();
  const u = session?.user as
    | { role?: string; repId?: string | null }
    | undefined;
  const isAdmin = u?.role === "admin";
  const year = await getActiveYear();

  let viewerYeshiva: string | null = null;
  if (u?.role === "rep" && u.repId) {
    const rep = await prisma.representative.findUnique({
      where: { id: u.repId },
      select: { yeshiva: true, kind: true },
    });
    if (rep?.kind === "yeshiva") viewerYeshiva = rep.yeshiva ?? null;
  }

  const [data, yeshivot] = await Promise.all([
    loadTornut(year),
    isAdmin
      ? prisma.yeshiva.findMany({
          where: { active: true },
          orderBy: { displayOrder: "asc" },
          select: { name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          תורנות שבתות
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          שנת {year} ·{" "}
          {isAdmin
            ? "הגדירו רמות ושבתות; כל נציג ישיבה בוחר שבתות פנויות בהתאם למגבלה."
            : viewerYeshiva
            ? `בחרו שבתות פנויות עבור ${viewerYeshiva}. אפשר לראות מה בחרו האחרים, אך לא לשנות.`
            : "צפייה בתורנות."}
        </p>
      </div>

      <TornutBoard
        isAdmin={isAdmin}
        viewerYeshiva={viewerYeshiva}
        data={data}
        yeshivot={yeshivot.map((y) => y.name)}
      />
    </div>
  );
}
