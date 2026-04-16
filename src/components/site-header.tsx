import Link from "next/link";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { SignOutButton } from "./sign-out-button";
import { HeaderNav } from "./header-nav";
import { YearSwitcher } from "./year-switcher";

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
            <HeaderNav />
          </div>
          <div className="flex items-center gap-3">
            <YearSwitcher
              activeYear={activeYear}
              availableYears={availableYears}
            />
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
