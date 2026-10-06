"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navIsActive, visibleNavLinks } from "@/lib/nav-links";

/**
 * Mobile navigation — a hamburger button (shown only below md, where the
 * desktop priority-plus nav is hidden) that opens a slide-down panel listing
 * every section the user may see. Closes on navigation, backdrop tap, or Escape.
 */
export function MobileNav({
  role,
  sections,
}: {
  role?: string;
  sections: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = visibleNavLinks(role, sections);

  // Close on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="תפריט"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          {open ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav className="fixed inset-x-0 top-16 z-50 bg-[#0f2942] border-t border-white/10 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="py-2">
              {items.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  data-active={navIsActive(pathname, l)}
                  onClick={() => setOpen(false)}
                  className="block px-6 py-3 text-base text-white/80 hover:text-white hover:bg-white/10 data-[active=true]:text-white data-[active=true]:bg-white/10 border-b border-white/5"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
