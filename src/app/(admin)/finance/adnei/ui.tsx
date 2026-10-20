"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAdneiEntry,
  deleteAdneiEntry,
  updateAdneiEntry,
  approveAdneiEntry,
  approveAllPendingAdnei,
} from "./actions";

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export type AdneiRow = {
  id: string;
  date: string | null;
  amount: number;
  ptype: string | null;
  from: string | null;
  to: string | null;
  approved: boolean;
  approvedAt: string | null;
  changes: { label: string; from: string; to: string }[];
};

type Edit = {
  date: string;
  amount: string;
  ptype: string;
  from: string;
  to: string;
};
const toEdit = (r: AdneiRow): Edit => ({
  date: r.date ?? "",
  amount: r.amount ? String(r.amount) : "",
  ptype: r.ptype ?? "",
  from: r.from ?? "",
  to: r.to ?? "",
});

const cell = "h-9 rounded-lg border border-[var(--color-border)] px-2.5 text-sm";
const inp =
  "h-8 w-full rounded border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] px-1.5 text-sm bg-transparent outline-none";

export function AdneiLedger({
  rows,
  canEdit,
  canApprove,
}: {
  rows: AdneiRow[];
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, toEdit(r)]))
  );
  useEffect(() => {
    setEdits(Object.fromEntries(rows.map((r) => [r.id, toEdit(r)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.id}:${r.approved}:${r.amount}`).join(",")]);

  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [ptype, setPtype] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const pendingCount = rows.filter((r) => !r.approved).length;
  const colSpan = 6 + (canApprove ? 1 : 0) + (canEdit ? 1 : 0);

  function editField(id: string, k: keyof Edit, v: string) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  }
  function saveRow(id: string) {
    const e = edits[id];
    if (!e) return;
    start(async () => {
      await updateAdneiEntry(id, {
        date: e.date || null,
        amount: parseFloat(e.amount || "0"),
        ptype: e.ptype,
        from: e.from,
        to: e.to,
      });
      router.refresh();
    });
  }
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
  function approve(id: string) {
    start(async () => {
      await approveAdneiEntry(id);
      router.refresh();
    });
  }
  function approveAll() {
    start(async () => {
      await approveAllPendingAdnei();
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-[var(--color-primary)]">
          {rows.length} תנועות · סה״כ {nis(total)}
          {pendingCount > 0 && (
            <span className="ms-2 text-amber-600 font-medium">
              · {pendingCount} ממתינות לאישור
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pending && (
            <span className="text-xs text-[var(--color-muted-foreground)]">שומר…</span>
          )}
          {canApprove && pendingCount > 0 && (
            <button
              type="button"
              onClick={approveAll}
              disabled={pending}
              className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              ✓ אשר הכל הממתינים
            </button>
          )}
        </div>
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
              <th className="py-2 px-3 font-semibold">סטטוס</th>
              {canApprove && <th className="py-2 px-3 font-semibold">אישור</th>}
              {canEdit && <th className="py-2 px-1 w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = edits[r.id] ?? toEdit(r);
              return (
                <tr key={r.id} className="border-t border-[var(--color-border)]/50 align-top">
                  <td className="py-2 px-3 whitespace-nowrap">
                    {canEdit ? (
                      <input
                        type="date"
                        value={e.date}
                        onChange={(ev) => editField(r.id, "date", ev.target.value)}
                        onBlur={() => saveRow(r.id)}
                        className={inp + " w-[130px]"}
                      />
                    ) : (
                      <span className="text-[var(--color-muted-foreground)]">{r.date ?? "—"}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 tabular-nums whitespace-nowrap">
                    {canEdit ? (
                      <input
                        inputMode="numeric"
                        value={e.amount}
                        onChange={(ev) => editField(r.id, "amount", ev.target.value)}
                        onBlur={() => saveRow(r.id)}
                        className={inp + " w-24 font-semibold"}
                      />
                    ) : (
                      <span className="font-semibold">{nis(r.amount)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {canEdit ? (
                      <input
                        value={e.ptype}
                        onChange={(ev) => editField(r.id, "ptype", ev.target.value)}
                        onBlur={() => saveRow(r.id)}
                        className={inp}
                      />
                    ) : (
                      r.ptype ?? "—"
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {canEdit ? (
                      <input
                        value={e.from}
                        onChange={(ev) => editField(r.id, "from", ev.target.value)}
                        onBlur={() => saveRow(r.id)}
                        className={inp}
                      />
                    ) : (
                      r.from ?? "—"
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {canEdit ? (
                      <input
                        value={e.to}
                        onChange={(ev) => editField(r.id, "to", ev.target.value)}
                        onBlur={() => saveRow(r.id)}
                        className={inp}
                      />
                    ) : (
                      r.to ?? "—"
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {r.approved ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                        מאושר ✓{r.approvedAt ? ` · ${r.approvedAt}` : ""}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                        ממתין
                      </span>
                    )}
                    {r.changes.length > 0 && (
                      <div className="text-[11px] text-amber-700 mt-1 space-y-0.5">
                        <div className="font-semibold">השתנה מאז האישור:</div>
                        {r.changes.map((c, i) => (
                          <div key={i}>
                            {c.label}:{" "}
                            <span className="line-through opacity-70">{c.from}</span>{" "}
                            → <b>{c.to}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  {canApprove && (
                    <td className="py-2 px-3 whitespace-nowrap">
                      {!r.approved && (
                        <button
                          type="button"
                          onClick={() => approve(r.id)}
                          disabled={pending}
                          className="h-7 px-3 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          אשר
                        </button>
                      )}
                    </td>
                  )}
                  {canEdit && (
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
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="py-8 text-center text-[var(--color-muted-foreground)]">
                  אין תנועות עדיין.{canEdit ? " הוסיפו למטה." : ""}
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                <td className="py-2 px-3">סה״כ</td>
                <td className="py-2 px-3 tabular-nums">{nis(total)}</td>
                <td colSpan={colSpan - 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add (editors only) */}
      {canEdit && (
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
          <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={cell} />
          <input inputMode="numeric" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder="₪ סכום" className={cell + " w-28"} />
          <input value={ptype} onChange={(ev) => setPtype(ev.target.value)} placeholder="סוג תשלום" className={cell + " w-32"} />
          <input value={from} onChange={(ev) => setFrom(ev.target.value)} placeholder="מ-גוף" className={cell + " flex-1 min-w-[110px]"} />
          <input value={to} onChange={(ev) => setTo(ev.target.value)} placeholder="נמסר ל" className={cell + " flex-1 min-w-[110px]"} />
          <button type="button" onClick={add} disabled={pending} className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
            + הוסף
          </button>
        </div>
      )}
    </div>
  );
}
