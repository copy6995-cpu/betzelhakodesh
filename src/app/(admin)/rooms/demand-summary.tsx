import type { YeshivaDemand, DemandTotals } from "@/lib/rooms";

type ColKey =
  | "chulReg"
  | "chulNotReg"
  | "chulCancel"
  | "ariReg"
  | "ariNotReg"
  | "ariCancel"
  | "oneTime";
const COLS: { key: ColKey; label: string; muted?: boolean; cancel?: boolean }[] = [
  { key: "chulReg", label: "חו״ל נרשמו" },
  { key: "chulNotReg", label: "חו״ל לא נרשמו" },
  { key: "chulCancel", label: "חו״ל ביטול", cancel: true },
  { key: "ariReg", label: "אר״י נרשמו" },
  { key: "ariNotReg", label: "אר״י לא נרשמו" },
  { key: "ariCancel", label: "אר״י ביטול", cancel: true },
  { key: "oneTime", label: "חד פעמי", muted: true },
];

/**
 * Per-yeshiva demand table (rows = yeshivot), matching the office planning
 * sheet: אר״י/חו״ל split by רשום/לא-רשום-לאש״ל, a חד-פעמי column (Yemot group
 * 23), and a total. "לא משובץ"/ארכיון buckets are already dropped upstream.
 * The last two columns show what's allocated in the currently-selected week.
 */
export function RoomDemandSummary({
  rows,
  totals,
  allocatedByYeshiva,
  anyCapacity,
  rangeLabel,
}: {
  rows: YeshivaDemand[];
  totals: DemandTotals;
  allocatedByYeshiva: Record<string, { rooms: number; beds: number }>;
  anyCapacity: boolean;
  rangeLabel?: string;
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

  const headCell =
    "py-2.5 px-3 text-center font-medium whitespace-nowrap";
  const bodyCell = "py-2 px-3 text-center whitespace-nowrap";

  return (
    <div className="sticky top-16 z-30 mb-4 bg-white rounded-xl card-shadow overflow-auto max-h-[75vh]">
      <div className="px-4 pt-3 pb-2">
        <div className="text-sm font-semibold text-[var(--color-primary)]">
          ביקוש לפי ישיבה{rangeLabel ? ` — ${rangeLabel}` : ""}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
          לפי הפעולה האחרונה בטווח (נרשם→ביטל→נרשם = רשום) · נרשמו = הזמינו מיטה
          (אר״י/חו״ל לפי ההזמנה) · לא נרשמו = רשומים לאש״ל שלא הזמינו · ביטול =
          הפעולה האחרונה ביטול · חד פעמי = קבוצה 23 · סה״כ = נרשמו + חד פעמי
        </div>
      </div>
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-[var(--color-primary)] text-white text-xs">
            <th className="py-2.5 pe-4 ps-3 text-right whitespace-nowrap">
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
            <th className={headCell + " text-[var(--color-accent)]"}>
              חדרים שובצו
            </th>
            {anyCapacity && (
              <th className={headCell + " text-[var(--color-accent)]"}>
                מיטות שובצו
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.yeshiva}
              className="[&>td]:border-t [&>td]:border-[var(--color-border)]/50 hover:bg-[var(--color-muted)]/40"
            >
              <td className="py-2 pe-4 ps-3 text-right font-medium whitespace-nowrap">
                {r.yeshiva}
              </td>
              {COLS.map((c) => (
                <td
                  key={c.key}
                  className={
                    bodyCell +
                    (c.muted
                      ? " text-[var(--color-muted-foreground)]"
                      : c.cancel
                      ? " text-red-600"
                      : "")
                  }
                >
                  {n(r[c.key])}
                </td>
              ))}
              <td className={bodyCell + " font-semibold bg-[var(--color-muted)]/50"}>
                {n(r.total)}
              </td>
              <td className={bodyCell + " text-[var(--color-accent)]"}>
                {n(allocatedByYeshiva[r.yeshiva]?.rooms ?? 0)}
              </td>
              {anyCapacity && (
                <td className={bodyCell + " text-[var(--color-accent)]"}>
                  {n(allocatedByYeshiva[r.yeshiva]?.beds ?? 0)}
                </td>
              )}
            </tr>
          ))}
          <tr className="[&>td]:border-t-2 [&>td]:border-[var(--color-primary)] bg-[var(--color-muted)] font-bold">
            <td className="py-2.5 pe-4 ps-3 text-right whitespace-nowrap">
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
            <td className={bodyCell + " text-[var(--color-accent)]"}>
              {n(totalRooms)}
            </td>
            {anyCapacity && (
              <td className={bodyCell + " text-[var(--color-accent)]"}>
                {n(totalBeds)}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
