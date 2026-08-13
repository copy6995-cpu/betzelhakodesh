"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SECTIONS } from "@/lib/sections";

type L = { href: string; label: string; key: string | null; prefixes: string[] };

/** Nav links derived from the section catalog, with the dashboard prepended.
 *  `key: null` marks a link everyone sees (the dashboard). */
const LINKS: L[] = [
  { href: "/", label: "דשבורד", key: null, prefixes: [] },
  ...SECTIONS.map((s) => ({
    href: s.href,
    label: s.label,
    key: s.key,
    prefixes: s.prefixes,
  })),
];

function isActive(pathname: string, link: L): boolean {
  if (link.key === null) return pathname === "/";
  return link.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

const ITEM_CLS =
  "nav-link-gold whitespace-nowrap px-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors";
const GAP = 4; // matches gap-1

/**
 * Priority-plus navigation: shows as many links as fit on one line and folds
 * the rest into a "עוד ▾" dropdown. No wrapping, no scroll arrows — the bar
 * stays one clean row at any width, and every section stays reachable.
 */
export function HeaderNav({
  role,
  sections,
}: {
  role?: string;
  sections: string[];
}) {
  const pathname = usePathname();
  const canSee = (key: string | null) =>
    key === null || role === "admin" || sections.includes(key);
  // Reps have a single locked page and no section nav.
  const items = role === "rep" ? [] : LINKS.filter((l) => canSee(l.key));

  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [count, setCount] = useState(items.length);
  const [open, setOpen] = useState(false);

  const recalc = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const avail = wrap.clientWidth;
    const widths = items.map((_, i) => measureRefs.current[i]?.offsetWidth ?? 0);
    const totalAll =
      widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, items.length - 1);
    if (totalAll <= avail) {
      setCount(items.length);
      return;
    }
    const moreW = (moreMeasureRef.current?.offsetWidth ?? 64) + GAP;
    let used = moreW;
    let c = 0;
    for (let i = 0; i < items.length; i++) {
      used += widths[i] + GAP;
      if (used <= avail) c++;
      else break;
    }
    setCount(Math.max(0, c));
  }, [items]);

  useLayoutEffect(() => {
    recalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalc, pathname]);

  useEffect(() => {
    const ro = new ResizeObserver(recalc);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [recalc]);

  // Close the dropdown on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const inline = items.slice(0, count);
  const overflow = items.slice(count);
  const overflowActive = overflow.some((l) => isActive(pathname, l));

  return (
    <div
      ref={wrapRef}
      className="hidden md:flex items-center gap-1 min-w-0 flex-1 relative"
    >
      {/* Hidden measurement row — always all items, used to decide how many fit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[9999px] start-0 flex items-center gap-1 opacity-0"
      >
        {items.map((l, i) => (
          <span
            key={l.href}
            ref={(el) => {
              measureRefs.current[i] = el;
            }}
            className={ITEM_CLS}
          >
            {l.label}
          </span>
        ))}
        <span ref={moreMeasureRef} className={ITEM_CLS}>
          עוד ▾
        </span>
      </div>

      {inline.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          data-active={isActive(pathname, l)}
          className={ITEM_CLS + " shrink-0"}
        >
          {l.label}
        </Link>
      ))}

      {overflow.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            data-active={overflowActive}
            aria-haspopup="true"
            aria-expanded={open}
            className={ITEM_CLS + " inline-flex items-center gap-1 cursor-pointer"}
          >
            עוד
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute z-50 mt-2 end-0 min-w-[190px] rounded-xl border border-white/10 bg-[#0f2942] py-1.5 shadow-xl">
                {overflow.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    data-active={isActive(pathname, l)}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 data-[active=true]:text-white data-[active=true]:bg-white/10"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
