import Link from "next/link";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { auth } from "@/lib/auth";
import { UserMenu } from "./user-menu";
import { HeaderNav } from "./header-nav";
import { YearSwitcher } from "./year-switcher";

export async function SiteHeader() {
  const [activeYear, availableYears, session] = await Promise.all([
    getActiveYear(),
    getAvailableYears(),
    auth(),
  ]);
  const sessionUser = session?.user as
    | { role?: string; sections?: string[]; name?: string | null; email?: string | null }
    | undefined;
  const role = sessionUser?.role;
  const sections = sessionUser?.sections ?? [];
  const displayName = sessionUser?.name || sessionUser?.email || "";
  return (
    <header className="header-navy text-white sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-8 min-w-0 flex-1">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">בצ</span>
              </div>
              <span className="text-lg font-semibold tracking-tight">
                בצל הקודש
              </span>
            </Link>
            <HeaderNav role={role} sections={sections} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {role !== "rep" && (
              <YearSwitcher
                activeYear={activeYear}
                availableYears={availableYears}
              />
            )}
            {sessionUser && <UserMenu name={displayName} />}
          </div>
        </div>
      </div>
    </header>
  );
}
