"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBox({ placeholder = "חיפוש..." }: { placeholder?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const qp = new URLSearchParams(params.toString());
    if (value.trim()) qp.set("q", value.trim());
    else qp.delete("q");
    qp.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${qp.toString()}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2 max-w-md">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
      />
      <button
        type="submit"
        className="px-5 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        חיפוש
      </button>
    </form>
  );
}
