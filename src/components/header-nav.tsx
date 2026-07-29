"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "דשבורד", match: (p: string) => p === "/" },
  { href: "/bachurim", label: "בחורים", match: (p: string) => p.startsWith("/bachurim") },
  { href: "/parents", label: "הורים", match: (p: string) => p.startsWith("/parents") },
  { href: "/payments", label: "תשלומים", match: (p: string) => p.startsWith("/payments") },
  { href: "/nedarim/transactions", label: "נדרים פלוס", match: (p: string) => p.startsWith("/nedarim") },
  { href: "/yemot/beds", label: "מיטות", match: (p: string) => p.startsWith("/yemot/beds") },
  { href: "/yemot/credit-cards", label: "רישום שנתי ימות המשיח", match: (p: string) => p.startsWith("/yemot/credit-cards") },
  { href: "/rooms", label: "חדרים", match: (p: string) => p.startsWith("/rooms") },
  { href: "/registrations", label: "רישומים", match: (p: string) => p.startsWith("/registrations") },
  { href: "/calendar", label: "לוח שנה", match: (p: string) => p.startsWith("/calendar") },
  { href: "/settings", label: "הגדרות", match: (p: string) => p.startsWith("/settings") },
];

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV_LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            data-active={active}
            className="nav-link-gold px-3 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
