import type { YeshivaDemand } from "@/lib/rooms";

/**
 * Fixed per-yeshiva demand table pinned to the top of the allocation page.
 * Metrics are rows and yeshivot are columns so it stays short enough to stick.
 * "חדרים/מיטות שובצו" reflect the currently-selected week; the head-counts are
 * season totals (planning figures).
 */
export function RoomDemandSummary({
  rows,
  totals,
  allocatedByYeshiva,
  anyCapacity,
}: {
  rows: YeshivaDemand[];
  totals: { ari: number; chul: number; oneTime: number; total: number };
  allocatedByYeshiva: Record<string, { rooms: number; beds: number }>;
  anyCapacity: boolean;
}) {
  const n = (v: number) => (v ? v.toLocaleString("he-IL") : "");
  const totalRooms = Object.values(allocatedByYeshiva).reduce(
    (a, b) => a + b.rooms,
    0
  );
  const totalBeds = Object.values(allocatedByYeshiva).reduce(
    (a, b) => a + b.beds,
    0
  );

  const metric = [
    { key: "ari", label: 'אר"י', get: (r: YeshivaDemand) => r.ari, tot: totals.ari, cls: "" },
    { key: "chul", label: 'חו"ל', get: (r: YeshivaDemand) => r.chul, tot: totals.chul, cls: "" },
    { key: "one", label: "חד פעמי", get: (r: YeshivaDemand) => r.oneTime, tot: totals.oneTime, cls: "text-[var(--color-muted-foreground)]" },
    { key: "tot", label: "סה״כ נרשמים", get: (r: YeshivaDemand) => r.total, tot: totals.total, cls: "font-semibold" },
  ] as const;

  return (
    <div className="sticky top-16 z-30 mb-4 bg-white rounded-xl card-shadow overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr className="bg-[var(--color-primary)] text-white">
            <th className="sticky right-0 z-10 bg-[var(--color-primary)] py-2 pe-3 ps-3 text-right whitespace-nowrap">
              ביקוש לפי ישיבה
            </th>
            {rows.map((r) => (
              <th
                key={r.yeshiva}
                className="py-2 px-2 text-center font-medium whitespace-nowrap min-w-[64px]"
              >
                {r.yeshiva}
              </th>
            ))}
            <th className="py-2 px-3 text-center font-bold whitespace-nowrap bg-[var(--color-primary-hover)]">
              סה״כ
            </th>
          </tr>
        </thead>
        <tbody>
          {metric.map((m) => (
            <tr key={m.key} className="[&>td]:border-t [&>td]:border-[var(--color-border)]/50">
              <td className={"sticky right-0 z-10 bg-white py-1.5 pe-3 ps-3 text-right whitespace-nowrap " + m.cls}>
                {m.label}
              </td>
              {rows.map((r) => (
                <td key={r.yeshiva} className={"py-1.5 px-2 text-center " + m.cls}>
                  {n(m.get(r))}
                </td>
              ))}
              <td className={"py-1.5 px-3 text-center bg-[var(--color-muted)] " + m.cls}>
                {n(m.tot)}
              </td>
            </tr>
          ))}
          <tr className="[&>td]:border-t-2 [&>td]:border-[var(--color-border)]">
            <td className="sticky right-0 z-10 bg-white py-1.5 pe-3 ps-3 text-right whitespace-nowrap text-[var(--color-accent)]">
              חדרים שובצו (השבוע)
            </td>
            {rows.map((r) => (
              <td key={r.yeshiva} className="py-1.5 px-2 text-center text-[var(--color-accent)]">
                {n(allocatedByYeshiva[r.yeshiva]?.rooms ?? 0)}
              </td>
            ))}
            <td className="py-1.5 px-3 text-center bg-[var(--color-muted)] text-[var(--color-accent)]">
              {n(totalRooms)}
            </td>
          </tr>
          {anyCapacity && (
            <tr className="[&>td]:border-t [&>td]:border-[var(--color-border)]/50">
              <td className="sticky right-0 z-10 bg-white py-1.5 pe-3 ps-3 text-right whitespace-nowrap text-[var(--color-accent)]">
                מיטות שובצו (השבוע)
              </td>
              {rows.map((r) => (
                <td key={r.yeshiva} className="py-1.5 px-2 text-center text-[var(--color-accent)]">
                  {n(allocatedByYeshiva[r.yeshiva]?.beds ?? 0)}
                </td>
              ))}
              <td className="py-1.5 px-3 text-center bg-[var(--color-muted)] text-[var(--color-accent)]">
                {n(totalBeds)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
