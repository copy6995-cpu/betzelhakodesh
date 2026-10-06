import { prisma } from "@/lib/prisma";
import { weekKeyOf, currentWeekKey, weekLabel } from "@/lib/weeks";
import { mergeRoomUnits, type RoomUnit } from "@/lib/rooms";
import { orderCalendarYeshivot } from "@/lib/calendar-export";
import { PrintControls } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Print-optimized room-assignment report, one מתחם (אגף = Room.building) per
 * page, each headed "[מתחם] - [ישיבה]". Rendered as HTML so the browser's
 * "Save as PDF" handles Hebrew RTL perfectly; a visibility trick isolates it
 * from the admin chrome when printing.
 */
export default async function RoomsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; label?: string }>;
}) {
  const sp = await searchParams;
  const weekKey = sp.week?.trim()
    ? weekKeyOf(new Date(sp.week))
    : currentWeekKey();
  const label = (sp.label ?? "").trim();

  const allocations = await prisma.roomAllocation.findMany({
    where: { weekKey },
    include: { room: true },
  });

  // yeshiva → building → rooms (raw), then collapse linked rooms into units.
  const byYeshiva = new Map<string, Map<string, RoomUnit[]>>();
  const rawByYB = new Map<
    string,
    Map<string, { id: string; code: string; capacity: number | null; order: number }[]>
  >();
  for (const a of allocations) {
    const yb = rawByYB.get(a.yeshiva) ?? new Map();
    const arr = yb.get(a.room.building) ?? [];
    arr.push({
      id: a.roomId,
      code: a.room.code,
      capacity: a.room.capacity,
      order: a.room.order,
    });
    yb.set(a.room.building, arr);
    rawByYB.set(a.yeshiva, yb);
  }
  for (const [yeshiva, yb] of rawByYB) {
    const buildings = new Map<string, RoomUnit[]>();
    for (const [building, rooms] of yb) {
      rooms.sort((x, y) => x.order - y.order || x.code.localeCompare(y.code, "he"));
      buildings.set(
        building,
        mergeRoomUnits(rooms.map((r) => ({ ...r, assignedTo: yeshiva })))
      );
    }
    byYeshiva.set(yeshiva, buildings);
  }

  const names = [...byYeshiva.keys()];
  const ordered = orderCalendarYeshivot(names);
  const yeshivaOrder = [...ordered, ...names.filter((n) => !ordered.includes(n))];

  // One page per מתחם (building): a yeshiva spanning several מתחמים is split so
  // each prints on its own page, headed "[מתחם] - [ישיבה]".
  const pages: { yeshiva: string; building: string; units: RoomUnit[] }[] = [];
  for (const yeshiva of yeshivaOrder) {
    const buildings = byYeshiva.get(yeshiva)!;
    for (const [building, units] of buildings) {
      pages.push({ yeshiva, building, units });
    }
  }

  const anyCapacity = allocations.some((a) => a.room.capacity != null);
  const title = `חלוקת חדרים${label ? ` — ${label}` : ""}`;

  return (
    <div className="print-root" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm; }
          body * { visibility: hidden; }
          .print-root, .print-root * { visibility: visible; }
          .print-root { position: absolute; inset: 0; margin: 0; }
          .no-print { display: none !important; }
          .yeshiva-page { page-break-before: always; }
          .yeshiva-page:first-of-type { page-break-before: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            {title}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            שבוע {weekLabel(weekKey)} · {allocations.length} חדרים ·{" "}
            {yeshivaOrder.length} ישיבות
          </p>
        </div>
        <PrintControls />
      </div>

      {allocations.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">
          אין שיבוצי חדרים לשבוע זה.
        </p>
      ) : (
        <div className="space-y-8">
          {pages.map(({ yeshiva, building, units }) => {
            const bedCount = units.reduce((m, u) => m + (u.capacity ?? 0), 0);
            return (
              <section key={`${yeshiva}|${building}`} className="yeshiva-page">
                <div className="flex items-baseline justify-between border-b-2 border-[var(--color-primary)] pb-1 mb-3">
                  <h2 className="text-xl font-bold text-[var(--color-primary)]">
                    {building} - {yeshiva}
                  </h2>
                  <span className="text-sm text-[var(--color-muted-foreground)]">
                    {label ? `${label} · ` : ""}
                    {units.length} חדרים
                    {anyCapacity ? ` · ${bedCount} מיטות` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {units.map((u) => (
                    <span
                      key={u.key}
                      className="inline-flex items-center gap-1 border border-[var(--color-border)] rounded px-2 py-0.5 text-sm font-mono"
                    >
                      {u.code}
                      {anyCapacity && u.capacity != null && (
                        <span className="text-[10px] text-[var(--color-muted-foreground)]">
                          {u.capacity}
                        </span>
                      )}
                    </span>
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
