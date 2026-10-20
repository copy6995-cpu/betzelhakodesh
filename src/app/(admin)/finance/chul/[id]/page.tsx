import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadChulRep } from "@/lib/reps";
import { DonationsGrid } from "./ui";

export const dynamic = "force-dynamic";

export default async function ChulRepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadChulRep(id);
  if (!data) return notFound();

  // A rep is locked to their own page — don't surface the "all reps" link to
  // them (the backend already blocks it; this just hides the dead-end button).
  const session = await auth();
  const isRep = (session?.user as { role?: string } | undefined)?.role === "rep";

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)] mb-1">
            נציג חול
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            {data.rep.name}
          </h1>
        </div>
        {!isRep && (
          <Link
            href="/finance/chul"
            className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
          >
            → כל נציגי החול
          </Link>
        )}
      </div>

      <DonationsGrid repId={data.rep.id} donations={data.donations} />
    </div>
  );
}
