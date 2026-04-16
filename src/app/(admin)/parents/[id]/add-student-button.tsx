"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchStudents, reassignStudent } from "../actions";

type StudentMatch = {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  year: string;
  yeshiva: string;
  personalCode: string;
  parentId: string;
  parentName: string;
};

export function AddStudentButton({
  targetParentId,
  targetParentName,
}: {
  targetParentId: string;
  targetParentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentMatch[]>([]);
  const [selected, setSelected] = useState<StudentMatch | null>(null);
  const [searching, startSearchTransition] = useTransition();
  const [saving, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // On open, fetch the first 30 students alphabetically so the user sees
  // a browsable list even before typing.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setSelected(null);
    startSearchTransition(async () => {
      const rows = await searchStudents({ q: "" });
      setResults(rows);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSearch(value: string) {
    setQ(value);
    setSelected(null);
    startSearchTransition(async () => {
      const rows = await searchStudents({ q: value });
      setResults(rows);
    });
  }

  function onConfirm() {
    if (!selected) return;
    if (selected.parentId === targetParentId) {
      setError("הילד כבר משויך להורה זה");
      return;
    }
    setError(null);
    startSaveTransition(async () => {
      try {
        await reassignStudent({ studentId: selected.id, targetParentId });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        + הוסף ילד קיים
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                  הוספת ילד להורה
                </h3>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                  חפש תלמיד קיים והעבר אותו להורה <b>{targetParentName}</b>.
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
              placeholder="חיפוש תלמיד (שם, קוד אישי)..."
              className="w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              autoFocus
            />

            <div className="mt-3 max-h-72 overflow-y-auto">
              {searching && (
                <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                  מחפש...
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                  לא נמצאו תלמידים מתאימים
                </div>
              )}
              {results.map((s) => {
                const isSelected = selected?.id === s.id;
                const alreadyHere = s.parentId === targetParentId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    disabled={alreadyHere}
                    className={`w-full text-right p-3 rounded-md border mb-1 transition-colors ${
                      alreadyHere
                        ? "border-[var(--color-border)] opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    <div className="font-medium">
                      {s.lastName} {s.firstName}
                      <span className="text-xs text-[var(--color-muted-foreground)] font-normal me-2">
                        · {s.year} · {s.yeshiva} · קוד {s.personalCode}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      {alreadyHere ? (
                        <span className="text-[var(--color-success)]">
                          כבר משויך להורה הזה
                        </span>
                      ) : (
                        <>הורה נוכחי: <b>{s.parentName}</b></>
                      )}
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

            {selected && selected.parentId !== targetParentId && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
                <b>
                  {selected.lastName} {selected.firstName}
                </b>{" "}
                יועבר מ-<b>{selected.parentName}</b> ל-<b>{targetParentName}</b>.
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
                disabled={!selected || saving}
                className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? "מעביר..." : "העבר להורה זה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
