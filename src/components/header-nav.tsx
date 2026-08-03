"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "@/lib/sections";

/** Nav links derived from the section catalog, with the dashboard prepended.
 *  `key: null` marks a link everyone sees (the dashboard). */
const LINKS: { href: string; label: string; key: string | null; prefixes: string[] }[] = [
  { href: "/", label: "דשבורד", key: null, prefixes: [] },
  ...SECTIONS.map((s) => ({
    href: s.href,
    label: s.label,
    key: s.key,
    prefixes: s.prefixes,
  })),
];

function isActive(pathname: string, link: (typeof LINKS)[number]): boolean {
  if (link.key === null) return pathname === "/";
  return link.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

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

  return (
    <nav className="hidden md:flex items-center gap-1">
      {LINKS.filter((l) => canSee(l.key)).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          data-active={isActive(pathname, l)}
          className="nav-link-gold shrink-0 whitespace-nowrap px-3 text-sm font-medium text-white/80 hover:text-white transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
