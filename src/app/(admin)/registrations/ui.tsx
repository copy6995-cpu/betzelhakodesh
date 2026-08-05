"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegistrationsUI({
  from: initialFrom,
  to: initialTo,
  year,
  counts,
  totalRows,
  noYemotData,
}: {
  from: string;
  to: string;
  year: string;
  counts: Array<{ yeshiva: string; count: number }>;
  totalRows: number;
  noYemotData: boolean;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [suffix, setSuffix] = useState("");

  function apply() {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    router.push(`/registrations?${qs.toString()}`);
  }

  const downloadCombined =
    `/api/registrations/export?from=${encodeURIComponent(
      from
    )}&to=${encodeURIComponent(to)}` +
    (suffix ? `&suffix=${encodeURIComponent(suffix)}` : "");

  function downloadOne(yeshiva: string) {
    return downloadCombined + `&yeshiva=${encodeURIComponent(yeshiva)}`;
  }

  const isoDT = (x: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(
      x.getHours()
    )}:${p(x.getMinutes())}`;
  };
  const dayStart = (x: Date) => {
    const d = new Date(x);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  function setThisWeek() {
    const t = new Date();
    const d = dayStart(t);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    setFrom(isoDT(d));
    setTo(isoDT(t));
  }

  function setLastDays(n: number) {
    const t = new Date();
    const d = dayStart(t);
    d.setDate(d.getDate() - (n - 1));
    setFrom(isoDT(d));
    setTo(isoDT(t));
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl card-shadow p-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
          פרמטרים
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              מתאריך
            </span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              עד תאריך
            </span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              סיומת שם קובץ (אופציונלי)
            </span>
            <input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="למשל: אייר"
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={setThisWeek}
            className="px-3 h-8 rounded-md border border-[var(--color-border)] text-xs hover:bg-[var(--color-muted)]"
          >
            השבוע (מיום ראשון)
          </button>
          <button
            type="button"
            onClick={() => setLastDays(7)}
            className="px-3 h-8 rounded-md border border-[var(--color-border)] text-xs hover:bg-[var(--color-muted)]"
          >
            7 ימים אחרונים
          </button>
          <button
            type="button"
            onClick={() => setLastDays(30)}
            className="px-3 h-8 rounded-md border border-[var(--color-border)] text-xs hover:bg-[var(--color-muted)]"
          >
            30 ימים אחרונים
          </button>
          <span className="ms-auto text-xs text-[var(--color-muted-foreground)]">
            שיוך לישיבות לפי שנת <b>{year}</b>
          </span>
          <button
            type="button"
            onClick={apply}
            className="px-4 h-9 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            החל
          </button>
        </div>
      </section>

      {noYemotData ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm">
          <p className="mb-2">
            אין הזמנות מיטה במאגר.
          </p>
          <Link
            href="/settings/yemot"
            className="text-[var(--color-accent)] hover:underline"
          >
            הגדר טוקן וסנכרן ימות המשיח ←
          </Link>
        </div>
      ) : (
        <section className="bg-white rounded-xl card-shadow p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                {totalRows.toLocaleString("he-IL")} רשומים בטווח
              </h2>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                מיום {from.replace("T", " ")} עד {to.replace("T", " ")} · מקור:
                ימות המשיח (סטטוס &quot;מאושר&quot;)
              </p>
            </div>
            {totalRows > 0 && (
              <a
                href={downloadCombined}
                className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] flex items-center"
                download
              >
                📥 הורד קובץ מאוחד (גיליון לכל ישיבה)
              </a>
            )}
          </div>

          {counts.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)] py-6 text-center">
              אין הזמנות מאושרות בטווח התאריכים.
            </p>
          ) : (
            <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]">
                  <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="py-2 pe-5 ps-5 font-semibold">ישיבה</th>
                    <th className="py-2 px-4 font-semibold text-center">
                      רשומים
                    </th>
                    <th className="py-2 px-4 font-semibold text-left">קובץ</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => {
                    const suffixTag = suffix
                      ? suffix.startsWith("_")
                        ? suffix
                        : "_" + suffix
                      : "";
                    return (
                      <tr
                        key={c.yeshiva}
                        className="border-t border-[var(--color-border)]/60"
                      >
                        <td className="py-2.5 pe-5 ps-5 font-medium">
                          {c.yeshiva}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold">
                          {c.count.toLocaleString("he-IL")}
                        </td>
                        <td className="py-2.5 px-4 text-left">
                          <a
                            href={downloadOne(c.yeshiva)}
                            className="text-[var(--color-accent)] hover:underline text-xs"
                            download
                          >
                            📥 {c.yeshiva}
                            {suffixTag}.xlsx
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
