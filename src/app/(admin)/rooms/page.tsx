import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { weekKeyOf, currentWeekKey, weekLabel } from "@/lib/weeks";
import { RoomAssignmentUI } from "./assignment-ui";

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  // Snap to Sunday: if the user passed any date, we normalize it to the Sunday
  // of that week so the URL always represents a week key.
  const raw = sp.week?.trim();
  const weekKey = raw ? weekKeyOf(new Date(raw)) : currentWeekKey();

  const [rooms, yeshivot, allocations, allWeeks] = await Promise.all([
    prisma.room.findMany({
      where: { active: true },
      orderBy: [{ building: "asc" }, { order: "asc" }],
    }),
    prisma.yeshiva.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.roomAllocation.findMany({ where: { weekKey } }),
    prisma.roomAllocation.groupBy({
      by: ["weekKey"],
      _count: { _all: true },
      orderBy: { weekKey: "desc" },
      take: 8,
    }),
  ]);

  // Group rooms by building for display.
  const buildings = new Map<string, typeof rooms>();
  for (const r of rooms) {
    const b = buildings.get(r.building) ?? [];
    b.push(r);
    buildings.set(r.building, b);
  }

  const allocByRoom = new Map<string, string>();
  for (const a of allocations) allocByRoom.set(a.roomId, a.yeshiva);

  const countsByYeshiva = new Map<string, number>();
  for (const a of allocations) {
    countsByYeshiva.set(a.yeshiva, (countsByYeshiva.get(a.yeshiva) ?? 0) + 1);
  }

  const unassignedCount = rooms.length - allocations.length;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]">
            חלוקת חדרים
          </h1>
          <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
            {formatNum(rooms.length)} חדרים · {formatNum(allocations.length)}{" "}
            משובצים · {formatNum(unassignedCount)} פנויים · שבוע{" "}
            <b>{weekLabel(weekKey)}</b>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`/api/rooms/export?week=${weekKey}`}
            className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] flex items-center"
          >
            ↓ יצוא לפי ישיבה (zip)
          </a>
          <Link
            href="/rooms/import"
            className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] flex items-center"
          >
            📤 ייבוא היסטוריה
          </Link>
          <Link
            href="/rooms/history"
            className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] flex items-center"
          >
            היסטוריה ←
          </Link>
        </div>
      </div>

      {allWeeks.length > 1 && (
        <div className="mb-4 text-xs text-[var(--color-muted-foreground)] flex flex-wrap gap-2 items-center">
          שבועות אחרונים:{" "}
          {allWeeks.map((w) => (
            <Link
              key={w.weekKey}
              href={`/rooms?week=${w.weekKey}`}
              className={
                "px-2 py-0.5 rounded border transition-colors " +
                (w.weekKey === weekKey
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]")
              }
            >
              {weekLabel(w.weekKey)}
              <span className="ms-1 opacity-70">({w._count._all})</span>
            </Link>
          ))}
        </div>
      )}

      <RoomAssignmentUI
        weekKey={weekKey}
        yeshivot={yeshivot.map((y) => y.name)}
        buildings={[...buildings.entries()].map(([building, rs]) => ({
          building,
          rooms: rs.map((r) => ({
            id: r.id,
            code: r.code,
            assignedTo: allocByRoom.get(r.id) ?? null,
          })),
        }))}
        countsByYeshiva={Object.fromEntries(countsByYeshiva)}
      />
    </div>
  );
}
