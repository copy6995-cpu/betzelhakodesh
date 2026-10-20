"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Advanced filter bar for the bachurim list — combines with the yeshiva/status
 * pills and the text search. Each control just rewrites the URL searchParams
 * (resetting the page), so the server re-filters.
 */
export function AdvancedFilters({
  shiurim,
  endDateLabels,
}: {
  shiurim: string[];
  endDateLabels: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }
  const val = (k: string) => sp.get(k) ?? "";

  const anyActive =
    val("shiur") || val("ariChul") || val("endDate") || val("balance");

  function clearAll() {
    const p = new URLSearchParams(sp.toString());
    ["shiur", "ariChul", "endDate", "balance", "page"].forEach((k) => p.delete(k));
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="שיעור">
        <Select value={val("shiur")} onChange={(v) => setParam("shiur", v)}>
          <option value="">הכל</option>
          {shiurim.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label='אר"י/חו"ל'>
        <Select value={val("ariChul")} onChange={(v) => setParam("ariChul", v)}>
          <option value="">הכל</option>
          <option value="ארי">ארי</option>
          <option value="חול">חול</option>
        </Select>
      </Field>
      <Field label="תאריך סיום">
        <Select value={val("endDate")} onChange={(v) => setParam("endDate", v)}>
          <option value="">הכל</option>
          {endDateLabels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="יתרה">
        <Select value={val("balance")} onChange={(v) => setParam("balance", v)}>
          <option value="">הכל</option>
          <option value="positive">יתרה לתשלום (מעל 0)</option>
          <option value="zero">שולם במלואו (0)</option>
          <option value="negative">תשלום יתר (מתחת 0)</option>
        </Select>
      </Field>
      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
        >
          נקה סינון
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
    >
      {children}
    </select>
  );
}
