import { SECTIONS } from "@/lib/sections";

export type NavLink = {
  href: string;
  label: string;
  /** `null` marks a link everyone sees (the dashboard). */
  key: string | null;
  prefixes: string[];
};

/** Nav links derived from the section catalog, with the dashboard prepended. */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "דשבורד", key: null, prefixes: [] },
  ...SECTIONS.map((s) => ({
    href: s.href,
    label: s.label,
    key: s.key,
    prefixes: s.prefixes,
  })),
];

/** Is this link the one matching the current path? */
export function navIsActive(pathname: string, link: NavLink): boolean {
  if (link.key === null) return pathname === "/";
  return link.prefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/** The nav links a given role + section grant may see. Reps get none. */
export function visibleNavLinks(
  role?: string,
  sections: string[] = []
): NavLink[] {
  if (role === "rep") return [];
  const canSee = (key: string | null) =>
    key === null || role === "admin" || sections.includes(key);
  return NAV_LINKS.filter((l) => canSee(l.key));
}
