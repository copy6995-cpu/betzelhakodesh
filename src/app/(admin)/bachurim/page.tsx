import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import {
  getExpiredEndDateLabels,
  activeEshelWhere,
  notActiveEshelWhere,
} from "@/lib/eshel";
import { formatILS, formatNum } from "@/lib/utils";
import { YeshivaPillFilter } from "@/components/yeshiva-pill-filter";
import { SearchBox } from "@/components/search-box";
import { Pagination } from "@/components/pagination";
import { tokenSearchWhere } from "@/lib/search";
import { AdvancedFilters } from "./advanced-filters";

export const dynamic = "force-dynamic";

type SortKey =
  | "name"
  | "yeshiva"
  | "shiur"
  | "city"
  | "price"
  | "paid"
  | "balance"
  | "endDate";

const PAGE_SIZE = 200;

type StatusFilter =
  | "all"
  | "no-hook"
  | "no-eshel"
  | "unattached"
  | "hook"
  | "eshel"
  | "eshel-hook"
  | "eshel-no-hook";

type SearchParams = {
  yeshiva?: string;
  q?: string;
  page?: string;
  status?: StatusFilter;
  shiur?: string;
  ariChul?: string;
  endDate?: string;
  balance?: "positive" | "zero" | "negative" | "";
  sort?: SortKey;
  dir?: "asc" | "desc";
};

/** Build the Prisma where clause for a status filter. "unattached" is the
 *  broad "no hook AND no eshel" bucket. "eshel-hook" / "eshel-no-hook"
 *  split the registered-eshel population by whether they also have a
 *  Nedarim hook attached. `expired` are the season labels whose end date has
 *  passed — a booked bachur in one of those no longer counts as registered. */
function statusWhere(
  status: StatusFilter | undefined,
  expired: string[]
): Record<string, unknown> {
  const active = activeEshelWhere(expired);
  const notActive = notActiveEshelWhere(expired);
  const hasHook = { NOT: [{ nedarimHook: null }, { nedarimHook: "" }] };
  const noHook = { OR: [{ nedarimHook: null }, { nedarimHook: "" }] };
  switch (status) {
    case "no-hook":
      return noHook;
    case "no-eshel":
      return notActive;
    case "unattached":
      return { AND: [noHook, notActive] };
    case "hook":
      return hasHook;
    case "eshel":
      return active;
    case "eshel-hook":
      return { AND: [active, hasHook] };
    case "eshel-no-hook":
      return { AND: [active, noHook] };
    default:
      return {};
  }
}

/** Human label + short slug for a status. The slug is the URL-safe piece
 *  we put in exported filenames so files are self-describing. */
export const STATUS_META: Record<
  StatusFilter,
  { label: string; slug: string }
> = {
  all: { label: "כל הבחורים", slug: "all" },
  "no-hook": { label: "ללא הוק", slug: "no-hook" },
  "no-eshel": { label: 'ללא רישום אש"ל', slug: "no-eshel" },
  unattached: { label: "לא משוייך", slug: "unattached" },
  hook: { label: "עם הוק", slug: "hook" },
  eshel: { label: 'רישום אש"ל', slug: "eshel" },
  "eshel-hook": { label: 'רישום + הוק', slug: "eshel-hook" },
  "eshel-no-hook": { label: 'רישום ללא הוק', slug: "eshel-no-hook" },
};

