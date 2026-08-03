"use client";

import { useState } from "react";
import { saveSupervisorPrices } from "./actions";

export type PriceMap = Record<string, number>;
export type SupervisorPrices = { lina: PriceMap; kima: PriceMap };

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Editor for the supervisor price table: each level (the number typed into a
 * לינה/קימה cell) maps to a ₪ amount, separately for לינה and קימה. The calendar
 * grid uses these to total the supervisor cost at the bottom.
 */
export function SupervisorPriceTable({ initial }: { initial: SupervisorPrices }) {
  const [prices, setPrices] = useState<SupervisorPrices>(initial);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  function update(type: "lina" | "kima", level: number, raw: string) {
    const next: SupervisorPrices = {
      lina: { ...prices.lina },
      kima: { ...prices.kima },
    };
    const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (!raw.trim() || Number.isNaN(n)) delete next[type][String(level)];
    else next[type][String(level)] = n;
    setPrices(next);
  }

  async function save() {
    try {
      await saveSupervisorPrices(JSON.stringify(prices));
      setStatus("נשמר");
    } catch {
      setStatus("שגיאה");
    }
    window.setTimeout(() => setStatus(""), 1500);
  }

  return (
    <div className="mb-4 bg-white rounded-xl card-shadow">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-primary)]"
      >
        <span>💰 טבלת מחירי משגיחים (לינה / קימה)</span>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {status || (open ? "▲" : "▼")}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            המספר שרושמים בתא של משגיח (לינה/קימה) = הרמה כאן. הסכום למטה מסכם
            את כל התאים לפי המחירים.
          </p>
          <table className="text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-xs text-[var(--color-muted-foreground)]">
                <th className="py-1 px-3 text-right">מספר</th>
                <th className="py-1 px-3">לינה ₪</th>
                <th className="py-1 px-3">קימה ₪</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((lvl) => (
                <tr key={lvl}>
                  <td className="py-1 px-3 font-semibold text-center">{lvl}</td>
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={prices.lina[String(lvl)] ?? ""}
                      onChange={(e) => update("lina", lvl, e.target.value)}
                      onBlur={save}
                      placeholder="—"
                      className="w-24 h-8 text-center rounded border border-[var(--color-border)] text-sm"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={prices.kima[String(lvl)] ?? ""}
                      onChange={(e) => update("kima", lvl, e.target.value)}
                      onBlur={save}
                      placeholder="—"
                      className="w-24 h-8 text-center rounded border border-[var(--color-border)] text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
