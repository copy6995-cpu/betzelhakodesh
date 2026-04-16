"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPayment } from "../../../actions";

export function PaymentForm({
  studentId,
  availableNumbers,
}: {
  studentId: string;
  availableNumbers: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentNumber, setPaymentNumber] = useState(availableNumbers[0]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("סכום לא תקין");
      return;
    }
    startTransition(async () => {
      try {
        await addPayment({
          studentId,
          paymentNumber,
          amount: amt,
          method: method.trim() || null,
          date: date || null,
          externalRef: externalRef.trim() || null,
          notes: notes.trim() || null,
        });
        router.push(`/bachurim/${studentId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl card-shadow p-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <Label>מספר תשלום</Label>
        <select
          value={paymentNumber}
          onChange={(e) => setPaymentNumber(parseInt(e.target.value, 10))}
          className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          {availableNumbers.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "נדרים (אשראי)" : `תשלום #${n}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>סכום (₪)</Label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        />
      </div>

      <div>
        <Label>אמצעי תשלום</Label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">—</option>
          <option>אשראי</option>
          <option>העברות</option>
          <option>צ'יק</option>
          <option>נדרים פלוס</option>
          <option>אחר</option>
        </select>
      </div>

      <div>
        <Label>תאריך</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        />
      </div>

      <div>
        <Label>אסמכתא</Label>
        <input
          type="text"
          value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)}
          className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        />
      </div>

      <div>
        <Label>הערות</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 h-10 rounded-lg border border-[var(--color-border)] bg-white text-sm font-medium hover:bg-[var(--color-muted)]"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60"
        >
          {pending ? "שומר..." : "הוסף תשלום"}
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-1">
      {children}
    </span>
  );
}
