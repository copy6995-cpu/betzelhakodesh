"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateParent } from "../actions";

type Parent = {
  id: string;
  firstName: string;
  lastName: string;
  tz: string;
  phone: string;
  email: string;
  city: string;
  notes: string;
};

export function ParentEditForm({ parent }: { parent: Parent }) {
  const router = useRouter();
  const [f, setF] = useState(parent);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateParent(f);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl card-shadow p-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-1">
        פרטי הורה
      </h2>
      <F label="שם פרטי">
        <I value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
      </F>
      <F label="שם משפחה">
        <I value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
      </F>
      <F label="ת.ז.">
        <I value={f.tz} onChange={(v) => setF({ ...f, tz: v })} />
      </F>
      <F label="טלפון">
        <I value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
      </F>
      <F label="אימייל">
        <I type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
      </F>
      <F label="עיר">
        <I value={f.city} onChange={(v) => setF({ ...f, city: v })} />
      </F>
      <F label="הערות">
        <textarea
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </F>
      <button
        type="submit"
        disabled={pending}
        className="w-full mt-2 px-4 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {pending ? "שומר..." : saved ? "נשמר ✓" : "שמור"}
      </button>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function I({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
    />
  );
}