export default async function BachurimPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const year = await getActiveYear();
  const expired = await getExpiredEndDateLabels(year);
  const yeshiva = sp.yeshiva;
  const q = sp.q?.trim();
  const status = (sp.status ?? "all") as StatusFilter;
  const shiur = sp.shiur?.trim();
  const ariChul = sp.ariChul?.trim();
  const endDate = sp.endDate?.trim();
  const balance = sp.balance ?? "";
  const sortKey = (sp.sort ?? "name") as SortKey;
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // statusWhere can itself contain an `OR` (the active-אש"ל branch), and so
  // can the search — combine them as separate AND entries so neither `OR`
  // key clobbers the other. The advanced filters (shiur / ariChul / endDate)
  // are plain column matches.
  const where = {
    year,
    archived: false,
    ...(yeshiva ? { yeshiva } : {}),
    ...(shiur ? { shiur } : {}),
    ...(ariChul ? { ariChul } : {}),
    ...(endDate ? { endDateLabel: endDate } : {}),
    AND: [
      statusWhere(status, expired),
      ...(q
        ? [
            tokenSearchWhere(q, [
              "firstName",
              "lastName",
              "fatherName",
              "personalCode",
              "nedarimHook",
            ])!,
          ]
        : []),
    ],
  };

  // Same base scope as the yeshiva pills — the counts on the status pills
  // should follow the current yeshiva filter (so switching yeshiva narrows
  // the "unattached" count to that yeshiva), but ignore the status filter
  // itself (else the pill for the active option would just show its own
  // count).
  const baseWhereWithoutStatus = {
    year,
    archived: false,
    ...(yeshiva ? { yeshiva } : {}),
  };

  const [
    matching,
    paidGroups,
    yeshivaGroups,
    totalInYear,
    statusCounts,
    shiurRows,
    endDateRows,
  ] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fatherName: true,
        personalCode: true,
        yeshiva: true,
        shiur: true,
        city: true,
        price: true,
        endDateLabel: true,
        frozen: true,
      },
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: { student: where },
      _sum: { amount: true },
    }),
    prisma.student.groupBy({
      by: ["yeshiva"],
      where: { year, archived: false },
      _count: { _all: true },
      orderBy: { yeshiva: "asc" },
    }),
    prisma.student.count({ where: { year, archived: false } }),
    Promise.all([
      prisma.student.count({ where: baseWhereWithoutStatus }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("no-hook", expired) },
      }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("no-eshel", expired) },
      }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("unattached", expired) },
      }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("eshel-hook", expired) },
      }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("eshel-no-hook", expired) },
      }),
      prisma.student.count({
        where: { ...baseWhereWithoutStatus, ...statusWhere("eshel", expired) },
      }),
    ]).then(([all, noHook, noEshel, unattached, eshelHook, eshelNoHook, eshel]) => ({
      all,
      noHook,
      noEshel,
      unattached,
      eshelHook,
      eshelNoHook,
      eshel,
    })),
    prisma.shiur.findMany({
      orderBy: { displayOrder: "asc" },
      select: { name: true },
    }),
    prisma.endDateOption.findMany({
      where: { year },
      orderBy: { label: "asc" },
      select: { label: true },
    }),
  ]);

  const paidById = new Map(
    paidGroups.map((g) => [g.studentId, Number(g._sum.amount ?? 0)])
  );
  type RowT = (typeof matching)[number] & {
    paid: number;
    priceN: number;
    balance: number;
  };
  let rows: RowT[] = matching.map((s) => {
    const priceN = s.price ?? 0;
    const paid = paidById.get(s.id) ?? 0;
    return { ...s, paid, priceN, balance: priceN - paid };
  });

  // Balance filter — יתרה = מחיר − שולם (this year only; debts are separate).
  if (balance === "positive") rows = rows.filter((r) => r.balance > 0);
  else if (balance === "zero") rows = rows.filter((r) => r.balance === 0);
  else if (balance === "negative") rows = rows.filter((r) => r.balance < 0);

  const he = (a: string | null, b: string | null) =>
    (a ?? "").localeCompare(b ?? "", "he");
  const byName = (a: RowT, b: RowT) =>
    he(a.lastName, b.lastName) || he(a.firstName, b.firstName);
  rows.sort((a, b) => {
    let v: number;
    switch (sortKey) {
      case "yeshiva": v = he(a.yeshiva, b.yeshiva); break;
      case "shiur": v = he(a.shiur, b.shiur); break;
      case "city": v = he(a.city, b.city); break;
      case "price": v = a.priceN - b.priceN; break;
      case "paid": v = a.paid - b.paid; break;
      case "balance": v = a.balance - b.balance; break;
      case "endDate": v = he(a.endDateLabel, b.endDateLabel); break;
      default: v = byName(a, b);
    }
    if (v === 0 && sortKey !== "name") v = byName(a, b);
    return dir === "desc" ? -v : v;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const shiurim = shiurRows.map((s) => s.name);
  const endDateLabels = endDateRows.map((e) => e.label);

  // Preserve the current filters when building sort-header links.
  const sortHref = (col: SortKey) => {
    const p = new URLSearchParams();
    const keep: [string, string | undefined][] = [
      ["yeshiva", yeshiva],
      ["q", q],
      ["status", status === "all" ? undefined : status],
      ["shiur", shiur],
      ["ariChul", ariChul],
      ["endDate", endDate],
      ["balance", balance || undefined],
    ];
    for (const [k, val] of keep) if (val) p.set(k, val);
    const nextDir = sortKey === col && dir === "asc" ? "desc" : "asc";
    p.set("sort", col);
    p.set("dir", nextDir);
    return `/bachurim?${p.toString()}`;
  };
  const sortArrow = (col: SortKey) =>
    sortKey === col ? (dir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">בחורים</h1>
        <p className="text-[var(--color-muted-foreground)] mt-1">
          {formatNum(total)} בחורים {yeshiva ? `ב-${yeshiva}` : "בכל הישיבות"}
          {q && ` התואמים "${q}"`}
        </p>
      </div>

      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
          ישיבה
        </div>
        <YeshivaPillFilter
          yeshivot={yeshivaGroups.map((g) => ({
            name: g.yeshiva,
            count: g._count._all,
          }))}
          totalCount={totalInYear}
        />
      </div>

      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
          שיוך
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "הכל", count: statusCounts.all },
              {
                key: "eshel",
                label: "רשומים",
                count: statusCounts.eshel,
              },
              {
                key: "eshel-hook",
                label: "רישום + הוק",
                count: statusCounts.eshelHook,
              },
              {
                key: "eshel-no-hook",
                label: "רישום ללא הוק",
                count: statusCounts.eshelNoHook,
              },
              {
                key: "no-hook",
                label: "ללא הוק",
                count: statusCounts.noHook,
              },
              {
                key: "no-eshel",
                label: 'ללא רישום אש"ל',
                count: statusCounts.noEshel,
              },
              {
                key: "unattached",
                label: "לא משוייך (ללא הוק וללא אשל)",
                count: statusCounts.unattached,
              },
            ] as const
          ).map((opt) => {
            const active = status === opt.key || (opt.key === "all" && status === "all");
            const params = new URLSearchParams();
            if (yeshiva) params.set("yeshiva", yeshiva);
            if (q) params.set("q", q);
            if (opt.key !== "all") params.set("status", opt.key);
            if (shiur) params.set("shiur", shiur);
            if (ariChul) params.set("ariChul", ariChul);
            if (endDate) params.set("endDate", endDate);
            if (balance) params.set("balance", balance);
            const href = `/bachurim${params.toString() ? `?${params}` : ""}`;
            return (
              <Link
                key={opt.key}
                href={href}
                className={
                  "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
                  (active ? "pill-active" : "pill-idle")
                }
              >
                {opt.label}
                <span className="ms-1.5 text-xs opacity-70">
                  ({formatNum(opt.count)})
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          חיפוש
        </div>
        <div className="flex items-center gap-2">
          <a
            href={(() => {
              const params = new URLSearchParams();
              if (yeshiva) params.set("yeshiva", yeshiva);
              if (q) params.set("q", q);
              if (status !== "all") params.set("status", status);
              if (shiur) params.set("shiur", shiur);
              if (ariChul) params.set("ariChul", ariChul);
              if (endDate) params.set("endDate", endDate);
              if (balance) params.set("balance", balance);
              return `/api/bachurim/export${
                params.toString() ? `?${params}` : ""
              }`;
            })()}
            className="inline-flex items-center px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors"
          >
            ↓ יצוא לפי ישיבה
          </a>
          <Link
            href="/bachurim/new"
            className="inline-flex items-center px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            + בחור חדש
          </Link>
        </div>
      </div>
      <div className="mb-4">
        <SearchBox placeholder="שם, קוד אישי, מספר הוק..." />
      </div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
          סינון מתקדם
        </div>
        <AdvancedFilters shiurim={shiurim} endDateLabels={endDateLabels} />
      </div>

      <div className="bg-white rounded-xl card-shadow">
        <div className="px-5 py-3 border-b border-[var(--color-border)] rounded-t-xl">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {formatNum(total)} בחורים
          </div>
        </div>
        {/* No overflow-x wrapper on desktop — per CSS spec overflow-x:auto
            forces overflow-y to auto, which would capture our sticky <th>s.
            On mobile a global rule (.card-shadow table) makes the table itself
            scroll horizontally instead, so the page never shifts sideways. */}
        <div>
          <table className="w-full text-sm">
            <thead>
              {/* Sticky applied per-<th> (not on <thead>/<tr>) — that's the
                  pattern with the widest browser support. Each th keeps its
                  own opaque bg so the data rows scroll under it cleanly. */}
              <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="sticky top-16 z-20 py-3 pe-5 ps-5 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("name")} className="hover:text-[var(--color-accent)]">
                    שם מלא{sortArrow("name")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">קוד אישי</th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("yeshiva")} className="hover:text-[var(--color-accent)]">
                    ישיבה{sortArrow("yeshiva")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("shiur")} className="hover:text-[var(--color-accent)]">
                    שיעור{sortArrow("shiur")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("city")} className="hover:text-[var(--color-accent)]">
                    עיר{sortArrow("city")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("price")} className="hover:text-[var(--color-accent)]">
                    מחיר{sortArrow("price")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("paid")} className="hover:text-[var(--color-accent)]">
                    שולם{sortArrow("paid")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("balance")} className="hover:text-[var(--color-accent)]">
                    יתרה{sortArrow("balance")}
                  </Link>
                </th>
                <th className="sticky top-16 z-20 py-3 px-4 font-semibold bg-[var(--color-muted)]">
                  <Link href={sortHref("endDate")} className="hover:text-[var(--color-accent)]">
                    תאריך סיום{sortArrow("endDate")}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]/60">
                  <td className="py-2.5 pe-5 ps-5">
                    <Link
                      href={`/bachurim/${r.id}`}
                      className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                    >
                      {r.lastName} {r.firstName}
                    </Link>
                    {r.frozen && (
                      <span className="ms-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 align-middle">
                        מוקפא
                      </span>
                    )}
                    <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      {r.fatherName && `בן ${r.fatherName}`}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[var(--color-muted-foreground)]">
                    {r.personalCode}
                  </td>
                  <td className="py-2.5 px-4">{r.yeshiva}</td>
                  <td className="py-2.5 px-4 text-center">{r.shiur ?? "—"}</td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                    {r.city ?? "—"}
                  </td>
                  <td className="py-2.5 px-4">{formatILS(r.priceN)}</td>
                  <td className="py-2.5 px-4 text-[var(--color-success)]">
                    {formatILS(r.paid)}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-semibold ${
                      r.balance > 0
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-success)]"
                    }`}
                  >
                    {formatILS(r.balance)}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">
                    {r.endDateLabel ?? "—"}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-[var(--color-muted-foreground)]"
                  >
                    לא נמצאו בחורים התואמים לסינון.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={sp as Record<string, string>}
        basePath="/bachurim"
      />
    </div>
  );
}
