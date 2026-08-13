"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FinanceData, FinanceEntryRow } from "@/lib/finance";
import { addFinanceEntry, deleteFinanceEntry } from "./actions";

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
const inputCls =
  "h-9 rounded-lg border border-[var(--color-border)] px-2 text-sm";

/** Add + list of finance rows for one category. */
function EntryList({
  rows,
  kind,
  fixedCategory,
  categoryOptions,
  labelPlaceholder,
  supervisorOptions,
}: {
  rows: FinanceEntryRow[];
  kind: "income" | "expense";
  fixedCategory?: string;
  categoryOptions?: { value: string; label: string }[];
  labelPlaceholder: string;
  supervisorOptions?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [category, setCategory] = useState(
    fixedCategory ?? categoryOptions?.[0]?.value ?? ""
  );
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const computedAmount = parseFloat(amount || "0");

  function add() {
    if (!computedAmount && !label.trim()) return;
    start(async () => {
      await addFinanceEntry({
        kind,
        category: fixedCategory ?? category,
        label,
        amount: computedAmount,
        date: date || null,
        meta: null,
      });
      setLabel("");
      setAmount("");
      setDate("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteFinanceEntry(id);
      router.refresh();
    });
  }

  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      {rows.length > 0 && (
        <table className="w-full text-sm mb-2">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-[var(--color-border)]/40"
              >
                <td className="py-1.5 pe-2 font-medium">
                  {categoryOptions
                    ? categoryOptions.find((c) => c.value === r.category)
                        ?.label ?? r.category
                    : ""}
                  {r.label ? ` ${r.label}` : ""}
                </td>
                <td className="py-1.5 px-2 text-[var(--color-muted-foreground)] whitespace-nowrap">
                  {r.date ?? ""}
                </td>
                <td className="py-1.5 px-2 text-left font-semibold whitespace-nowrap">
                  {nis(r.amount)}
                </td>
                <td className="py-1.5 ps-2 text-left w-8">
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={pending}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="מחק"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-border)] font-bold">
              <td className="py-1.5 pe-2" colSpan={2}>
                סה״כ
              </td>
              <td className="py-1.5 px-2 text-left">{nis(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-2">
        {categoryOptions && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls + " bg-white"}
          >
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={labelPlaceholder}
          list={supervisorOptions ? "sup-names" : undefined}
          className={inputCls + " flex-1 min-w-[120px]"}
        />
        {supervisorOptions && (
          <datalist id="sup-names">
            {supervisorOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="₪ סכום"
          className={inputCls + " w-28"}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
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

function Card({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "income" | "expense" | "net";
}) {
  const color =
    tone === "income"
      ? "text-green-700"
      : tone === "expense"
      ? "text-red-600"
      : value >= 0
      ? "text-[var(--color-primary)]"
      : "text-red-600";
  return (
    <div className="bg-white rounded-xl card-shadow p-5 text-center">
      <div className="text-xs text-[var(--color-muted-foreground)] mb-1">
        {title}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{nis(value)}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl card-shadow p-5">
      <h2 className="text-base font-semibold text-[var(--color-primary)] mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function FinanceUI({ data }: { data: FinanceData }) {
  const { income, expense, net } = data;
  const supRemaining = expense.supervisorTarget - expense.supervisorPaid;
  const adneiTotal = (expense.byCategory["adnei"] ?? []).reduce(
    (a, r) => a + r.amount,
    0
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="סה״כ הכנסות" value={income.total} tone="income" />
        <Card title="סה״כ הוצאות" value={expense.total} tone="expense" />
        <Card title="נשאר בקופה" value={net} tone="net" />
      </div>

      {/* Income */}
      <Section title={`הכנסות · ${nis(income.total)}`}>
        <div className="text-sm mb-3">
          <div className="flex justify-between py-1.5 border-b border-[var(--color-border)]/40">
            <span className="font-medium">נדרים פלוס</span>
            <span className="font-semibold">{nis(income.nedarim)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--color-border)]/40">
            <span className="font-medium">
              אשראי — דוח קבוצות (כל הקבוצות)
            </span>
            <span className="font-semibold">{nis(income.groupsCredit)}</span>
          </div>
        </div>
        <h3 className="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">
          אחר · צ׳ק · העברה
        </h3>
        <EntryList
          rows={income.manual}
          kind="income"
          categoryOptions={[
            { value: "other", label: "אחר" },
            { value: "check", label: "צ׳ק" },
            { value: "transfer", label: "העברה" },
          ]}
          labelPlaceholder="תיאור"
        />
      </Section>

      {/* Supervisors */}
      <Section title="הוצאות · משגיחים">
        <div className="grid grid-cols-3 gap-3 text-center text-sm mb-3">
          <div className="rounded-lg bg-[var(--color-muted)] p-2">
            <div className="text-xs text-[var(--color-muted-foreground)]">
              לתשלום (מהלוח שנה)
            </div>
            <div className="font-bold">{nis(expense.supervisorTarget)}</div>
          </div>
          <div className="rounded-lg bg-[var(--color-muted)] p-2">
            <div className="text-xs text-[var(--color-muted-foreground)]">
              שולם
            </div>
            <div className="font-bold text-green-700">
              {nis(expense.supervisorPaid)}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-muted)] p-2">
            <div className="text-xs text-[var(--color-muted-foreground)]">
              נשאר לתשלום
            </div>
            <div className="font-bold text-red-600">{nis(supRemaining)}</div>
          </div>
        </div>
        {expense.perSupervisor.length > 0 && (
          <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
            לפי משגיח:{" "}
            {expense.perSupervisor
              .map((s) => `${s.name} ${nis(s.cost)}`)
              .join(" · ")}
          </div>
        )}
        <h3 className="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">
          תשלומים למשגיחים
        </h3>
        <EntryList
          rows={expense.byCategory["supervisor-payment"] ?? []}
          kind="expense"
          fixedCategory="supervisor-payment"
          labelPlaceholder="שם משגיח"
          supervisorOptions={expense.perSupervisor.map((s) => s.name)}
        />
      </Section>

      {/* Yeshiva representatives */}
      <Section title="הוצאות · נציגים בישיבות">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-medium">סה״כ ששולם לנציגים בישיבות</span>
            <span className="font-semibold ms-2 text-red-600">
              {nis(expense.repsPaid)}
            </span>
          </div>
          <Link
            href="/finance/representatives"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            טבלת תשלום חודשית ←
          </Link>
        </div>
      </Section>

      {/* Adnei HaKodesh */}
      <Section title="הוצאות · אדני הקודש">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-medium">סה״כ אדני הקודש</span>
            <span className="font-semibold ms-2 text-red-600">
              {nis(adneiTotal)}
            </span>
          </div>
          <Link
            href="/finance/adnei"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            יומן אדני הקודש ←
          </Link>
        </div>
      </Section>

      {/* Beit Malka */}
      <Section title="הוצאות · בית מלכה (מיטות)">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-medium">שולם עבור מיטות בית מלכה</span>
            <span className="font-semibold ms-2 text-red-600">
              {nis(expense.beitMalkaPaid)}
            </span>
          </div>
          <Link
            href="/finance/beit-malka"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            טבלת מיטות לפי שבת ←
          </Link>
        </div>
      </Section>

      {/* Misc */}
      <Section title="הוצאות · שונות">
        <EntryList
          rows={expense.byCategory["misc"] ?? []}
          kind="expense"
          fixedCategory="misc"
          labelPlaceholder="תיאור ההוצאה"
        />
      </Section>
    </div>
  );
}
