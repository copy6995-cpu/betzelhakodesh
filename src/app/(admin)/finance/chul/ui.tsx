"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChulRepSummary } from "@/lib/reps";
import { addChulRep, deleteChulRep } from "./actions";

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export function ChulRepList({ reps }: { reps: ChulRepSummary[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    start(async () => {
      await addChulRep(name);
      setName("");
      router.refresh();
    });
  }
  function remove(id: string, repName: string) {
    if (!confirm(`למחוק את הנציג "${repName}" וכל התרומות שלו?`)) return;
    start(async () => {
      await deleteChulRep(id);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      <div className="divide-y divide-[var(--color-border)]/60">
        {reps.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-muted)]/40"
          >
            <Link
              href={`/finance/chul/${r.id}`}
              className="flex-1 min-w-0 font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)] truncate"
            >
              {r.name}
            </Link>
            <span className="text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">
              {r.count} תרומות
            </span>
            <span className="font-semibold text-green-700 tabular-nums whitespace-nowrap w-28 text-left">
              {nis(r.total)}
            </span>
            <Link
              href={`/finance/chul/${r.id}`}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
            >
              פתח ←
            </Link>
            <button
              type="button"
              onClick={() => remove(r.id, r.name)}
              disabled={pending}
              className="text-red-400 hover:text-red-600 text-xs"
              title="מחק נציג"
            >
              ✕
            </button>
          </div>
        ))}
        {reps.length === 0 && (
          <div className="px-5 py-8 text-center text-[var(--color-muted-foreground)]">
            אין נציגי חול עדיין. הוסיפו למטה.
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="שם נציג חדש (למשל: ר׳ יעקב זאב אופמן — ארה״ב)"
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !name.trim()}
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          + הוסף נציג
        </button>
      </div>
    </div>
  );
}
