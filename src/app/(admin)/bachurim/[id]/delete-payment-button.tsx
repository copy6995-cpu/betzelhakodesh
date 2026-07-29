"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayment } from "../actions";

/**
 * Delete a single non-Nedarim payment. Opens a confirm dialog that requires
 * the admin password (verified server-side in deletePayment).
 */
export function DeletePaymentButton({
  paymentId,
  label,
}: {
  paymentId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePayment(paymentId, password);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה במחיקה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="מחק תשלום"
        className="text-xs text-red-600 hover:text-red-800 hover:underline"
      >
        מחק
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-2">
              מחיקת תשלום
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              למחוק את התשלום <b>{label}</b>? הזן סיסמה לאישור.{" "}
              <b>פעולה זו לא הפיכה.</b>
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !pending) onConfirm();
              }}
              placeholder="סיסמת מנהל"
              className="mt-3 w-full px-3 h-10 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={close}
                className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending || !password}
                className="px-4 h-9 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "מוחק..." : "מחק"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
