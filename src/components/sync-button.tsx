"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic "sync now" button that runs a server action and shows the result
 * inline. Used on data pages (nedarim/transactions, nedarim/forms,
 * yemot/beds) so the user can pull fresh data without going back to
 * /settings. The parent passes a fully-bound async function so this
 * component stays action-agnostic.
 */
export function SyncButton<T>({
  label = "סנכרן",
  action,
  formatResult,
  variant = "primary",
}: {
  label?: string;
  action: () => Promise<T>;
  formatResult: (r: T) => ReactNode;
  variant?: "primary" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setErr(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await action();
        setResult(r);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  const primary =
    "px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60";
  const outline =
    "px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] disabled:opacity-60";
  const cls = variant === "primary" ? primary : outline;

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={run} disabled={pending} className={cls}>
        {pending ? "מסנכרן..." : label}
      </button>
      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5 max-w-xs">
          {err}
        </div>
      )}
      {result !== null && (
        <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 max-w-sm">
          {formatResult(result)}
        </div>
      )}
    </div>
  );
}
