"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser, deleteUser } from "./actions";

type SectionOpt = { key: string; label: string };
export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  sections: string[];
};

const inputCls =
  "h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm w-full";
const labelCls =
  "text-xs font-semibold text-[var(--color-muted-foreground)] mb-1 block";

/** Create/edit form. `user` present → edit mode (email locked, password
 *  optional); absent → create mode. */
function UserForm({
  user,
  sectionOptions,
  onDone,
}: {
  user?: UserRow;
  sectionOptions: SectionOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "user");
  const [sections, setSections] = useState<string[]>(user?.sections ?? []);

  function toggle(key: string) {
    setSections((s) =>
      s.includes(key) ? s.filter((k) => k !== key) : [...s, key]
    );
  }

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        if (user) {
          await updateUser(user.id, { name, role, sections, password });
        } else {
          await createUser({ email, name, password, role, sections });
        }
        onDone();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <div className="bg-[var(--color-muted)]/50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>אימייל</label>
          <input
            type="email"
            value={email}
            disabled={!!user}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls + (user ? " opacity-60" : "")}
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label className={labelCls}>שם</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="שם מלא"
          />
        </div>
        <div>
          <label className={labelCls}>
            {user ? "סיסמה חדשה (ריק = ללא שינוי)" : "סיסמה"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder={user ? "••••••" : "לפחות 6 תווים"}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className={labelCls}>רמת הרשאה</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls + " cursor-pointer"}
          >
            <option value="user">משתמש (גישה לפי מדורים)</option>
            <option value="admin">אדמין (גישה מלאה)</option>
          </select>
        </div>
      </div>

      {role !== "admin" && (
        <div>
          <label className={labelCls}>מדורים מותרים</label>
          <div className="flex flex-wrap gap-2">
            {sectionOptions.map((s) => {
              const on = sections.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={
                    "px-3 h-8 rounded-full text-xs font-medium border transition-colors " +
                    (on
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-white text-[var(--color-muted-foreground)] border-[var(--color-border)] hover:border-[var(--color-primary)]")
                  }
                >
                  {on ? "✓ " : ""}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-10 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {pending ? "שומר…" : user ? "עדכן" : "צור משתמש"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 px-4 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

export function UsersManager({
  users,
  sectionOptions,
  currentUserId,
}: {
  users: UserRow[];
  sectionOptions: SectionOpt[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const labelOf = (key: string) =>
    sectionOptions.find((s) => s.key === key)?.label ?? key;

  function remove(u: UserRow) {
    if (!confirm(`למחוק את המשתמש ${u.email}?`)) return;
    setBusyId(u.id);
    (async () => {
      try {
        await deleteUser(u.id);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "שגיאה במחיקה");
      } finally {
        setBusyId(null);
      }
    })();
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="h-10 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
        >
          + הוסף משתמש
        </button>
      )}

      {adding && (
        <UserForm
          sectionOptions={sectionOptions}
          onDone={() => setAdding(false)}
        />
      )}

      <div className="bg-white rounded-xl card-shadow divide-y divide-[var(--color-border)]/60">
        {users.map((u) => (
          <div key={u.id} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">
                    {u.name || u.email}
                  </span>
                  {u.role === "admin" ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                      אדמין
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                      משתמש
                    </span>
                  )}
                  {u.id === currentUserId && (
                    <span className="text-[11px] text-[var(--color-muted-foreground)]">
                      (אתה)
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                  {u.email}
                </div>
                {u.role !== "admin" && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {u.sections.length === 0 ? (
                      <span className="text-xs text-red-500">
                        אין מדורים מותרים
                      </span>
                    ) : (
                      u.sections.map((k) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--color-muted)] text-[var(--color-foreground)]"
                        >
                          {labelOf(k)}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setEditingId((id) => (id === u.id ? null : u.id))
                  }
                  className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
                >
                  {editingId === u.id ? "סגור" : "עריכה"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(u)}
                  disabled={u.id === currentUserId || busyId === u.id}
                  className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-40"
                >
                  מחק
                </button>
              </div>
            </div>

            {editingId === u.id && (
              <div className="mt-4">
                <UserForm
                  user={u}
                  sectionOptions={sectionOptions}
                  onDone={() => setEditingId(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
