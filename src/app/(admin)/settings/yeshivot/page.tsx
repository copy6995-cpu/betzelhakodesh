import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { YeshivotManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function YeshivotSettingsPage() {
  const yeshivot = await prisma.yeshiva.findMany({ orderBy: { displayOrder: "asc" } });
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/settings" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
          → הגדרות
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">ניהול ישיבות</h1>
      </div>
      <YeshivotManager yeshivot={yeshivot} />
    </div>
  );
}
