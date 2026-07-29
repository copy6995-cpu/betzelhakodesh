"use client";

import { useState } from "react";

/**
 * Rooms export trigger. Asks for a label to append to each file name
 * ("{yeshiva} חדרים {label}"), defaulting to the week's parasha, then
 * downloads the per-yeshiva zip.
 */
export function RoomsExportButton({
  weekKey,
  defaultLabel,
}: {
  weekKey: string;
  defaultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(defaultLabel);

  function download() {
    const params = new URLSearchParams({ week: weekKey });
    if (label.trim()) params.set("label", label.trim());
    window.location.href = `/api/rooms/export?${params.toString()}`;
    setOpen(false);
  }

  function openPdf() {
    const params = new URLSearchParams({ week: weekKey });
    if (label.trim()) params.set("label", label.trim());
    window.open(`/rooms/print?${params.toString()}`, "_blank");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLabel(defaultLabel);
          setOpen(true);
        }}
        className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] flex items-center"
      >
        ↓ יצוא לפי ישיבה (zip)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-2">
              יצוא חדרים
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              שם הקבצים יהיה{" "}
              <b>
                &quot;ישיבה חדרים{label.trim() ? ` ${label.trim()}` : ""}&quot;
              </b>
              . מה להוסיף?
            </p>
            <input
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") download();
              }}
              placeholder="למשל: ויחי"
              className="mt-3 w-full px-3 h-10 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
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
                onClick={openPdf}
                className="px-4 h-9 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium hover:bg-[var(--color-muted)]"
              >
                🖨 PDF
              </button>
              <button
                type="button"
                onClick={download}
                className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)]"
              >
                ↓ Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
