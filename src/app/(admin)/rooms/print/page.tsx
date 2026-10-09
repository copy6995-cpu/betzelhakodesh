import { prisma } from "@/lib/prisma";
import { weekKeyOf, currentWeekKey, weekLabel } from "@/lib/weeks";
import { mergeRoomUnits, type RoomUnit } from "@/lib/rooms";
import { complexOf } from "@/lib/room-complex";
import { orderCalendarYeshivot } from "@/lib/calendar-export";
import { PrintControls } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Print-optimized room-assignment report, one מתחם per page, each headed with
 * the מתחם name (the yeshiva is implied — this is that yeshiva's report). A
 * מתחם's אגפים are merged onto its page. Rendered as HTML so the browser's
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

  // yeshiva → מתחם → rooms (raw), merging the אגפים that share a מתחם, then
  // collapse linked rooms into units.
  const byYeshiva = new Map<string, Map<string, RoomUnit[]>>();
  const rawByYC = new Map<
    string,
    Map<
      string,
      { id: string; code: string; capacity: number | null; order: number; building: string }[]
    >
  >();
  for (const a of allocations) {
    const complex = complexOf(a.room.building);
    const yc = rawByYC.get(a.yeshiva) ?? new Map();
    const arr = yc.get(complex) ?? [];
    arr.push({
      id: a.roomId,
      code: a.room.code,
      capacity: a.room.capacity,
      order: a.room.order,
      building: a.room.building,
    });
    yc.set(complex, arr);
    rawByYC.set(a.yeshiva, yc);
  }
  for (const [yeshiva, yc] of rawByYC) {
    const complexes = new Map<string, RoomUnit[]>();
    for (const [complex, rooms] of yc) {
      // Keep each אגף's rooms contiguous within the מתחם (order is per-אגף).
      rooms.sort(
        (x, y) =>
          x.building.localeCompare(y.building, "he") ||
          x.order - y.order ||
          x.code.localeCompare(y.code, "he")
      );
      complexes.set(
        complex,
        mergeRoomUnits(rooms.map((r) => ({ ...r, assignedTo: yeshiva })))
      );
    }
    byYeshiva.set(yeshiva, complexes);
  }

  const names = [...byYeshiva.keys()];
  const ordered = orderCalendarYeshivot(names);
  const yeshivaOrder = [...ordered, ...names.filter((n) => !ordered.includes(n))];

  // One page per מתחם, titled with the מתחם name only.
  const pages: { yeshiva: string; complex: string; units: RoomUnit[] }[] = [];
  for (const yeshiva of yeshivaOrder) {
    const complexes = byYeshiva.get(yeshiva)!;
    for (const [complex, units] of complexes) {
      pages.push({ yeshiva, complex, units });
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
          {pages.map(({ yeshiva, complex, units }) => {
            const bedCount = units.reduce((m, u) => m + (u.capacity ?? 0), 0);
            return (
              <section key={`${yeshiva}|${complex}`} className="yeshiva-page">
                <div className="flex items-baseline justify-between border-b-2 border-[var(--color-primary)] pb-1 mb-3">
                  <h2 className="text-xl font-bold text-[var(--color-primary)]">
                    {complex}
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
