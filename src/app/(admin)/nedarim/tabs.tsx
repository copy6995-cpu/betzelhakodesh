"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/nedarim/transactions", label: "עסקאות" },
  { href: "/nedarim/hoks", label: "הוראות קבע" },
  { href: "/nedarim/forms", label: "טפסים" },
];

export function NedarimTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors " +
              (active ? "pill-active" : "pill-idle")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
