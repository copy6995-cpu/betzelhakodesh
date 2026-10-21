"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatILS } from "@/lib/utils";
import { updatePayment } from "../actions";
import { DeletePaymentButton } from "./delete-payment-button";

const METHODS = ["אשראי", "העברות", "צ'יק", "חד פעמי", "אחר", "נדרים פלוס"];

type P = {
  id: string;
  paymentNumber: number;
  amount: number;
  method: string | null;
  dateISO: string | null;
  externalRef: string | null;
};

const inp = "h-8 w-full rounded border border-[var(--color-border)] px-1.5 text-sm";

export function EditablePaymentRow({ payment }: { payment: P }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount || ""));
  const [method, setMethod] = useState(payment.method ?? "");
  const [date, setDate] = useState(payment.dateISO ?? "");
  const [ref, setRef] = useState(payment.externalRef ?? "");

  function save() {
    start(async () => {
      await updatePayment(payment.id, {
        amount: parseFloat(amount || "0"),
        method: method || null,
        date: date || null,
        externalRef: ref || null,
      });
      setEditing(false);
      router.refresh();
    });
  }
  function cancel() {
    setAmount(String(payment.amount || ""));
    setMethod(payment.method ?? "");
    setDate(payment.dateISO ?? "");
    setRef(payment.externalRef ?? "");
    setEditing(false);
  }

  const isRefund = payment.amount < 0;
  const isOneTime = payment.method === "חד פעמי";
  const numLabel =
    payment.paymentNumber === 0 ? "—" : `#${payment.paymentNumber}`;

  if (editing) {
    return (
      <tr className="border-b border-[var(--color-border)]/50 bg-[var(--color-muted)]/30">
        <td className="py-2 pe-4">{numLabel}</td>
        <td className="py-2 px-4">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inp + " w-24"}
          />
        </td>
        <td className="py-2 px-4">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={inp + " bg-white"}
          >
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {method && !METHODS.includes(method) && (
              <option value={method}>{method}</option>
            )}
          </select>
        </td>
        <td className="py-2 px-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inp + " w-[130px]"}
          />
        </td>
        <td className="py-2 px-4">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className={inp}
          />
        </td>
        <td className="py-2 px-4 text-left whitespace-nowrap">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="text-green-700 hover:text-green-800 text-xs font-medium me-2"
          >
            שמור
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-xs"
          >
            ביטול
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--color-border)]/50">
      <td className="py-2.5 pe-4">
        {isRefund ? (
          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">
            החזר
          </span>
        ) : (
          numLabel
        )}
      </td>
      <td
        className={`py-2.5 px-4 font-semibold ${
          isRefund ? "text-red-600" : ""
        }`}
      >
        {formatILS(payment.amount)}
      </td>
      <td className="py-2.5 px-4">
        {payment.method ?? "—"}
        {isOneTime && (
          <span className="ms-2 px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-semibold">
            לא ביתרה
          </span>
        )}
      </td>
      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
        {payment.dateISO
          ? new Date(`${payment.dateISO}T00:00:00`).toLocaleDateString("he-IL")
          : "—"}
      </td>
      <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] font-mono text-xs">
        {payment.externalRef ?? "—"}
      </td>
      <td className="py-2.5 px-4 text-left whitespace-nowrap">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-xs font-medium me-3"
        >
          ערוך
        </button>
        <DeletePaymentButton
          paymentId={payment.id}
          label={`${numLabel} · ${formatILS(payment.amount)}`}
        />
      </td>
    </tr>
  );
}
