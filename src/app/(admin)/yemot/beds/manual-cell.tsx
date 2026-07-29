"use client";

import { useTransition } from "react";
import { removeManualBedReservation } from "./actions";

/**
 * A bed cell that was entered by hand. Shows the date with a small ✎ marker;
 * clicking it (with confirmation) removes the manual reservation.
 */
export function ManualCell({
  personalCode,
  weekKey,
  label,
}: {
  personalCode: string;
  weekKey: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  function remove() {
    if (pending) return;
    if (!confirm("להסיר את הרישום הידני?")) return;
    start(async () => {
      await removeManualBedReservation({ personalCode, weekKey });
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      title="רישום ידני — לחץ להסרה"
      className="w-full py-1.5 px-1 text-center text-xs bg-[#C6EFCE] font-mono hover:bg-[#a9e0b3] disabled:opacity-50"
    >
      {label}
      <sup className="ms-0.5 text-[var(--color-primary)]">✎</sup>
    </button>
  );
}
