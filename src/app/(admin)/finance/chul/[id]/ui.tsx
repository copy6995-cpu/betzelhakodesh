"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DonationRow } from "@/lib/reps";
import { addDonation, deleteDonation, updateDonation } from "../actions";

type ParentOpt = { id: string; name: string; hint: string };

const nis = (n: number) => (n ? `₪${Math.round(n).toLocaleString("he-IL")}` : "—");
const usdFmt = (n: number) => (n ? `$${Math.round(n).toLocaleString("he-IL")}` : "—");
const num = (s: string | undefined) => {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};

type Row = {
  id: string;
  donor: string;
  parentId: string;
  date: string;
  usd: string;
  rate: string;
  ils: string;
  notes: string;
};

function build(rows: DonationRow[]): Row[] {
  return rows.map((d) => ({
    id: d.id,
    donor: d.donor,
    parentId: d.parentId ?? "",
    date: d.date ?? "",
    usd: d.usd ? String(d.usd) : "",
    rate: d.rate ? String(d.rate) : "",
    ils: d.ils ? String(d.ils) : "",
    notes: d.notes ?? "",
  }));
}

const inp =
  "h-8 w-full rounded border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] px-1.5 text-sm bg-transparent outline-none";
const addInp = "h-9 rounded-lg border border-[var(--color-border)] px-2.5 text-sm";

