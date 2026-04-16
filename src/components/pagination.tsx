import Link from "next/link";

export function Pagination({
  currentPage,
  totalPages,
  searchParams,
  basePath,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  function buildHref(page: number): string {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && typeof v === "string") qp.set(k, v);
    }
    qp.set("page", String(page));
    return `${basePath}?${qp.toString()}`;
  }

  const pagesToShow = new Set<number>();
  pagesToShow.add(1);
  pagesToShow.add(totalPages);
  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
    if (i >= 1 && i <= totalPages) pagesToShow.add(i);
  }
  const pages = [...pagesToShow].sort((a, b) => a - b);

  return (
    <nav className="flex items-center justify-center gap-1 mt-6">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-3 h-9 rounded-md border border-[var(--color-border)] bg-white text-sm hover:bg-[var(--color-muted)] flex items-center"
        >
          הקודם
        </Link>
      )}
      {pages.map((p, idx) => {
        const prev = pages[idx - 1];
        const showEllipsis = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center">
            {showEllipsis && <span className="px-2 text-[var(--color-muted-foreground)]">…</span>}
            <Link
              href={buildHref(p)}
              className={`px-3 h-9 rounded-md border text-sm flex items-center font-medium ${
                p === currentPage
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white border-[var(--color-border)] hover:bg-[var(--color-muted)]"
              }`}
            >
              {p}
            </Link>
          </span>
        );
      })}
      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-3 h-9 rounded-md border border-[var(--color-border)] bg-white text-sm hover:bg-[var(--color-muted)] flex items-center"
        >
          הבא
        </Link>
      )}
    </nav>
  );
}
