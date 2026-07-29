/**
 * Download link for the beds matrix — carries the page's current filters
 * (year scope, date range, "booked but not registered") to the export route
 * so the file matches exactly what's on screen.
 */
export function BedsExportButton({
  year,
  scope,
  filter,
  from,
  to,
}: {
  year?: string;
  scope: string;
  filter: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (scope === "all") params.set("scope", "all");
  if (filter) params.set("filter", filter);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const href = `/api/yemot/beds/export${qs ? `?${qs}` : ""}`;

  return (
    <a
      href={href}
      className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
    >
      ↓ יצוא
    </a>
  );
}