export function DonationsGrid({
  repId,
  donations,
  parents,
}: {
  repId: string;
  donations: DonationRow[];
  parents: ParentOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => build(donations));

  const [nDonor, setNDonor] = useState("");
  const [nParentId, setNParentId] = useState("");
  const [nDate, setNDate] = useState("");
  const [nUsd, setNUsd] = useState("");
  const [nRate, setNRate] = useState("");
  const [nIls, setNIls] = useState("");
  const [nNotes, setNNotes] = useState("");

  useEffect(() => {
    setRows(build(donations));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donations.map((d) => d.id).join(",")]);

  const total = rows.reduce((a, r) => a + num(r.ils), 0);
  const totalUsd = rows.reduce((a, r) => a + num(r.usd), 0);

  function edit(id: string, field: keyof Row, val: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }
  function save(id: string) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    start(() =>
      updateDonation(id, {
        donor: r.donor,
        parentId: r.parentId || null,
        date: r.date || null,
        usd: num(r.usd),
        rate: r.rate ? num(r.rate) : null,
        ils: num(r.ils),
        notes: r.notes,
      })
    );
  }
  function pickParent(id: string, p: ParentOpt) {
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, donor: p.name, parentId: p.id } : r))
    );
    start(() => updateDonation(id, { donor: p.name, parentId: p.id }));
  }
  function remove(id: string, donor: string) {
    if (!confirm(`למחוק את התרומה של "${donor || "ללא שם"}"?`)) return;
    start(async () => {
      await deleteDonation(id);
      router.refresh();
    });
  }

  const newIlsPreview =
    num(nIls) ||
    (num(nUsd) && num(nRate) ? Math.round(num(nUsd) * num(nRate)) : 0);

  function add() {
    if (!nParentId) return; // donor must be chosen from the parents list
    start(async () => {
      await addDonation(repId, {
        donor: nDonor,
        parentId: nParentId || null,
        date: nDate || null,
        usd: num(nUsd),
        rate: nRate ? num(nRate) : null,
        ils: num(nIls),
        notes: nNotes,
      });
      setNDonor("");
      setNParentId("");
      setNDate("");
      setNUsd("");
      setNRate("");
      setNIls("");
      setNNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="מספר תרומות" text={String(rows.length)} />
        <Stat label="סה״כ בדולר" text={usdFmt(totalUsd)} />
        <Stat label="סה״כ בשקלים" text={nis(total)} tone="green" />
      </div>

      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            תרומות
          </div>
          {pending && (
            <span className="text-xs text-[var(--color-muted-foreground)]">שומר…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)] text-right">
                <th className="py-2 px-3 font-semibold min-w-[150px]">שם התורם</th>
                <th className="py-2 px-2 font-semibold whitespace-nowrap">תאריך</th>
                <th className="py-2 px-2 font-semibold">$ דולר</th>
                <th className="py-2 px-2 font-semibold">שער</th>
                <th className="py-2 px-2 font-semibold">₪ סה״כ</th>
                <th className="py-2 px-2 font-semibold min-w-[120px]">הערות</th>
                <th className="py-2 px-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]/50">
                  <td className="px-2 py-1 min-w-[160px]">
                    <ParentCombo
                      parents={parents}
                      value={r.donor}
                      onPick={(p) => pickParent(r.id, p)}
                      inputClass={inp + " font-medium"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => edit(r.id, "date", e.target.value)}
                      onBlur={() => save(r.id)}
                      className={inp + " w-[130px]"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      inputMode="numeric"
                      value={r.usd}
                      onChange={(e) => edit(r.id, "usd", e.target.value)}
                      onBlur={() => save(r.id)}
                      className={inp + " w-20 text-center"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      inputMode="numeric"
                      value={r.rate}
                      onChange={(e) => edit(r.id, "rate", e.target.value)}
                      onBlur={() => save(r.id)}
                      className={inp + " w-16 text-center"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      inputMode="numeric"
                      value={r.ils}
                      onChange={(e) => edit(r.id, "ils", e.target.value)}
                      onBlur={() => save(r.id)}
                      className={inp + " w-24 text-center text-green-700 font-semibold"}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={r.notes}
                      onChange={(e) => edit(r.id, "notes", e.target.value)}
                      onBlur={() => save(r.id)}
                      className={inp}
                    />
                  </td>
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      onClick={() => remove(r.id, r.donor)}
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
                  <td colSpan={7} className="py-8 text-center text-[var(--color-muted-foreground)]">
                    אין תרומות עדיין. הוסיפו למטה.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-muted)]/50 font-bold">
                  <td className="px-3 py-2" colSpan={2}>
                    סה״כ
                  </td>
                  <td className="px-2 py-2 tabular-nums text-center">
                    {usdFmt(totalUsd)}
                  </td>
                  <td />
                  <td className="px-2 py-2 tabular-nums text-center text-green-700">
                    {nis(total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Add */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
          <ParentCombo
            parents={parents}
            value={nDonor}
            onPick={(p) => {
              setNDonor(p.name);
              setNParentId(p.id);
            }}
            inputClass={addInp + " w-full"}
            wrapClass="flex-1 min-w-[160px]"
          />
          <input
            type="date"
            value={nDate}
            onChange={(e) => setNDate(e.target.value)}
            className={addInp}
          />
          <input
            inputMode="numeric"
            value={nUsd}
            onChange={(e) => setNUsd(e.target.value)}
            placeholder="$"
            className={addInp + " w-20"}
          />
          <input
            inputMode="numeric"
            value={nRate}
            onChange={(e) => setNRate(e.target.value)}
            placeholder="שער"
            className={addInp + " w-16"}
          />
          <input
            inputMode="numeric"
            value={nIls}
            onChange={(e) => setNIls(e.target.value)}
            placeholder="₪ (אוטו׳)"
            className={addInp + " w-24"}
          />
          <input
            value={nNotes}
            onChange={(e) => setNNotes(e.target.value)}
            placeholder="הערות"
            className={addInp + " w-28"}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {newIlsPreview ? `+ ${nis(newIlsPreview)}` : "+ הוסף"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone?: "green";
}) {
  return (
    <div className="bg-white rounded-xl card-shadow p-5 text-center">
      <div className="text-xs text-[var(--color-muted-foreground)] mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${tone === "green" ? "text-green-700" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}

// Searchable parent picker — donor must be chosen from the parents list.
function ParentCombo({
  parents,
  value,
  onPick,
  inputClass,
  wrapClass,
}: {
  parents: ParentOpt[];
  value: string;
  onPick: (p: ParentOpt) => void;
  inputClass: string;
  wrapClass?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, value]);

  const q = query.trim();
  const matches = (
    q ? parents.filter((p) => p.name.includes(q) || p.hint.includes(q)) : parents
  ).slice(0, 30);

  return (
    <div ref={wrapRef} className={"relative " + (wrapClass ?? "")}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="שם התורם"
        className={inputClass}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 start-0 end-0 min-w-[200px] max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p);
                setQuery(p.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-right text-sm hover:bg-[var(--color-muted)]"
            >
              <span className="truncate">{p.name}</span>
              {p.hint && (
                <span className="text-xs text-[var(--color-muted-foreground)] shrink-0" dir="ltr">
                  {p.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
