"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  yeshivot: { name: string; count: number }[];
  totalCount: number;
};

export function YeshivaPillFilter({ yeshivot, totalCount }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("yeshiva") ?? "";

  function buildHref(name: string | null): string {
    const qp = new URLSearchParams(params.toString());
    if (name) qp.set("yeshiva", name);
    else qp.delete("yeshiva");
    qp.delete("page"); // reset paging on filter change
    const s = qp.toString();
    return s ? `${pathname}?${s}` : pathname;
  }

  const allActive = current === "";
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildHref(null)}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          allActive ? "pill-active" : "pill-idle"
        }`}
      >
        הכל
        <span className="text-xs opacity-75">({totalCount})</span>
      </Link>
      {yeshivot.map((y) => (
        <Link
          key={y.name}
          href={buildHref(y.name)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            current === y.name ? "pill-active" : "pill-idle"
          }`}
        >
          {y.name}
          <span className="text-xs opacity-75">({y.count})</span>
        </Link>
      ))}
    </div>
  );
}
