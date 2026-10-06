"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  planYemotFullSync,
  syncYemotItemsBatch,
  syncYemotLatest,
} from "@/app/(admin)/settings/yemot/actions";

const SYNC_CHUNK = 4;
const RECENT_WEEKS = 5; // ~30 days

/**
 * "עדכן שבוע אחרון" + "סנכרון 30 יום" — the two everyday Yemot syncs, usable on
 * any page (registrations, rooms) so the office can refresh without going to
 * settings. The 30-day sync is chunked (a few weeks per server call) so it
 * never hits the serverless timeout.
 */
export function YemotSyncButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function latest() {
    if (busy) return;
    setBusy(true);
    setErr(false);
    setMsg("מסנכרן שבוע אחרון…");
    try {
      const r = await syncYemotLatest();
      if (!r.ok) {
        setErr(true);
        setMsg(r.error);
        return;
      }
      setMsg(`עודכן · ${r.inserted.toLocaleString("he-IL")} הזמנות`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function recent() {
    if (busy) return;
    setBusy(true);
    setErr(false);
    setMsg("בונה תוכנית…");
    try {
      const plan = await planYemotFullSync();
      if (!plan.ok) {
        setErr(true);
        setMsg(plan.error);
        return;
      }
      const weeks = [...new Set(plan.items.map((i) => i.weekKey))]
        .sort()
        .slice(-RECENT_WEEKS);
      const keep = new Set(weeks);
      const items = plan.items.filter((i) => keep.has(i.weekKey));
      let inserted = 0;
      let done = 0;
      for (let i = 0; i < items.length; i += SYNC_CHUNK) {
        const chunk = items.slice(i, i + SYNC_CHUNK);
        const r = await syncYemotItemsBatch(chunk);
        if (!r.ok) {
          setErr(true);
          setMsg(`נעצר: ${r.error} (${done}/${items.length})`);
          return;
        }
        inserted += r.inserted;
        done += chunk.length;
        setMsg(`מסנכרן… ${done}/${items.length}`);
      }
      setMsg(`30 יום · ${inserted.toLocaleString("he-IL")} הזמנות`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "px-3 h-9 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={latest}
        disabled={busy}
        className={btn + " border-[var(--color-border)] hover:bg-[var(--color-muted)]"}
      >
        {busy ? "…" : "⟳ עדכן שבוע אחרון"}
      </button>
      <button
        type="button"
        onClick={recent}
        disabled={busy}
        className={btn + " border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"}
      >
        סנכרון 30 יום
      </button>
      {msg && (
        <span
          className={
            "text-xs " +
            (err ? "text-red-600" : "text-[var(--color-muted-foreground)]")
          }
        >
          {msg}
        </span>
      )}
    </div>
  );
}
