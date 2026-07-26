"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFormSubmissionField } from "./edit-actions";

/**
 * Inline-editable cell for a single form-submission field (typically
 * `Kod_1`). Renders the value + a small pencil button; on click, swaps to
 * an input with save/cancel. Saving hits the server action and refreshes.
 */
export function EditKodCell({
  submissionId,
  field,
  value,
}: {
  submissionId: string;
  field: string;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    if (draft.trim() === current) {
      setEditing(false);
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        const r = await updateFormSubmissionField(
          submissionId,
          field,
          draft.trim()
        );
        setCurrent(r.value);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 group">
        <span>{current || "—"}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(current);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--color-accent)] hover:underline transition-opacity"
          title={`ערוך ${field}`}
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        disabled={pending}
        className="w-24 h-7 rounded border border-[var(--color-border)] px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="text-xs text-[var(--color-accent)] hover:font-semibold disabled:opacity-50"
        title="שמור"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        className="text-xs text-[var(--color-muted-foreground)] hover:text-red-600 disabled:opacity-50"
        title="בטל"
      >
        ✕
      </button>
      {err && (
        <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
          {err}
        </span>
      )}
    </span>
  );
}
