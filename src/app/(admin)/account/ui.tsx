"use client";

import { useState, useTransition } from "react";

import { changeOwnPassword } from "./actions";

const inputCls =
  "h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm w-full";
const labelCls =
  "text-xs font-semibold text-[var(--color-muted-foreground)] mb-1 block";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    setMsg(null);
    if (!current || !next) {
      setMsg({ ok: false, text: "יש למלא את כל השדות" });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "הסיסמה החדשה ואימותה אינם תואמים" });
      return;
    }
    startTransition(async () => {
      try {
        await changeOwnPassword(current, next);
        setMsg({ ok: true, text: "הסיסמה עודכנה בהצלחה" });
        setCurrent("");
        setNext("");
        setConfirm("");
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "שגיאה" });
      }
    });
  }

  return (
    <div className="bg-white rounded-xl card-shadow p-6 max-w-md space-y-4">
      <div>
        <label className={labelCls}>סיסמה נוכחית</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputCls}
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className={labelCls}>סיסמה חדשה</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputCls}
          placeholder="לפחות 6 תווים"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className={labelCls}>אימות סיסמה חדשה</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
          autoComplete="new-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>

      {msg && (
        <p
          className={
            "text-sm " + (msg.ok ? "text-green-600" : "text-red-600")
          }
        >
          {msg.text}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-10 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {pending ? "מעדכן…" : "עדכן סיסמה"}
      </button>
    </div>
  );
}
