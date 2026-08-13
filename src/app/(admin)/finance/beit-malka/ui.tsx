"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BeitMalkaData, BeitMalkaRowT } from "@/lib/beit-malka";
import {
  addBeitMalkaRow,
  deleteBeitMalkaRow,
  updateBeitMalkaRow,
} from "./actions";

const PER_BED = 22;
const nis = (n: number) => (n ? `₪${Math.round(n).toLocaleString("he-IL")}` : "—");
const num = (s: string | undefined) => {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};

type Row = {
  id: string;
  reason: string;
  kind: string;
  beds: string;
  amount: string;
  paid: string;
  method: string;
  date: string;
};

function build(rows: BeitMalkaRowT[]): Row[] {
  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    kind: r.kind,
    beds: r.beds ? String(r.beds) : "",
    amount: r.amount ? String(r.amount) : "",
    paid: r.paid ? String(r.paid) : "",
    method: r.method ?? "",
    date: r.date ?? "",
  }));
}

/** Obligation for a row given current inputs. */
function rowAmt(r: Row): number {
  return r.kind === "אחר" ? num(r.amount) : num(r.beds) * PER_BED;
}

const inp =
  "h-8 rounded border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] px-1.5 text-sm bg-transparent outline-none";

export function BeitMalkaGrid({ data }: { data: BeitMalkaData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => build(data.rows));

  // New-row draft
  const [nReason, setNReason] = useState("");
  const [nKind, setNKind] = useState("מיטות");
  const [nBeds, setNBeds] = useState("");
  const [nAmount, setNAmount] = useState("");
  const [nPaid, setNPaid] = useState("");
  const [nMethod, setNMethod] = useState("");
  const [nDate, setNDate] = useState("");

  useEffect(() => {
    setRows(build(data.rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows.map((r) => r.id).join(",")]);

  const toPay = rows.reduce((a, r) => a + rowAmt(r), 0);
  const paid = rows.reduce((a, r) => a + num(r.paid), 0);
  const remaining = toPay - paid;

  function edit(id: string, field: keyof Row, val: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }
  function save(id: string, field: keyof Row) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    start(() =>
      updateBeitMalkaRow(id, {
        reason: r.reason,
        kind: r.kind,
        beds: num(r.beds),
        amount: num(r.amount),
        paid: num(r.paid),
        method: r.method,
        date: r.date || null,
      })
    );
    void field;
  }
  function saveKind(id: string, val: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, kind: val } : r)));
    const r = rows.find((x) => x.id === id);
    start(() =>
      updateBeitMalkaRow(id, {
        kind: val,
        beds: num(r?.beds),
        amount: num(r?.amount),
      })
    );
  }
  function remove(id: string, reason: string) {
    if (!confirm(`למחוק את השורה "${reason || "ללא שם"}"?`)) return;
    start(async () => {
      await deleteBeitMalkaRow(id);
      router.refresh();
    });
  }
  function add() {
    if (!nReason.trim() && !nBeds && !nAmount) return;
    start(async () => {
      await addBeitMalkaRow({
        reason: nReason,
        kind: nKind,
        beds: num(nBeds),
        amount: num(nAmount),
        paid: num(nPaid),
        method: nMethod,
        date: nDate || null,
      });
      setNReason("");
      setNKind("מיטות");
      setNBeds("");
      setNAmount("");
      setNPaid("");
      setNMethod("");
      setNDate("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="סה״כ לשלם" value={toPay} tone="plain" />
        <Stat label="שולם" value={paid} tone="green" />
        <Stat label="נשאר לשלם" value={remaining} tone="red" />
      </div>

      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {rows.length} שורות · ₪22 למיטה
          </div>
          {pending && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              שומר…
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)] text-right">
                <th className="py-2 px-3 font-semibold min-w-[150px]">סיבה / שבת</th>
                <th className="py-2 px-2 font-semibold">סוג</th>
                <th className="py-2 px-2 font-semibold">מיטות</th>
                <th className="py-2 px-2 font-semibold">סכום</th>
                <th className="py-2 px-2 font-semibold">שולם</th>
                <th className="py-2 px-2 font-semibold">נשאר</th>
                <th className="py-2 px-2 font-semibold">אמצעי</th>
                <th className="py-2 px-2 font-semibold">תאריך</th>
                <th className="py-2 px-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const amt = rowAmt(r);
                const rem = amt - num(r.paid);
                const isBeds = r.kind !== "אחר";
                return (
                  <tr key={r.id} className="border-t border-[var(--color-border)]/50">
                    <td className="px-2 py-1">
                      <input
                        value={r.reason}
                        onChange={(e) => edit(r.id, "reason", e.target.value)}
                        onBlur={() => save(r.id, "reason")}
                        className={inp + " w-full font-medium"}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={r.kind}
                        onChange={(e) => saveKind(r.id, e.target.value)}
                        className="h-8 rounded border border-[var(--color-border)] text-xs px-1 bg-white"
                      >
                        <option value="מיטות">מיטות</option>
                        <option value="אחר">אחר</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      {isBeds ? (
                        <input
                          inputMode="numeric"
                          value={r.beds}
                          onChange={(e) => edit(r.id, "beds", e.target.value)}
                          onBlur={() => save(r.id, "beds")}
                          className={inp + " w-16 text-center"}
                        />
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]/50 px-2">—</span>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {isBeds ? (
                        <span className="px-1.5 tabular-nums font-medium">
                          {nis(amt)}
                        </span>
                      ) : (
                        <input
                          inputMode="numeric"
                          value={r.amount}
                          onChange={(e) => edit(r.id, "amount", e.target.value)}
                          onBlur={() => save(r.id, "amount")}
                          className={inp + " w-24 text-center"}
                        />
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        inputMode="numeric"
                        value={r.paid}
                        onChange={(e) => edit(r.id, "paid", e.target.value)}
                        onBlur={() => save(r.id, "paid")}
                        className={inp + " w-24 text-center text-green-700"}
                      />
                    </td>
                    <td className="px-2 py-1 tabular-nums text-red-600 whitespace-nowrap">
                      {rem > 0 ? nis(rem) : "—"}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={r.method}
                        onChange={(e) => edit(r.id, "method", e.target.value)}
                        onBlur={() => save(r.id, "method")}
                        placeholder="ציק / מזומן"
                        className={inp + " w-24"}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => edit(r.id, "date", e.target.value)}
                        onBlur={() => save(r.id, "date")}
                        className={inp + " w-[130px]"}
                      />
                    </td>
                    <td className="px-1 text-center">
                      <button
                        type="button"
                        onClick={() => remove(r.id, r.reason)}
                        disabled={pending}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="מחק"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--color-muted-foreground)]">
                    אין שורות עדיין. הוסיפו למטה.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                  <td className="px-3 py-2" colSpan={3}>
                    סה״כ
                  </td>
                  <td className="px-2 py-2 tabular-nums">{nis(toPay)}</td>
                  <td className="px-2 py-2 tabular-nums text-green-700">{nis(paid)}</td>
                  <td className="px-2 py-2 tabular-nums text-red-600">
                    {remaining > 0 ? nis(remaining) : "—"}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Add row */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
          <input
            value={nReason}
            onChange={(e) => setNReason(e.target.value)}
            placeholder="סיבה / שבת"
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm flex-1 min-w-[130px]"
          />
          <select
            value={nKind}
            onChange={(e) => setNKind(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] px-2 text-sm bg-white"
          >
            <option value="מיטות">מיטות</option>
            <option value="אחר">אחר</option>
          </select>
          {nKind === "אחר" ? (
            <input
              inputMode="numeric"
              value={nAmount}
              onChange={(e) => setNAmount(e.target.value)}
              placeholder="₪ סכום"
              className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-28"
            />
          ) : (
            <input
              inputMode="numeric"
              value={nBeds}
              onChange={(e) => setNBeds(e.target.value)}
              placeholder="מיטות"
              className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-24"
            />
          )}
          <input
            inputMode="numeric"
            value={nPaid}
            onChange={(e) => setNPaid(e.target.value)}
            placeholder="שולם"
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-24"
          />
          <input
            value={nMethod}
            onChange={(e) => setNMethod(e.target.value)}
            placeholder="אמצעי"
            className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-24"
          />
          <input
            type="date"
            value={nDate}
            onChange={(e) => setNDate(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] px-2 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {nKind === "מיטות" && nBeds
              ? `+ ${nis(num(nBeds) * PER_BED)}`
              : "+ הוסף"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "plain" | "green" | "red";
}) {
  const color =
    tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="bg-white rounded-xl card-shadow p-5 text-center">
      <div className="text-xs text-[var(--color-muted-foreground)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{nis(value)}</div>
    </div>
  );
}
