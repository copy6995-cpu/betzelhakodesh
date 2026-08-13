/**
 * Single source of truth for the app's "sections" (מדורים) and which URL paths
 * belong to each. Used by the header nav (what to show), the edge proxy /
 * `authorized` callback (what to block), and the user-management UI (which
 * toggles to offer).
 *
 * IMPORTANT: this file must stay edge-safe — pure data + string ops, no Node
 * APIs, no Prisma, no bcrypt — because `authConfig` (and thus `proxy.ts`, which
 * runs on the Edge runtime) imports it.
 */

export type Section = {
  key: string;
  label: string;
  /** Primary nav destination. */
  href: string;
  /** Path prefixes owned by this section (pages + their export/API routes). */
  prefixes: string[];
};

/** Access-controllable sections, in nav order. The dashboard ("/") is always
 *  available to any signed-in user, so it is not listed here. */
export const SECTIONS: Section[] = [
  { key: "bachurim", label: "בחורים", href: "/bachurim", prefixes: ["/bachurim", "/api/bachurim"] },
  { key: "parents", label: "הורים", href: "/parents", prefixes: ["/parents", "/api/parents"] },
  { key: "payments", label: "תשלומים", href: "/payments", prefixes: ["/payments"] },
  { key: "finance", label: "הכנסות והוצאות", href: "/finance", prefixes: ["/finance"] },
  { key: "nedarim", label: "נדרים פלוס", href: "/nedarim/transactions", prefixes: ["/nedarim", "/api/nedarim"] },
  { key: "beds", label: "מיטות", href: "/yemot/beds", prefixes: ["/yemot/beds", "/api/yemot/beds"] },
  { key: "credit-cards", label: "רישום שנתי ימות המשיח", href: "/yemot/credit-cards", prefixes: ["/yemot/credit-cards"] },
  { key: "rooms", label: "חדרים", href: "/rooms", prefixes: ["/rooms", "/api/rooms"] },
  { key: "registrations", label: "רישומים", href: "/registrations", prefixes: ["/registrations", "/api/registrations"] },
  { key: "calendar", label: "לוח שנה", href: "/calendar", prefixes: ["/calendar", "/api/calendar"] },
  { key: "tornut", label: "תורנות", href: "/tornut", prefixes: ["/tornut"] },
  { key: "settings", label: "הגדרות", href: "/settings", prefixes: ["/settings", "/api/import"] },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

/** True if the path is inside the given section-owned prefix. */
function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Which section a path belongs to, or null if it maps to none. */
export function sectionForPath(pathname: string): Section | null {
  for (const s of SECTIONS) {
    if (s.prefixes.some((p) => underPrefix(pathname, p))) return s;
  }
  return null;
}

/** Parse the stored JSON sections string into a clean key list. */
export function parseSections(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((k): k is string => typeof k === "string" && SECTION_KEYS.includes(k));
  } catch {
    return [];
  }
}

/** The single page a "rep" login lands on and is confined to. */
export function repHome(
  repId: string | undefined | null,
  repKind: string | undefined | null
): string {
  if (repKind === "chul" && repId) return `/finance/chul/${repId}`;
  if (repKind === "yeshiva") return "/tornut";
  return "/";
}

/** May a rep (role "rep") open this path? Locked to their own page only. */
export function repCanAccess(
  pathname: string,
  repId: string | undefined | null,
  repKind: string | undefined | null
): boolean {
  if (!repId) return false;
  if (repKind === "chul") {
    return (
      pathname === `/finance/chul/${repId}` ||
      pathname.startsWith(`/finance/chul/${repId}/`)
    );
  }
  if (repKind === "yeshiva") {
    return underPrefix(pathname, "/tornut");
  }
  return false;
}

/**
 * Can a user with this role + section list open this path? Admins can open
 * everything; a "rep" is locked to their own page; the dashboard is open to
 * regular users; user-management is admin-only; every other path is gated by
 * its owning section.
 */
export function canAccessPath(
  role: string | undefined,
  sections: string[],
  pathname: string,
  repId?: string | null,
  repKind?: string | null
): boolean {
  if (role === "admin") return true;
  if (role === "rep") return repCanAccess(pathname, repId, repKind);
  // User management is admins-only regardless of the "settings" grant.
  if (underPrefix(pathname, "/settings/users")) return false;
  if (pathname === "/") return true;
  const sec = sectionForPath(pathname);
  if (!sec) return true; // unmapped internal path — page-level guards apply
  return sections.includes(sec.key);
}
