import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { weekLabel } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export default async function RoomsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ yeshiva?: string }>;
}) {
  const sp = await searchParams;
  const yeshivaFilter = sp.yeshiva?.trim() || null;

  const [allocations, yeshivot] = await Promise.all([
    prisma.roomAllocation.findMany({
      where: yeshivaFilter ? { yeshiva: yeshivaFilter } : {},
      include: { room: true },
      orderBy: [{ weekKey: "desc" }, { yeshiva: "asc" }, { room: { code: "asc" } }],
    }),
    prisma.yeshiva.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      select: { name: true },
    }),
  ]);

  // Group: weekKey → yeshiva → rooms[]
  const byWeek = new Map<string, Map<string, string[]>>();
  for (const a of allocations) {
    const wk = byWeek.get(a.weekKey) ?? new Map<string, string[]>();
    const rs = wk.get(a.yeshiva) ?? [];
    rs.push(a.room.code);
    wk.set(a.yeshiva, rs);
    byWeek.set(a.weekKey, wk);
  }
  const weeks = [...byWeek.keys()].sort().reverse();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted-foreground)]">
          <Link href="/rooms" className="hover:underline">
            חלוקת חדרים
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          היסטוריית שיבוצים
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {formatNum(allocations.length)} שיבוצים · {weeks.length} שבועות
          {yeshivaFilter && ` · ${yeshivaFilter}`}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/rooms/history"
          className={
            "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
            (!yeshivaFilter ? "pill-active" : "pill-idle")
          }
        >
          כל הישיבות
        </Link>
        {yeshivot.map((y) => (
          <Link
            key={y.name}
            href={`/rooms/history?yeshiva=${encodeURIComponent(y.name)}`}
            className={
              "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
              (yeshivaFilter === y.name ? "pill-active" : "pill-idle")
            }
          >
            {y.name}
          </Link>
        ))}
      </div>

      {weeks.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-8 text-center text-[var(--color-muted-foreground)]">
          {yeshivaFilter
            ? `אין שיבוצי חדרים היסטוריים ל-${yeshivaFilter}.`
            : "אין שיבוצי חדרים היסטוריים."}
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map((weekKey) => {
            const blocks = [...(byWeek.get(weekKey) ?? new Map()).entries()]
              .map(([yeshiva, rooms]) => ({
                yeshiva,
                rooms: rooms as string[],
              }))
              .sort((a, b) => b.rooms.length - a.rooms.length);
            const total = blocks.reduce((n, b) => n + b.rooms.length, 0);
            return (
              <section
                key={weekKey}
                className="bg-white rounded-xl card-shadow overflow-hidden"
              >
                <div className="bg-[var(--color-primary)] text-white px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-semibold">
                    <Link
                      href={`/rooms?week=${weekKey}`}
                      className="hover:underline"
                    >
                      שבוע {weekLabel(weekKey)}
                    </Link>
                  </h2>
                  <span className="text-sm opacity-90">
                    {total} חדרים · {blocks.length} ישיבות
                  </span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {blocks.map((b) => (
                    <div
                      key={b.yeshiva}
                      className="p-4 flex flex-col md:flex-row gap-3"
                    >
                      <div className="md:w-[180px] font-semibold text-[var(--color-primary)] flex items-center justify-between md:block">
                        <span>{b.yeshiva}</span>
                        <span className="text-xs text-[var(--color-muted-foreground)] md:block">
                          {b.rooms.length} חדרים
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {b.rooms.map((code) => (
                          <span
                            key={code}
                            className="inline-block px-2 py-1 rounded bg-[var(--color-muted)] text-xs font-mono"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
