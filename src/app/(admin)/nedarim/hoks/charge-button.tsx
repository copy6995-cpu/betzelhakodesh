"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chargeKevaOnce } from "@/app/(admin)/settings/nedarim/actions";

/**
 * One-shot single-payment charge against an existing HoK.
 * Prompts for amount (defaults to the HoK's monthly amount) + confirmation.
 */
export function ChargeButton({
  kevaId,
  defaultAmount,
  clientName,
}: {
  kevaId: string;
  defaultAmount: number | null;
  clientName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    defaultAmount ? String(defaultAmount) : ""
  );
  const [comments, setComments] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setMsg({ tone: "err", text: "סכום לא תקין" });
      return;
    }
    if (
      !confirm(
        `לחייב ${clientName ?? "הו״ק " + kevaId} בסכום ${amt.toLocaleString("he-IL")} ₪?`
      )
    )
      return;
    startTransition(async () => {
      const r = await chargeKevaOnce({
        kevaId,
        amount: amt,
        comments: comments.trim() || undefined,
      });
      setMsg({
        tone: r.ok ? "ok" : "err",
        text: r.message,
      });
      if (r.ok) {
        setOpen(false);
        setAmount(defaultAmount ? String(defaultAmount) : "");
        setComments("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2 py-1 text-xs rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
      >
        חיוב חד״פ
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <form onSubmit={submit} className="inline-flex items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="סכום"
          className="w-20 h-7 rounded border border-[var(--color-border)] px-2 text-xs"
          autoFocus
        />
        <input
          type="text"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="הערה"
          className="w-24 h-7 rounded border border-[var(--color-border)] px-2 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-2 h-7 rounded bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-50"
        >
          {pending ? "..." : "חייב"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-muted-foreground)] px-1"
        >
          ✕
        </button>
      </form>
      {msg && (
        <span
          className={
            "text-xs rounded px-2 py-0.5 border " +
            (msg.tone === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800")
          }
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
