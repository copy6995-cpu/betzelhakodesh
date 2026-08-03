"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

/**
 * Compact account menu in the header. A small user icon opens a dropdown with
 * the signed-in name, a link to change the password, and sign-out. Replaces the
 * separate account link + sign-out button so the header stays on one row.
 */
export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={name}
        aria-label="תפריט משתמש"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="text-[10px] leading-none" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-[60] text-[var(--color-foreground)]">
          {name && (
            <div className="px-3 py-2 text-xs text-[var(--color-muted-foreground)] border-b border-[var(--color-border)] truncate">
              {name}
            </div>
          )}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
          >
            <span aria-hidden>🔑</span> החלפת סיסמה
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-[var(--color-muted)] transition-colors"
          >
            <span aria-hidden>⎋</span> יציאה
          </button>
        </div>
      )}
    </div>
  );
}
