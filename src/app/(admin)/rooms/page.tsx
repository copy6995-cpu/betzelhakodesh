import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { weekKeyOf, currentWeekKey, weekLabel } from "@/lib/weeks";
import { parashaForWeek } from "@/lib/hebrew-calendar";
import { getActiveYear } from "@/lib/year";
import { loadRoomDemand, mergeRoomUnits, physicalCode } from "@/lib/rooms";
import { RoomAssignmentUI } from "./assignment-ui";
import { RoomsExportButton } from "./export-button";
import { RoomDemandSummary } from "./demand-summary";

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

  const activeYear = await getActiveYear();

  const [rooms, yeshivot, allocations, allWeeks, demand] = await Promise.all([
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
    loadRoomDemand(activeYear),
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

  // Allocated rooms + beds per yeshiva for the current week — linked rooms
  // (א300_1/_2, א403_1/_2) count as one room; beds sum their capacity.
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const anyCapacity = rooms.some((r) => r.capacity != null);
  const allocatedByYeshiva: Record<string, { rooms: number; beds: number }> = {};
  const seenPhysical = new Map<string, Set<string>>(); // yeshiva -> physical codes
  for (const a of allocations) {
    const room = roomById.get(a.roomId);
    if (!room) continue;
    const acc = (allocatedByYeshiva[a.yeshiva] ??= { rooms: 0, beds: 0 });
    let phys = seenPhysical.get(a.yeshiva);
    if (!phys) {
      phys = new Set();
      seenPhysical.set(a.yeshiva, phys);
    }
    const pc = physicalCode(room.code);
    if (!phys.has(pc)) {
      phys.add(pc);
      acc.rooms++;
    }
    acc.beds += room.capacity ?? 0;
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
          <RoomsExportButton
            weekKey={weekKey}
            defaultLabel={parashaForWeek(new Date(`${weekKey}T00:00:00`))}
          />
          <Link
            href="/rooms/manage"
            className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] flex items-center"
          >
            🛏 מספר מיטות
          </Link>
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

      <RoomDemandSummary
        rows={demand.rows}
        totals={demand.totals}
        allocatedByYeshiva={allocatedByYeshiva}
        anyCapacity={anyCapacity}
      />

      <RoomAssignmentUI
        weekKey={weekKey}
        yeshivot={yeshivot.map((y) => y.name)}
        buildings={[...buildings.entries()].map(([building, rs]) => ({
          building,
          units: mergeRoomUnits(
            rs.map((r) => ({
              id: r.id,
              code: r.code,
              capacity: r.capacity,
              assignedTo: allocByRoom.get(r.id) ?? null,
            }))
          ),
        }))}
        countsByYeshiva={Object.fromEntries(countsByYeshiva)}
      />
    </div>
  );
}
