"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFormSubmission } from "./edit-actions";

/**
 * Small X button in a submissions table row — hard-deletes the form
 * submission after a confirm. Used for pruning duplicates.
 */
export function DeleteRowButton({
  submissionId,
  label,
}: {
  submissionId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    if (!confirm(`למחוק את ההגשה ${label}?`)) return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteFormSubmission(submissionId);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-red-600 hover:text-red-800 hover:font-bold text-sm disabled:opacity-50"
        title="מחק הגשה"
      >
        {pending ? "..." : "×"}
      </button>
      {err && (
        <span className="ms-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
          {err}
        </span>
      )}
    </>
  );
}
