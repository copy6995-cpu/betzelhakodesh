import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { getActiveYear } from "@/lib/year";
import { Pagination } from "@/components/pagination";
import { NedarimTabs } from "../tabs";
import { AttachButton } from "./attach-button";
import { SyncFormButton } from "./sync-form";
import { EditKodCell } from "./edit-kod-cell";
import { DeleteRowButton } from "./delete-row-button";
import { NoteCell } from "./note-cell";

/** Fields whose values are editable from the table inline. `Kod_1` fixes
 *  student-code typos in submitted forms so the attach step can find them.
 *  `TransactionId` (הוק) is editable ONLY when empty — see the table render;
 *  we never want an accidental overwrite of a real hook value. */
const EDITABLE_FIELDS = new Set(["Kod_1", "TransactionId"]);
const EDITABLE_WHEN_EMPTY = new Set(["TransactionId"]);

/**
 * Fixed column layout — matches the Excel export in `src/lib/forms-export.ts`
 * so the site table and the downloaded file line up 1:1. Raw Nedarim JSON
 * keys are opaque ("Kod_1", "Snif1"...) so we rename to Hebrew labels the
 * office team reads directly.
 */
const DISPLAY_COLUMNS: Array<{ label: string; key: string }> = [
  { label: "קוד הבחור", key: "Kod_1" },
  { label: "מס' הוק", key: "TransactionId" },
  { label: "שם הבחור", key: "fullName1" },
  { label: "שם משפחה", key: "Family" },
  { label: "שם האב", key: "Father_Name" },
  { label: "עיר", key: "CityName" },
  { label: "שיעור", key: "Class_1" },
  { label: "ישיבה", key: "Yeshiva_1" },
  { label: "שנה", key: "Snif1" },
  { label: "עד מתי", key: "Time_1" },
  { label: "מי רשם", key: "Rishum" },
  { label: "הערות", key: "Notes" },
];

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

type StatFilter =
  | "all"
  | "hook"
  | "eshel"
  | "unmatched"
  | "no-code"
  | "no-hook"
  | "duplicates"
  | "with-notes";

