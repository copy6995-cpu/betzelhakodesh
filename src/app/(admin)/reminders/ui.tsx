"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addReminder,
  completeReminder,
  snoozeReminder,
  deleteReminder,
} from "./actions";

const btn =
  "h-8 px-3 rounded-lg text-xs font-medium disabled:opacity-50 whitespace-nowrap";

/** Add-reminder form (date + text) for the bachur card. */
export function AddReminder({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  function add() {
    if (!text.trim() || !date) return;
    start(async () => {
      await addReminder(studentId, text, date);
      setText("");
      setDate("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-9 rounded-lg border border-[var(--color-border)] px-2.5 text-sm"
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="תזכורת…"
        className="flex-1 min-w-[140px] h-9 rounded-lg border border-[var(--color-border)] px-2.5 text-sm"
      />
      <button
        type="button"
        onClick={add}
        disabled={pending || !text.trim() || !date}
        className={btn + " h-9 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"}
      >
        + הוסף
      </button>
    </div>
  );
}

/** בוצע / דחה-לתאריך / מחיקה controls for one reminder row. */
export function ReminderControls({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [snoozing, setSnoozing] = useState(false);
  const [date, setDate] = useState("");

  function done() {
    start(async () => {
      await completeReminder(id);
      router.refresh();
    });
  }
  function snooze() {
    if (!date) return;
    start(async () => {
      await snoozeReminder(id, date);
      setSnoozing(false);
      setDate("");
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("למחוק את התזכורת?")) return;
    start(async () => {
      await deleteReminder(id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <button
        type="button"
        onClick={done}
        disabled={pending}
        className={btn + " bg-green-600 text-white hover:bg-green-700"}
      >
        ✓ בוצע
      </button>
      {snoozing ? (
        <span className="flex items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 rounded-lg border border-[var(--color-border)] px-2 text-xs"
          />
          <button
            type="button"
            onClick={snooze}
            disabled={pending || !date}
            className={btn + " border border-[var(--color-border)] hover:bg-[var(--color-muted)]"}
          >
            דחה
          </button>
          <button
            type="button"
            onClick={() => setSnoozing(false)}
            className="text-[var(--color-muted-foreground)] text-xs px-1"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setSnoozing(true)}
          disabled={pending}
          className={btn + " border border-[var(--color-border)] hover:bg-[var(--color-muted)]"}
        >
          דחה לתאריך
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-red-400 hover:text-red-600 text-xs px-1"
        title="מחק"
      >
        🗑
      </button>
    </div>
  );
}
