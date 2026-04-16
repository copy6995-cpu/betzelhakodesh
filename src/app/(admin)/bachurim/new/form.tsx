"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudent } from "../actions";

export function NewBachurForm({
  yeshivot,
  shiurim,
}: {
  yeshivot: string[];
  shiurim: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    fatherName: "",
    city: "",
    yeshiva: yeshivot[0] ?? "",
    shiur: "",
    ariChul: "ארי",
    price: null as number | null,
    paymentMethod: "",
    paymentsCount: null as number | null,
    nedarimHook: "",
    endDateLabel: "",
    registeredEshel: false,
    notes: "",
    parent: { firstName: "", lastName: "", tz: "", phone: "", email: "" },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // default parent last name to student's last name if empty
    const payload = {
      ...f,
      parent: {
        ...f.parent,
        firstName: f.parent.firstName || f.fatherName,
        lastName: f.parent.lastName || f.lastName,
      },
    };
    startTransition(async () => {
      try {
        const id = await createStudent(payload);
        router.push(`/bachurim/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white rounded-xl card-shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-primary)]">פרטי התלמיד</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <L label="שם פרטי" required>
            <I value={f.firstName} onChange={(v) => setF({ ...f, firstName: v })} />
          </L>
          <L label="שם משפחה" required>
            <I value={f.lastName} onChange={(v) => setF({ ...f, lastName: v })} />
          </L>
          <L label="שם האב">
            <I value={f.fatherName} onChange={(v) => setF({ ...f, fatherName: v })} />
          </L>
          <L label="עיר">
            <I value={f.city} onChange={(v) => setF({ ...f, city: v })} />
          </L>
          <L label="ישיבה" required>
            <S value={f.yeshiva} onChange={(v) => setF({ ...f, yeshiva: v })} options={yeshivot} />
          </L>
          <L label="שיעור">
            <S value={f.shiur} onChange={(v) => setF({ ...f, shiur: v })} options={["", ...shiurim]} />
          </L>
          <L label='אר"י/חו"ל'>
            <S value={f.ariChul} onChange={(v) => setF({ ...f, ariChul: v })} options={["ארי", "חול"]} />
          </L>
          <L label="מחיר (₪)">
            <I
              type="number"
              value={f.price?.toString() ?? ""}
              onChange={(v) => setF({ ...f, price: v ? parseInt(v, 10) : null })}
            />
          </L>
        </div>
      </section>

      <section className="bg-white rounded-xl card-shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-primary)]">פרטי ההורה</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          אם שם האב ושם המשפחה כבר קיימים במערכת, ההורה יופע בנפרד. ניתן לחבר ידנית בכרטסת ההורה.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <L label="שם פרטי (הורה)">
            <I value={f.parent.firstName} onChange={(v) => setF({ ...f, parent: { ...f.parent, firstName: v } })} />
          </L>
          <L label="שם משפחה (הורה)">
            <I value={f.parent.lastName} onChange={(v) => setF({ ...f, parent: { ...f.parent, lastName: v } })} />
          </L>
          <L label="טלפון">
            <I value={f.parent.phone} onChange={(v) => setF({ ...f, parent: { ...f.parent, phone: v } })} />
          </L>
          <L label="אימייל">
            <I type="email" value={f.parent.email} onChange={(v) => setF({ ...f, parent: { ...f.parent, email: v } })} />
          </L>
        </div>
      </section>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 h-10 rounded-lg border border-[var(--color-border)] bg-white text-sm font-medium hover:bg-[var(--color-muted)]"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60"
        >
          {pending ? "שומר..." : "הוסף בחור"}
        </button>
      </div>
    </form>
  );
}

function L({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function I({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
    />
  );
}
function S({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o || "—"}
        </option>
      ))}
    </select>
  );
}
