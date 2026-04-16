"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchParents, mergeParents } from "../actions";

type ParentMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  studentCount: number;
};

export function MergeParentButton({
  keepParentId,
  keepParentName,
}: {
  keepParentId: string;
  keepParentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ParentMatch[]>([]);
  const [selected, setSelected] = useState<ParentMatch | null>(null);
  const [searching, startSearchTransition] = useTransition();
  const [merging, startMergeTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSearch(value: string) {
    setQ(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearchTransition(async () => {
      const rows = await searchParents({ q: value, excludeId: keepParentId });
      setResults(rows);
    });
  }

  function onConfirm() {
    if (!selected) return;
    setError(null);
    startMergeTransition(async () => {
      try {
        await mergeParents({ keepId: keepParentId, removeId: selected.id });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה במיזוג");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 h-9 rounded-md border border-[var(--color-border)] bg-white text-sm font-medium hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        מזג עם הורה אחר
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                  מיזוג הורה
                </h3>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                  הילדים יועברו אל <b>{keepParentName}</b>. ההורה השני יימחק.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="חיפוש הורה (שם, טלפון, ת.ז.)..."
              className="w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              autoFocus
            />

            <div className="mt-3 max-h-72 overflow-y-auto">
              {searching && (
                <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                  מחפש...
                </div>
              )}
              {!searching && q.trim().length >= 2 && results.length === 0 && (
                <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                  לא נמצאו הורים מתאימים
                </div>
              )}
              {results.map((p) => {
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={`w-full text-right p-3 rounded-md border mb-1 transition-colors ${
                      isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    <div className="font-medium">
                      {p.lastName} {p.firstName}
                    </div>
                    <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      {p.studentCount} ילדים
                      {p.phone && ` · ${p.phone}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {selected && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
                כל {selected.studentCount} הילדים של{" "}
                <b>
                  {selected.lastName} {selected.firstName}
                </b>{" "}
                יועברו ל-<b>{keepParentName}</b>, וההורה "
                {selected.firstName} {selected.lastName}" יימחק.
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!selected || merging}
                className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
              >
                {merging ? "ממזג..." : "בצע מיזוג"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
