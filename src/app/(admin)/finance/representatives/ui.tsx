"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HebMonth, RepRow } from "@/lib/reps";
import { addRep, deleteRep, setRepAmount, updateRep } from "./actions";

const nis = (n: number) =>
  n ? `₪${Math.round(n).toLocaleString("he-IL")}` : "—";

type Row = {
  id: string;
  name: string;
  yeshiva: string;
  amounts: Record<string, string>;
};

function build(reps: RepRow[]): Row[] {
  return reps.map((r) => {
    const amounts: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.amounts)) amounts[k] = String(v);
    return { id: r.id, name: r.name, yeshiva: r.yeshiva ?? "", amounts };
  });
}

const num = (s: string | undefined) => {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};

export function RepsGrid({
  months,
  reps,
  yeshivot,
}: {
  months: HebMonth[];
  reps: RepRow[];
  yeshivot: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => build(reps));
  const [newName, setNewName] = useState("");
  const [newYeshiva, setNewYeshiva] = useState("");

  // Re-seed from the server only when the row set changes (add/delete refresh).
  // Cell/name edits keep local state, so typing is never clobbered.
  useEffect(() => {
    setRows(build(reps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps.map((r) => r.id).join(",")]);

  const rowTotal = (r: Row) =>
    months.reduce((a, m) => a + num(r.amounts[m.key]), 0);
  const colTotal = (key: string) =>
    rows.reduce((a, r) => a + num(r.amounts[key]), 0);
  const grand = rows.reduce((a, r) => a + rowTotal(r), 0);

  function editCell(id: string, key: string, val: string) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, amounts: { ...r.amounts, [key]: val } } : r
      )
    );
  }
  function saveCell(id: string, key: string) {
    const r = rows.find((x) => x.id === id);
    start(() => setRepAmount(id, key, num(r?.amounts[key])));
  }
  function editField(id: string, field: "name" | "yeshiva", val: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }
  function saveField(id: string, field: "name" | "yeshiva") {
    const r = rows.find((x) => x.id === id);
    const orig = reps.find((x) => x.id === id);
    if (!r) return;
    const cur = field === "name" ? r.name : r.yeshiva;
    const was = field === "name" ? orig?.name ?? "" : orig?.yeshiva ?? "";
    if (cur.trim() === was.trim()) return;
    start(() => updateRep(id, { [field]: cur }));
  }
  function add() {
    if (!newName.trim()) return;
    start(async () => {
      await addRep(newName, newYeshiva);
      setNewName("");
      setNewYeshiva("");
      router.refresh();
    });
  }
  function remove(id: string, name: string) {
    if (!confirm(`למחוק את "${name}" וכל הסכומים שלו?`)) return;
    start(async () => {
      await deleteRep(id);
      router.refresh();
    });
  }

  const cellCls =
    "w-full h-8 text-center text-sm bg-transparent rounded focus:bg-white focus:ring-1 focus:ring-[var(--color-primary)] outline-none tabular-nums";

  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-[var(--color-primary)]">
          {rows.length} נציגים · סה״כ ששולם {nis(grand)}
        </div>
        {pending && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            שומר…
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
              <th className="sticky start-0 z-20 bg-[var(--color-muted)] py-2 px-3 text-right font-semibold min-w-[180px] border-e border-[var(--color-border)]">
                שם הנציג
              </th>
              {months.map((m) => (
                <th
                  key={m.key}
                  className="py-2 px-1 font-semibold min-w-[68px] whitespace-nowrap"
                >
                  {m.label}
                </th>
              ))}
              <th className="py-2 px-3 font-semibold min-w-[90px] border-s border-[var(--color-border)] bg-[var(--color-muted)]">
                סה״כ
              </th>
              <th className="py-2 px-1 w-8 bg-[var(--color-muted)]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-[var(--color-border)]/50"
              >
                <th className="sticky start-0 z-10 bg-white py-1 px-3 text-right font-normal border-e border-[var(--color-border)] align-top">
                  <input
                    value={r.name}
                    onChange={(e) => editField(r.id, "name", e.target.value)}
                    onBlur={() => saveField(r.id, "name")}
                    className="w-full h-7 text-sm font-medium bg-transparent rounded px-1 focus:bg-[var(--color-muted)] outline-none"
                  />
                  <input
                    value={r.yeshiva}
                    onChange={(e) => editField(r.id, "yeshiva", e.target.value)}
                    onBlur={() => saveField(r.id, "yeshiva")}
                    list="rep-yeshivot"
                    placeholder="ישיבה"
                    className="w-full h-6 text-xs text-[var(--color-muted-foreground)] bg-transparent rounded px-1 focus:bg-[var(--color-muted)] outline-none"
                  />
                </th>
                {months.map((m) => (
                  <td key={m.key} className="p-0.5">
                    <input
                      inputMode="numeric"
                      value={r.amounts[m.key] ?? ""}
                      onChange={(e) => editCell(r.id, m.key, e.target.value)}
                      onBlur={() => saveCell(r.id, m.key)}
                      className={cellCls}
                    />
                  </td>
                ))}
                <td className="px-3 text-center font-semibold text-[var(--color-success)] tabular-nums whitespace-nowrap border-s border-[var(--color-border)]">
                  {nis(rowTotal(r))}
                </td>
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => remove(r.id, r.name)}
                    disabled={pending}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="מחק נציג"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={months.length + 3}
                  className="py-8 text-center text-[var(--color-muted-foreground)]"
                >
                  אין נציגים עדיין. הוסיפו למטה.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                <th className="sticky start-0 z-10 bg-[var(--color-muted)]/50 py-2 px-3 text-right border-e border-[var(--color-border)]">
                  סה״כ
                </th>
                {months.map((m) => (
                  <td
                    key={m.key}
                    className="px-1 text-center tabular-nums text-xs whitespace-nowrap"
                  >
                    {colTotal(m.key) ? nis(colTotal(m.key)) : ""}
                  </td>
                ))}
                <td className="px-3 text-center text-[var(--color-success)] tabular-nums whitespace-nowrap border-s border-[var(--color-border)]">
                  {nis(grand)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <datalist id="rep-yeshivot">
        {yeshivot.map((y) => (
          <option key={y} value={y} />
        ))}
      </datalist>

      {/* Add a rep */}
      <div className="px-5 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="שם נציג חדש"
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm flex-1 min-w-[140px]"
        />
        <input
          value={newYeshiva}
          onChange={(e) => setNewYeshiva(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          list="rep-yeshivot"
          placeholder="ישיבה (רשות)"
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-40"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !newName.trim()}
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          + הוסף נציג
        </button>
      </div>
    </div>
  );
}
