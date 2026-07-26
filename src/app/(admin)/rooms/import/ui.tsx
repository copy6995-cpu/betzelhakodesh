"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { importHistory } from "../actions";
import { weekLabel } from "@/lib/weeks";

export function ImportUI() {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    imported: number;
    perWeek: Array<{ weekKey: string; count: number }>;
    errors: string[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr("לא נבחר קובץ");
      return;
    }
    setErr(null);
    setResult(null);
    startTransition(async () => {
      try {
        const buffer = await file.arrayBuffer();
        const r = await importHistory(buffer);
        setResult(r);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <section className="bg-white rounded-xl card-shadow p-6">
      <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
        העלאת קובץ
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            קובץ Excel (.xlsx / .xls)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </label>

        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-800">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !file}
          className="px-5 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {pending ? "מייבא..." : "התחל ייבוא"}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-3">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            <b>הושלם!</b> {result.imported.toLocaleString("he-IL")} שיבוצים נכנסו
            למאגר.
          </div>

          {result.perWeek.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                שבועות שנטענו:
              </h3>
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-muted)]">
                    <tr>
                      <th className="py-1.5 px-3 text-right text-xs">שבוע</th>
                      <th className="py-1.5 px-3 text-center text-xs">שיבוצים</th>
                      <th className="py-1.5 px-3 text-left text-xs">קישור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.perWeek.map((w) => (
                      <tr key={w.weekKey} className="border-t border-[var(--color-border)]/50">
                        <td className="py-1.5 px-3 font-mono">{w.weekKey}</td>
                        <td className="py-1.5 px-3 text-center">{w.count}</td>
                        <td className="py-1.5 px-3 text-left text-xs">
                          <Link
                            href={`/rooms?week=${w.weekKey}`}
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {weekLabel(w.weekKey)} ←
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <details className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-yellow-800">
                {result.errors.length} שורות דולגו — לחץ להצגה
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-yellow-900">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
