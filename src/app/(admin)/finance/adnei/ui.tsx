"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdneiEntry, deleteAdneiEntry } from "./actions";

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export type AdneiRow = {
  id: string;
  date: string | null;
  amount: number;
  ptype: string | null;
  from: string | null;
  to: string | null;
};

const cell =
  "h-9 rounded-lg border border-[var(--color-border)] px-2.5 text-sm";

export function AdneiLedger({ rows }: { rows: AdneiRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [ptype, setPtype] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const total = rows.reduce((a, r) => a + r.amount, 0);

  function add() {
    if (!amount && !ptype.trim()) return;
    start(async () => {
      await addAdneiEntry({
        date: date || null,
        amount: parseFloat(amount || "0"),
        ptype,
        from,
        to,
      });
      setDate("");
      setAmount("");
      setPtype("");
      setFrom("");
      setTo("");
      router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      await deleteAdneiEntry(id);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--color-primary)]">
          {rows.length} תנועות · סה״כ {nis(total)}
        </div>
        {pending && (
          <span className="text-xs text-[var(--color-muted-foreground)]">שומר…</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)] text-right">
              <th className="py-2 px-3 font-semibold whitespace-nowrap">תאריך</th>
              <th className="py-2 px-3 font-semibold">סכום</th>
              <th className="py-2 px-3 font-semibold">סוג תשלום</th>
              <th className="py-2 px-3 font-semibold">מ-גוף</th>
              <th className="py-2 px-3 font-semibold">נמסר ל</th>
              <th className="py-2 px-1 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]/50">
                <td className="py-2 px-3 text-[var(--color-muted-foreground)] whitespace-nowrap">
                  {r.date ?? "—"}
                </td>
                <td className="py-2 px-3 font-semibold tabular-nums whitespace-nowrap">
                  {nis(r.amount)}
                </td>
                <td className="py-2 px-3">{r.ptype ?? "—"}</td>
                <td className="py-2 px-3">{r.from ?? "—"}</td>
                <td className="py-2 px-3">{r.to ?? "—"}</td>
                <td className="py-2 px-1 text-center">
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={pending}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="מחק"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--color-muted-foreground)]">
                  אין תנועות עדיין. הוסיפו למטה.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                <td className="py-2 px-3">סה״כ</td>
                <td className="py-2 px-3 tabular-nums">{nis(total)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cell}
        />
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="₪ סכום"
          className={cell + " w-28"}
        />
        <input
          value={ptype}
          onChange={(e) => setPtype(e.target.value)}
          placeholder="סוג תשלום"
          className={cell + " w-32"}
        />
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="מ-גוף"
          className={cell + " flex-1 min-w-[110px]"}
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="נמסר ל"
          className={cell + " flex-1 min-w-[110px]"}
        />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          + הוסף
        </button>
      </div>
    </div>
  );
}
