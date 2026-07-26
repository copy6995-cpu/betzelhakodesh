"use client";

import { useState } from "react";

/**
 * Cell for the "הערות" column. Long notes render as a 60-char preview
 * ending with "…" — clicking the preview reveals the full note in place.
 * Also exposes the full text as a native browser tooltip (title attr)
 * so a quick hover surfaces it without needing to click.
 */
const PREVIEW_LEN = 60;

export function NoteCell({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!value.trim()) return <span>—</span>;
  if (value.length <= PREVIEW_LEN) {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  if (expanded) {
    return (
      <span className="inline-flex items-start gap-1 max-w-md">
        <span className="whitespace-pre-wrap">{value}</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          title="קפל"
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] shrink-0"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      title={value}
      className="text-right cursor-pointer hover:text-[var(--color-accent)] underline decoration-dotted decoration-[var(--color-muted-foreground)] underline-offset-2"
    >
      {value.slice(0, PREVIEW_LEN) + "…"}
    </button>
  );
}
