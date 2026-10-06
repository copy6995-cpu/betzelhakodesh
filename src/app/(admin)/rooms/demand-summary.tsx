import type { YeshivaDemand, DemandTotals } from "@/lib/rooms";

type ColKey = "chulReg" | "chulNotReg" | "ariReg" | "ariNotReg" | "oneTime";
const COLS: { key: ColKey; label: string; muted?: boolean }[] = [
  { key: "chulReg", label: "חו״ל נרשמו" },
  { key: "chulNotReg", label: "חו״ל לא נרשמו" },
  { key: "ariReg", label: "אר״י נרשמו" },
  { key: "ariNotReg", label: "אר״י לא נרשמו" },
  { key: "oneTime", label: "חד פעמי", muted: true },
];

/**
 * Per-yeshiva demand table (rows = yeshivot): אר״י/חו״ל split by רשום/לא-רשום-
 * לאש״ל, a חד-פעמי column (Yemot group 23), a total, then one column per אגף
 * (building) with the beds allocated to that yeshiva there, and finally "לא
 * שובצו" = registered minus everything allocated. Registration and allocation
 * both cover the selected date range.
 */
export function RoomDemandSummary({
  rows,
  totals,
  buildings,
  allocByYeshiva,
  rangeLabel,
}: {
  rows: YeshivaDemand[];
  totals: DemandTotals;
  /** אגפים (building names), in display order. */
  buildings: string[];
  /** allocByYeshiva[yeshiva][building] = beds allocated there, in the range. */
  allocByYeshiva: Record<string, Record<string, number>>;
  rangeLabel?: string;
}) {
  const n = (v: number) => (v ? v.toLocaleString("he-IL") : "");

  const allocFor = (yeshiva: string, building: string) =>
    allocByYeshiva[yeshiva]?.[building] ?? 0;
  const totalAllocFor = (yeshiva: string) =>
    buildings.reduce((a, b) => a + allocFor(yeshiva, b), 0);
  const buildingTotal = (building: string) =>
    rows.reduce((a, r) => a + allocFor(r.yeshiva, building), 0);
  const grandAllocated = rows.reduce((a, r) => a + totalAllocFor(r.yeshiva), 0);

  const headCell = "py-2.5 px-3 text-center font-medium whitespace-nowrap";
  const bodyCell = "py-2 px-3 text-center whitespace-nowrap";
  const unassigned = (v: number) =>
    v > 0 ? " text-amber-600 font-semibold" : " text-[var(--color-muted-foreground)]";

  return (
    <div className="sticky top-16 z-30 mb-4 bg-white rounded-xl card-shadow overflow-auto max-h-[75vh]">
      <div className="px-4 pt-3 pb-2">
        <div className="text-sm font-semibold text-[var(--color-primary)]">
          ביקוש לפי ישיבה{rangeLabel ? ` — ${rangeLabel}` : ""}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
          לפי הפעולה האחרונה בטווח · נרשמו = הזמינו מיטה (אר״י/חו״ל לפי ההזמנה) ·
          לא נרשמו = רשומים לאש״ל שלא הזמינו · חד פעמי = קבוצה 23 · סה״כ = נרשמו +
          חד פעמי · עמודות האגפים = מיטות ששובצו · לא שובצו = סה״כ פחות ששובץ
        </div>
      </div>
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-[var(--color-primary)] text-white text-xs">
            <th className="py-2.5 pe-4 ps-3 text-right whitespace-nowrap sticky start-0 bg-[var(--color-primary)] z-10">
              ישיבה
            </th>
            {COLS.map((c) => (
              <th key={c.key} className={headCell}>
                {c.label}
              </th>
            ))}
            <th className="py-2.5 px-3 text-center font-bold whitespace-nowrap bg-[var(--color-primary-hover)]">
              סה״כ
            </th>
            {buildings.map((b) => (
              <th key={b} className={headCell + " text-[var(--color-accent)]"}>
                {b}
              </th>
            ))}
            <th className={headCell + " bg-amber-500/90"}>לא שובצו</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rem = r.total - totalAllocFor(r.yeshiva);
            return (
              <tr
                key={r.yeshiva}
                className="[&>td]:border-t [&>td]:border-[var(--color-border)]/50 hover:bg-[var(--color-muted)]/40"
              >
                <td className="py-2 pe-4 ps-3 text-right font-medium whitespace-nowrap sticky start-0 bg-white z-10">
                  {r.yeshiva}
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={
                      bodyCell +
                      (c.muted ? " text-[var(--color-muted-foreground)]" : "")
                    }
                  >
                    {n(r[c.key])}
                  </td>
                ))}
                <td className={bodyCell + " font-semibold bg-[var(--color-muted)]/50"}>
                  {n(r.total)}
                </td>
                {buildings.map((b) => (
                  <td key={b} className={bodyCell + " text-[var(--color-accent)]"}>
                    {n(allocFor(r.yeshiva, b))}
                  </td>
                ))}
                <td className={bodyCell + unassigned(rem)}>{n(rem)}</td>
              </tr>
            );
          })}
          <tr className="[&>td]:border-t-2 [&>td]:border-[var(--color-primary)] bg-[var(--color-muted)] font-bold">
            <td className="py-2.5 pe-4 ps-3 text-right whitespace-nowrap sticky start-0 bg-[var(--color-muted)] z-10">
              סה״כ
            </td>
            {COLS.map((c) => (
              <td key={c.key} className={bodyCell}>
                {n(totals[c.key])}
              </td>
            ))}
            <td className={bodyCell + " bg-[var(--color-primary)] text-white"}>
              {n(totals.total)}
            </td>
            {buildings.map((b) => (
              <td key={b} className={bodyCell + " text-[var(--color-accent)]"}>
                {n(buildingTotal(b))}
              </td>
            ))}
            <td className={bodyCell + unassigned(totals.total - grandAllocated)}>
              {n(totals.total - grandAllocated)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
