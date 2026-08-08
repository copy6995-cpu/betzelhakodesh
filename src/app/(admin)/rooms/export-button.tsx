"use client";

import { useState } from "react";

/**
 * Rooms export. Primary flow is a per-yeshiva download (one PDF or xlsx file
 * each — no zip, since Netfree and similar filters block .zip). A combined PDF
 * and the old per-yeshiva zip stay available as secondary options.
 */
export function RoomsExportButton({
  weekKey,
  defaultLabel,
  yeshivot,
}: {
  weekKey: string;
  defaultLabel: string;
  yeshivot: string[];
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(defaultLabel);

  const url = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ week: weekKey, ...extra });
    if (label.trim()) p.set("label", label.trim());
    return `/api/rooms/export?${p.toString()}`;
  };

  function downloadZip() {
    window.location.href = url({});
    setOpen(false);
  }

  function openPrint() {
    const p = new URLSearchParams({ week: weekKey });
    if (label.trim()) p.set("label", label.trim());
    window.open(`/rooms/print?${p.toString()}`, "_blank");
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
        ↓ יצוא חדרים
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            dir="rtl"
            className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-1">
              יצוא חדרים
            </h3>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
              הורדה נפרדת לכל ישיבה (קובץ יחיד — בלי zip, שנחסם בנטפרי). שם הקובץ:{" "}
              <b>&quot;ישיבה חדרים{label.trim() ? ` ${label.trim()}` : ""}&quot;</b>
            </p>

            <label className="block text-xs font-medium mb-1">
              תוספת לשם הקובץ
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="למשל: ויחי"
              className="w-full px-3 h-9 rounded-lg border border-[var(--color-border)] bg-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />

            {yeshivot.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)] py-4 text-center">
                אין שיבוצים לשבוע זה.
              </p>
            ) : (
              <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]/60 mb-4">
                {yeshivot.map((y) => (
                  <div
                    key={y}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-sm font-medium truncate">{y}</span>
                    <span className="flex gap-2 shrink-0">
                      <a
                        href={url({ format: "pdf", yeshiva: y })}
                        download
                        className="px-3 h-8 inline-flex items-center rounded-md bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-hover)]"
                      >
                        ↓ PDF
                      </a>
                      <a
                        href={url({ yeshiva: y })}
                        download
                        className="px-3 h-8 inline-flex items-center rounded-md border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-muted)]"
                      >
                        ↓ Excel
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-between items-center flex-wrap border-t border-[var(--color-border)] pt-3">
              <div className="flex gap-2 flex-wrap text-xs">
                <a
                  href={url({ format: "pdf" })}
                  download
                  className="px-3 h-8 inline-flex items-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                >
                  ↓ PDF מאוחד
                </a>
                <button
                  type="button"
                  onClick={openPrint}
                  className="px-3 h-8 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                >
                  👁 תצוגה
                </button>
                <button
                  type="button"
                  onClick={downloadZip}
                  className="px-3 h-8 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                >
                  ↓ zip
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-8 rounded-md border border-[var(--color-border)] text-sm"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
