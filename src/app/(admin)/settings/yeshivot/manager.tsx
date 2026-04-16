"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addYeshiva, renameYeshiva, toggleYeshivaActive } from "../actions";

type Yeshiva = {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
};

export function YeshivotManager({ yeshivot }: { yeshivot: Yeshiva[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      await addYeshiva(newName);
      setNewName("");
      router.refresh();
    });
  }

  function rename(id: string) {
    const val = edits[id];
    if (!val || !val.trim()) return;
    startTransition(async () => {
      await renameYeshiva(id, val);
      setEdits((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      router.refresh();
    });
  }

  function toggle(id: string) {
    startTransition(async () => {
      await toggleYeshivaActive(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="bg-white rounded-xl card-shadow p-5 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="שם ישיבה חדשה"
          className="flex-1 h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-5 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          + הוסף
        </button>
      </form>

      <div className="bg-white rounded-xl card-shadow divide-y divide-[var(--color-border)]">
        {yeshivot.map((y) => {
          const editing = edits[y.id] !== undefined;
          return (
            <div key={y.id} className="flex items-center gap-3 p-4">
              {editing ? (
                <input
                  value={edits[y.id]}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [y.id]: e.target.value }))
                  }
                  className="flex-1 h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
                  autoFocus
                />
              ) : (
                <span
                  className={`flex-1 font-medium ${
                    y.active ? "" : "line-through text-[var(--color-muted-foreground)]"
                  }`}
                >
                  {y.name}
                </span>
              )}
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => rename(y.id)}
                      disabled={pending}
                      className="px-3 h-8 rounded-md bg-[var(--color-primary)] text-white text-xs font-medium"
                    >
                      שמור
                    </button>
                    <button
                      onClick={() =>
                        setEdits((prev) => {
                          const { [y.id]: _, ...rest } = prev;
                          return rest;
                        })
                      }
                      className="px-3 h-8 rounded-md border border-[var(--color-border)] text-xs"
                    >
                      ביטול
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setEdits((prev) => ({ ...prev, [y.id]: y.name }))
                      }
                      className="px-3 h-8 rounded-md border border-[var(--color-border)] text-xs"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => toggle(y.id)}
                      disabled={pending}
                      className={`px-3 h-8 rounded-md text-xs font-medium ${
                        y.active
                          ? "border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                          : "bg-[var(--color-success)] text-white"
                      }`}
                    >
                      {y.active ? "ארכב" : "החזר"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
