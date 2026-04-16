"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveYear } from "./actions";

export function SettingsYearForm({
  activeYear,
  availableYears,
}: {
  activeYear: string;
  availableYears: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(activeYear);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await setActiveYear(value.trim());
      setSaved(true);
      router.refresh();
    });
  }

  const suggestions = Array.from(new Set(["תשפ\"ו", "תשפ\"ז", "תשפ\"ח", ...availableYears]));

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          שנת לימודים
        </span>
        <input
          list="year-options"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full mt-1 h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
        <datalist id="year-options">
          {suggestions.map((y) => (
            <option key={y} value={y} />
          ))}
        </datalist>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {pending ? "שומר..." : saved ? "נשמר ✓" : "שמור שנה"}
      </button>
    </form>
  );
}
