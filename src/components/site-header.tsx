import Link from "next/link";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { SignOutButton } from "./sign-out-button";

const NAV_LINKS = [
  { href: "/", label: "דשבורד" },
  { href: "/bachurim", label: "בחורים" },
  { href: "/parents", label: "הורים" },
  { href: "/payments", label: "תשלומים" },
  { href: "/settings", label: "הגדרות" },
];

export async function SiteHeader() {
  const [activeYear, availableYears] = await Promise.all([
    getActiveYear(),
    getAvailableYears(),
  ]);
  return (
    <header className="header-navy text-white sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">בצ</span>
              </div>
              <span className="text-lg font-semibold tracking-tight">
                בצל הקודש
              </span>
            </Link>
            <nav className="hidden md:flex gap-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-md"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/75">
              <span>שנה פעילה:</span>
              <span className="font-semibold text-white">{activeYear}</span>
              {availableYears.length > 1 && (
                <span className="text-white/50 text-xs">
                  ({availableYears.length} שנים במערכת)
                </span>
              )}
            </div>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