type SearchParams = {
  tofes?: string;
  page?: string;
  snif?: string;
  stat?: StatFilter;
};

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const forms = await prisma.nedarimFormConfig.findMany({
    orderBy: { order: "asc" },
  });

  const selected = sp.tofes ?? forms[0]?.tofesId ?? null;
  const currentForm = forms.find((f) => f.tofesId === selected);

  const activeYear = await getActiveYear();
  const statFilter: StatFilter = (sp.stat ?? "all") as StatFilter;

  // The user-provided year filter, or default to the active school year
  // (so viewing תשפ״ז shows only that year's submissions, hiding the
  // תשפ״ו rows from the same form). Passing snif=all shows everything.
  const snifParam = sp.snif;
  const defaultSnif =
    activeYear || currentForm?.label?.trim() || "";
  const activeSnif =
    snifParam === "all"
      ? "all"
      : snifParam !== undefined
      ? snifParam.trim()
      : defaultSnif;

  const [allSubs, attachStats] = selected
    ? await Promise.all([
        // Load raw + rowId + submittedAt for every submission in this form —
        // needed for the Snif1 breakdown and in-memory filtering. Only the
        // paginated slice sends its full `raw` down to the JSX below.
        prisma.nedarimFormSubmission.findMany({
          where: { tofesId: selected },
          orderBy: { submittedAt: "desc" },
          select: { id: true, rowId: true, submittedAt: true, raw: true },
        }),
        computeAttachStats(selected, activeSnif === "all" ? null : activeSnif),
      ])
    : [[] as Array<{
        id: string;
        rowId: string;
        submittedAt: Date | null;
        raw: string;
      }>, null];

  // Compute the set of Snif1 values present, so we can build the pill row.
  const snifCounts = new Map<string, number>();
  for (const s of allSubs) {
    try {
      const o = JSON.parse(s.raw);
      const v = String(o.Snif1 ?? "").trim() || "(ללא Snif1)";
      snifCounts.set(v, (snifCounts.get(v) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  const snifOptions = [...snifCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  const snifFiltered =
    activeSnif === "all"
      ? allSubs
      : allSubs.filter((s) => {
          try {
            const o = JSON.parse(s.raw);
            const v = String(o.Snif1 ?? "").trim() || "(ללא Snif1)";
            return v === activeSnif;
          } catch {
            return false;
          }
        });

  // Attachment-state filter (clickable stat cards). For each submission we
  // need to know: does the student for (year=Snif1, code=Kod_1) exist?
  // Have they got a hook? Are they registered for eshel? Load exactly the
  // students that show up in the snif-filtered payload, once.
  type SubMeta = { s: (typeof allSubs)[number]; year: string; code: string };
  const subMetas: SubMeta[] = [];
  for (const s of snifFiltered) {
    try {
      const o = JSON.parse(s.raw);
      const code = String(o.Kod_1 ?? "").trim();
      const y = String(o.Snif1 ?? "").trim() || currentForm?.label?.trim() || activeYear;
      subMetas.push({ s, year: y, code });
    } catch {
      subMetas.push({ s, year: "", code: "" });
    }
  }
  // How many submissions share each (year, code) — >1 = duplicate.
  const bucketCounts = new Map<string, number>();
  for (const m of subMetas) {
    if (!m.code) continue;
    const key = `${m.year}|${m.code}`;
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  // Submissions with an empty `TransactionId` — needed both for the filter
  // AND for gating inline-edit on the הוק column (only edit when empty).
  const noTransactionIds = new Set<string>();
  // Submissions with a non-empty `Notes` — for the "עם הערות" tracking card.
  const withNotesIds = new Set<string>();
  for (const meta of subMetas) {
    try {
      const o = JSON.parse(meta.s.raw);
      const tx = String(o.TransactionId ?? "").trim();
      if (!tx) noTransactionIds.add(meta.s.id);
      const notes = String(o.Notes ?? "").trim();
      if (notes) withNotesIds.add(meta.s.id);
    } catch {
      /* ignore */
    }
  }
  // Submissions safe to delete = only those that live in a bucket of size
  // >= 2. Once a duplicate is removed the survivor is unique and its
  // delete button vanishes — that's the guard the user asked for.
  const duplicateIds = new Set<string>();
  for (const m of subMetas) {
    if (!m.code) continue;
    if ((bucketCounts.get(`${m.year}|${m.code}`) ?? 0) > 1) {
      duplicateIds.add(m.s.id);
    }
  }

  const uniqueYears = [...new Set(subMetas.map((m) => m.year).filter(Boolean))];
  const uniqueCodes = [...new Set(subMetas.map((m) => m.code).filter(Boolean))];
  const students =
    statFilter !== "all" && uniqueCodes.length > 0
      ? await prisma.student.findMany({
          where: {
            year: { in: uniqueYears },
            personalCode: { in: uniqueCodes },
          },
          select: {
            year: true,
            personalCode: true,
            nedarimHook: true,
            registeredEshel: true,
          },
        })
      : [];
  const studentByYearCode = new Map(
    students.map((s) => [`${s.year}|${s.personalCode}`, s])
  );

  const filtered = subMetas
    .filter((meta) => {
      const { year, code, s } = meta;
      if (statFilter === "all") return true;
      if (statFilter === "no-code") return !code;
      if (statFilter === "no-hook") return noTransactionIds.has(s.id);
      if (statFilter === "with-notes") return withNotesIds.has(s.id);
      if (statFilter === "duplicates") {
        if (!code) return false;
        return (bucketCounts.get(`${year}|${code}`) ?? 0) > 1;
      }
      // Everything else expects a real code.
      if (!code) return false;
      const st = studentByYearCode.get(`${year}|${code}`);
      switch (statFilter) {
        case "unmatched":
          return !st;
        case "hook":
          return !!st?.nedarimHook;
        case "eshel":
          return !!st?.registeredEshel;
        default:
          return true;
      }
    })
    .map((m) => m.s);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const submissions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/settings/nedarim" className="hover:underline">
              נדרים פלוס
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
            טפסים
          </h1>
          {selected && (
            <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
              {formatNum(total)} רשומות · טופס{" "}
              <span className="font-mono">{selected}</span>
              {currentForm && ` · ${currentForm.label}`}
            </p>
          )}
        </div>
        {selected && (
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
              <a
                href={(() => {
                  const qp = new URLSearchParams();
                  qp.set("tofes", selected);
                  // Use the RESOLVED snif (defaults to activeYear when the
                  // URL has no explicit ?snif=) so exports match what the
                  // user sees.
                  if (activeSnif && activeSnif !== "all")
                    qp.set("snif", activeSnif);
                  if (sp.stat && sp.stat !== "all") qp.set("stat", sp.stat);
                  return `/api/nedarim/forms/export?${qp.toString()}`;
                })()}
                className="px-4 h-10 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)] flex items-center"
              >
                ↓ יצוא לאקסל
              </a>
              <SyncFormButton tofesId={selected} />
            </div>
            <AttachButton tofesId={selected} />
          </div>
        )}
      </div>

      <NedarimTabs />

      {forms.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-8 text-center">
          <p className="text-[var(--color-muted-foreground)]">
            עדיין לא הוגדרו טפסים לסנכרון.
          </p>
          <Link
            href="/settings/nedarim"
            className="mt-3 inline-block text-[var(--color-accent)] hover:underline"
          >
            הוסף טופס בהגדרות ←
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {forms.map((f) => (
              <Link
                key={f.id}
                href={`/nedarim/forms?tofes=${f.tofesId}`}
                className={
                  "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors " +
                  (f.tofesId === selected ? "pill-active" : "pill-idle")
                }
              >
                {f.label}
              </Link>
            ))}
          </div>

          {snifOptions.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
                שנה (Snif1 בהגשה)
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/nedarim/forms?tofes=${selected}&snif=all`}
                  className={
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors " +
                    (activeSnif === "all" ? "pill-active" : "pill-idle")
                  }
                >
                  הכל
                  <span className="ms-1.5 opacity-70">
                    ({formatNum(allSubs.length)})
                  </span>
                </Link>
                {snifOptions.map(([year, count]) => (
                  <Link
                    key={year}
                    href={`/nedarim/forms?tofes=${selected}&snif=${encodeURIComponent(year)}`}
                    className={
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors " +
                      (activeSnif === year ? "pill-active" : "pill-idle")
                    }
                  >
                    {year}
                    <span className="ms-1.5 opacity-70">
                      ({formatNum(count)})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {attachStats && (
            <>
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <StatCard
                  label="טפסים בסה״כ"
                  value={attachStats.formTotal}
                  href={buildStatHref(sp, "all")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"all") : undefined
                  }
                  active={statFilter === "all"}
                />
                <StatCard
                  label="הוק משוייך"
                  value={attachStats.hookMatched}
                  subtitle={`מתוך ${attachStats.candidateStudents} תלמידים`}
                  tone={attachStats.hookMatched > 0 ? "ok" : "muted"}
                  href={buildStatHref(sp, "hook")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"hook") : undefined
                  }
                  active={statFilter === "hook"}
                />
                <StatCard
                  label="רשומים באש״ל"
                  value={attachStats.eshelYes}
                  subtitle={`מתוך ${attachStats.candidateStudents} תלמידים`}
                  tone={attachStats.eshelYes > 0 ? "ok" : "muted"}
                  href={buildStatHref(sp, "eshel")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"eshel") : undefined
                  }
                  active={statFilter === "eshel"}
                />
                <StatCard
                  label="כפולים"
                  value={attachStats.duplicateCount}
                  subtitle="הגשות נוספות על תלמיד"
                  tone={attachStats.duplicateCount > 0 ? "warn" : "muted"}
                  href={buildStatHref(sp, "duplicates")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"duplicates") : undefined
                  }
                  active={statFilter === "duplicates"}
                />
                <StatCard
                  label="ללא התאמה"
                  value={attachStats.unmatchedCodes}
                  subtitle="קוד לא מזוהה במאגר"
                  tone={attachStats.unmatchedCodes > 0 ? "warn" : "muted"}
                  href={buildStatHref(sp, "unmatched")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"unmatched") : undefined
                  }
                  active={statFilter === "unmatched"}
                />
                <StatCard
                  label="ללא קוד"
                  value={attachStats.noCodeCount}
                  subtitle="Kod_1 ריק בטופס"
                  tone={attachStats.noCodeCount > 0 ? "warn" : "muted"}
                  href={buildStatHref(sp, "no-code")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"no-code") : undefined
                  }
                  active={statFilter === "no-code"}
                />
                <StatCard
                  label="ללא הוק"
                  value={attachStats.noHookCount}
                  subtitle="מס' הוק ריק בטופס"
                  tone={attachStats.noHookCount > 0 ? "warn" : "muted"}
                  href={buildStatHref(sp, "no-hook")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected,"no-hook") : undefined
                  }
                  active={statFilter === "no-hook"}
                />
                <StatCard
                  label="עם הערות"
                  value={attachStats.withNotesCount}
                  subtitle="הערות/בקשות מיוחדות"
                  tone={attachStats.withNotesCount > 0 ? "warn" : "muted"}
                  href={buildStatHref(sp, "with-notes")}
                  exportHref={
                    selected ? buildStatExportHref(activeSnif, selected, "with-notes") : undefined
                  }
                  active={statFilter === "with-notes"}
                />
              </div>
              {attachStats.perYear.length > 1 && (
                <div className="bg-white rounded-xl card-shadow p-4 mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
                    פירוק לפי שנה (מתוך Snif1 בכל הגשה)
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-[var(--color-muted-foreground)]">
                        <th className="pb-2 font-semibold">שנה</th>
                        <th className="pb-2 font-semibold text-center">
                          הגשות
                        </th>
                        <th className="pb-2 font-semibold text-center">
                          נמצאו
                        </th>
                        <th className="pb-2 font-semibold text-center">
                          הוק
                        </th>
                        <th className="pb-2 font-semibold text-center">
                          אשל
                        </th>
                        <th className="pb-2 font-semibold text-center">
                          לא נמצאו
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attachStats.perYear.map((y) => (
                        <tr
                          key={y.year}
                          className="border-t border-[var(--color-border)]/40"
                        >
                          <td className="py-2 font-semibold text-[var(--color-primary)]">
                            {y.year}
                          </td>
                          <td className="py-2 text-center">{formatNum(y.submissions)}</td>
                          <td className="py-2 text-center">
                            {formatNum(y.foundInYear)}
                          </td>
                          <td className="py-2 text-center">
                            {formatNum(y.hookMatched)}
                          </td>
                          <td className="py-2 text-center">
                            {formatNum(y.eshelYes)}
                          </td>
                          <td
                            className={
                              "py-2 text-center " +
                              (y.notFound > 0 ? "text-amber-700" : "")
                            }
                          >
                            {y.notFound > 0 ? formatNum(y.notFound) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="bg-white rounded-xl card-shadow">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)]">
                <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <th className="py-3 pe-5 ps-5 font-semibold whitespace-nowrap">
                    תאריך
                  </th>
                  {DISPLAY_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="py-3 px-4 font-semibold whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-semibold w-8"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  let obj: Record<string, unknown> = {};
                  try {
                    obj = JSON.parse(s.raw);
                  } catch {
                    /* ignore */
                  }
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-[var(--color-border)]/60"
                    >
                      <td className="py-2.5 pe-5 ps-5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                        {s.submittedAt
                          ? s.submittedAt.toLocaleDateString("he-IL")
                          : "—"}
                      </td>
                      {DISPLAY_COLUMNS.map((col) => {
                        const rawVal = obj[col.key];
                        const strVal =
                          rawVal === null || rawVal === undefined
                            ? ""
                            : String(rawVal);
                        const editable =
                          EDITABLE_FIELDS.has(col.key) &&
                          // Empty-only fields (הוק) only expose the pencil
                          // when the value is empty — protects real hooks
                          // from an accidental overwrite in the table.
                          (!EDITABLE_WHEN_EMPTY.has(col.key) || !strVal.trim());
                        return (
                          <td key={col.key} className="py-2.5 px-4 text-sm align-top">
                            {editable ? (
                              <EditKodCell
                                submissionId={s.id}
                                field={col.key}
                                value={strVal}
                              />
                            ) : col.key === "Notes" ? (
                              // Client cell — hover shows the full text as
                              // tooltip; click expands it inline.
                              <NoteCell value={strVal} />
                            ) : strVal === "" ? (
                              "—"
                            ) : strVal.length > 60 ? (
                              strVal.slice(0, 60) + "…"
                            ) : (
                              strVal
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-4 text-center">
                        {duplicateIds.has(s.id) ? (
                          <DeleteRowButton
                            submissionId={s.id}
                            label={s.rowId}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {submissions.length === 0 && (
                  <tr>
                    <td
                      colSpan={2 + DISPLAY_COLUMNS.length}
                      className="py-10 text-center text-[var(--color-muted-foreground)]"
                    >
                      אין רשומות בטופס זה עדיין.{" "}
                      <Link
                        href="/settings/nedarim"
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        סנכרן
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={sp as Record<string, string>}
            basePath="/nedarim/forms"
          />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  tone = "default",
  href,
  exportHref,
  active = false,
}: {
  label: string;
  value: number;
  subtitle?: string;
  tone?: "default" | "ok" | "warn" | "muted";
  href?: string;
  exportHref?: string;
  active?: boolean;
}) {
  const bg =
    tone === "ok"
      ? "bg-green-50 border-green-200"
      : tone === "warn"
      ? "bg-yellow-50 border-yellow-200"
      : tone === "muted"
      ? "bg-white border-[var(--color-border)] opacity-70"
      : "bg-white border-[var(--color-border)]";
  const activeCls = active
    ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-background,white)]"
    : "";
  const clickable = href ? "cursor-pointer hover:shadow-md transition-shadow" : "";
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className="text-2xl font-bold text-[var(--color-primary)] mt-1">
        {formatNum(value)}
      </div>
      {subtitle && (
        <div className="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">
          {subtitle}
        </div>
      )}
    </>
  );
  const cls = `relative rounded-xl border p-3 ${bg} ${activeCls} ${clickable}`;
  // Download icon in the corner is a separate <a> — sibling of the card
  // <Link>, not nested inside it, so clicking the icon downloads the
  // Excel instead of navigating to the filter view. No event handler
  // needed (this file is a Server Component).
  const downloadIcon =
    exportHref && value > 0 ? (
      <a
        href={exportHref}
        title="יצוא לאקסל"
        className="absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] hover:bg-white text-sm z-10"
      >
        ↓
      </a>
    ) : null;
  if (href) {
    // Wrapper is the grid item — it must fill the whole cell. `block h-full`
    // on the Link keeps the card box the same size as before (before the
    // wrapper was introduced, the Link itself was the grid item, and grid
    // auto-stretched its inline default; wrapping demoted it back to
    // content-width until we forced block+full height here).
    return (
      <div className="relative h-full">
        <Link href={href} className={cls + " block h-full"}>
          {inner}
        </Link>
        {downloadIcon}
      </div>
    );
  }
  return (
    <div className={cls}>
      {inner}
      {downloadIcon}
    </div>
  );
}

/** Build a link that preserves tofes/snif but changes the `stat` filter
 *  (and drops the page number so we don't land past the last page of the
 *  new filter). */
function buildStatHref(
  sp: SearchParams,
  stat: StatFilter
): string {
  const qp = new URLSearchParams();
  if (sp.tofes) qp.set("tofes", sp.tofes);
  if (sp.snif) qp.set("snif", sp.snif);
  if (stat !== "all") qp.set("stat", stat);
  const q = qp.toString();
  return `/nedarim/forms${q ? `?${q}` : ""}`;
}

/** Same params as buildStatHref but pointing at the Excel export endpoint.
 *  Takes the RESOLVED activeSnif so exports respect the default year even
 *  when the URL has no explicit `?snif=` param (otherwise duplicates
 *  export gets both years). */
function buildStatExportHref(
  activeSnif: string,
  tofesId: string,
  stat: StatFilter
): string {
  const qp = new URLSearchParams();
  qp.set("tofes", tofesId);
  if (activeSnif && activeSnif !== "all") qp.set("snif", activeSnif);
  if (stat !== "all") qp.set("stat", stat);
  return `/api/nedarim/forms/export?${qp.toString()}`;
}

/** Stats for the header cards + per-year breakdown table. Reads each
 *  submission's Snif1 field (Nedarim stores the school year there — a
 *  single form can be reused across years) and joins to Student on the
 *  exact (year, personalCode) tuple that submission belongs to.
 *  Passing `onlyYear` restricts every count/breakdown row to that year
 *  (used to filter תשפ״ז stats away from תשפ״ו noise). */
async function computeAttachStats(
  tofesId: string,
  onlyYear: string | null
): Promise<{
  formTotal: number;
  candidateStudents: number;
  hookMatched: number;
  eshelYes: number;
  unmatchedCodes: number;
  noCodeCount: number;
  noHookCount: number;
  withNotesCount: number;
  duplicateCount: number;
  perYear: Array<{
    year: string;
    submissions: number;
    foundInYear: number;
    hookMatched: number;
    eshelYes: number;
    notFound: number;
  }>;
}> {
  const [rows, config] = await Promise.all([
    prisma.nedarimFormSubmission.findMany({
      where: { tofesId },
      select: { raw: true },
    }),
    prisma.nedarimFormConfig.findUnique({ where: { tofesId } }),
  ]);
  const cfgYear = (config?.label ?? "").trim();

  // Group submissions by (year, code) — the year is Snif1 per row, falling
  // back to the form config label. Also collect the flat code list.
  // bucketSubs[key] counts submissions per (year, code) so we can identify
  // duplicates (the same student sending the form more than once).
  type Bucket = { code: string; year: string };
  const buckets = new Map<string, Bucket>();
  const bucketSubs = new Map<string, number>();
  const perYearSubs = new Map<string, number>();
  let noCodeCount = 0;
  let noHookCount = 0;
  let withNotesCount = 0;
  for (const r of rows) {
    try {
      const o = JSON.parse(r.raw);
      const code = String(o.Kod_1 ?? "").trim();
      const tx = String(o.TransactionId ?? "").trim();
      const notes = String(o.Notes ?? "").trim();
      const y = String(o.Snif1 ?? "").trim() || cfgYear || "(ללא שנה)";
      if (onlyYear && y !== onlyYear) continue;
      if (!tx) noHookCount++;
      if (notes) withNotesCount++;
      if (!code) {
        noCodeCount++;
        continue;
      }
      perYearSubs.set(y, (perYearSubs.get(y) ?? 0) + 1);
      const key = `${y}|${code}`;
      buckets.set(key, { code, year: y });
      bucketSubs.set(key, (bucketSubs.get(key) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  // Duplicate submissions = anything beyond the first per bucket.
  let duplicateCount = 0;
  for (const n of bucketSubs.values()) if (n > 1) duplicateCount += n - 1;

  if (buckets.size === 0) {
    return {
      formTotal: rows.length,
      candidateStudents: 0,
      hookMatched: 0,
      eshelYes: 0,
      unmatchedCodes: 0,
      noCodeCount,
      noHookCount,
      withNotesCount,
      duplicateCount,
      perYear: [],
    };
  }

  const uniqueYears = [...new Set([...buckets.values()].map((b) => b.year))];
  const uniqueCodes = [...new Set([...buckets.values()].map((b) => b.code))];
  const students = await prisma.student.findMany({
    where: {
      year: { in: uniqueYears },
      personalCode: { in: uniqueCodes },
    },
    select: {
      personalCode: true,
      year: true,
      nedarimHook: true,
      registeredEshel: true,
    },
  });
  const byYearCode = new Map<string, (typeof students)[number]>();
  for (const s of students) byYearCode.set(`${s.year}|${s.personalCode}`, s);

  let hookMatched = 0;
  let eshelYes = 0;
  let unmatched = 0;
  const perYear = new Map<
    string,
    { foundInYear: number; hookMatched: number; eshelYes: number; notFound: number }
  >();
  for (const b of buckets.values()) {
    const s = byYearCode.get(`${b.year}|${b.code}`);
    const bucket = perYear.get(b.year) ?? {
      foundInYear: 0,
      hookMatched: 0,
      eshelYes: 0,
      notFound: 0,
    };
    if (!s) {
      unmatched++;
      bucket.notFound++;
    } else {
      bucket.foundInYear++;
      if (s.nedarimHook) {
        hookMatched++;
        bucket.hookMatched++;
      }
      if (s.registeredEshel) {
        eshelYes++;
        bucket.eshelYes++;
      }
    }
    perYear.set(b.year, bucket);
  }

  const perYearRows = [...perYearSubs.entries()]
    .map(([year, submissions]) => {
      const p = perYear.get(year) ?? {
        foundInYear: 0,
        hookMatched: 0,
        eshelYes: 0,
        notFound: 0,
      };
      return { year, submissions, ...p };
    })
    .sort((a, b) => b.submissions - a.submissions);

  const formTotal = onlyYear
    ? perYearRows.reduce((n, r) => n + r.submissions, 0) + noCodeCount
    : rows.length;

  return {
    formTotal,
    candidateStudents: buckets.size,
    hookMatched,
    eshelYes,
    unmatchedCodes: unmatched,
    noCodeCount,
    noHookCount,
    withNotesCount,
    duplicateCount,
    perYear: perYearRows,
  };
}
