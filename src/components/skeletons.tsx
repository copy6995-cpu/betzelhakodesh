/**
 * Lightweight loading skeletons shown instantly on navigation via each route's
 * loading.tsx. They mirror the real page's container width and rough layout so
 * the transition feels immediate and nothing jumps when the data arrives.
 * Pure presentational — no data, no client hooks — using Tailwind's animate-pulse.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-muted)] ${className}`} />;
}

/** Page title block (big line + subtitle). */
export function TitleSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Bar className="h-8 w-48" />
      <Bar className="h-4 w-72 opacity-70" />
    </div>
  );
}

/** A row of rounded "pills" (filters). */
export function PillsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <Bar key={i} className="h-8 w-24 rounded-full" />
      ))}
    </div>
  );
}

/** A card-shadow table block with header strip + N rows. */
export function TableSkeleton({
  rows = 10,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <Bar className="h-4 w-32" />
      </div>
      <div className="divide-y divide-[var(--color-border)]/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Bar
                key={c}
                className={`h-4 ${c === 0 ? "w-40" : "flex-1"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A grid of small square-ish chips (rooms, calendar cells). */
export function GridSkeleton({
  sections = 3,
  perSection = 12,
}: {
  sections?: number;
  perSection?: number;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="bg-white rounded-xl card-shadow p-5">
          <Bar className="h-5 w-40 mb-4" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: perSection }).map((_, i) => (
              <Bar key={i} className="h-12 w-[72px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A grid of summary cards. */
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl card-shadow p-5 space-y-3">
          <Bar className="h-4 w-24 opacity-70" />
          <Bar className="h-7 w-32" />
          <Bar className="h-3 w-full opacity-60" />
        </div>
      ))}
    </div>
  );
}

/** Full-page wrapper matching the admin page container. */
export function PageSkeletonShell({
  width = "max-w-[1400px]",
  children,
}: {
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${width} mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse`}
      aria-hidden
    >
      {children}
    </div>
  );
}
