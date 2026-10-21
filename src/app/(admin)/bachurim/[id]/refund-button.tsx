"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRefund } from "../actions";

const METHODS = ["אשראי", "העברות", "צ'יק", "חד פעמי", "נדרים פלוס", "אחר"];
const field =
  "w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm";

export function RefundButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("סכום לא תקין");
      return;
    }
    start(async () => {
      try {
        await addRefund({
          studentId,
          amount: amt,
          method: method || null,
          date: date || null,
          notes: notes || null,
        });
        setOpen(false);
        setAmount("");
        setMethod("");
        setDate("");
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 h-8 rounded-md border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors flex items-center"
      >
        − החזר
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            dir="rtl"
            className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">
              החזר כספים
            </h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              ההחזר נרשם כסכום שלילי — מקטין את ה״שולם״ ומגדיל את היתרה.
            </p>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                סכום להחזר (₪)
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={field + " mt-1"}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                אמצעי
              </span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={field + " mt-1"}
              >
                <option value="">—</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                תאריך
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field + " mt-1"}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                הערה
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={field + " mt-1"}
                placeholder="סיבת ההחזר (רשות)"
              />
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 h-9 rounded-lg border border-[var(--color-border)] text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-4 h-9 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "שומר…" : "בצע החזר"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
