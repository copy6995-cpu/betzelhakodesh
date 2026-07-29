"use client";

/** Print / Save-as-PDF trigger for the room-assignment report. */
export function PrintControls() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] whitespace-nowrap"
    >
      🖨 הדפס / שמור כ־PDF
    </button>
  );
}
