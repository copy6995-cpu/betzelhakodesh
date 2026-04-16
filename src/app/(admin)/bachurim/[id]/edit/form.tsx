"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudent } from "../../actions";

type StudentFields = {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  city: string;
  yeshiva: string;
  shiur: string;
  ariChul: string;
  price: number | null;
  paymentMethod: string;
  paymentsCount: number | null;
  nedarimHook: string;
  endDateLabel: string;
  registeredEshel: boolean;
  notes: string;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    tz: string;
    phone: string;
    email: string;
  };
};

export function BachurEditForm({
  student,
  yeshivot,
  shiurim,
}: {
  student: StudentFields;
  yeshivot: string[];
  shiurim: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState(student);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof StudentFields>(k: K, v: StudentFields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }
  function setParent<K extends keyof StudentFields["parent"]>(
    k: K,
    v: StudentFields["parent"][K]
  ) {
    setF((prev) => ({ ...prev, parent: { ...prev.parent, [k]: v } }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateStudent(f);
        router.push(`/bachurim/${f.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בשמירה");
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

      <Section title="פרטי התלמיד">
        <Grid>
          <Field label="שם פרטי" required>
            <Input value={f.firstName} onChange={(v) => set("firstName", v)} />
          </Field>
          <Field label="שם משפחה" required>
            <Input value={f.lastName} onChange={(v) => set("lastName", v)} />
          </Field>
          <Field label="שם האב">
            <Input value={f.fatherName} onChange={(v) => set("fatherName", v)} />
          </Field>
          <Field label="עיר">
            <Input value={f.city} onChange={(v) => set("city", v)} />
          </Field>
          <Field label="ישיבה" required>
            <Select value={f.yeshiva} onChange={(v) => set("yeshiva", v)} options={yeshivot} />
          </Field>
          <Field label="שיעור">
            <Select value={f.shiur} onChange={(v) => set("shiur", v)} options={["", ...shiurim]} />
          </Field>
          <Field label='אר"י/חו"ל'>
            <Select value={f.ariChul} onChange={(v) => set("ariChul", v)} options={["", "ארי", "חול"]} />
          </Field>
          <Field label="רשום באש״ל">
            <Select
              value={f.registeredEshel ? "כן" : "לא"}
              onChange={(v) => set("registeredEshel", v === "כן")}
              options={["לא", "כן"]}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="תשלום">
        <Grid>
          <Field label="מחיר (₪)">
            <Input
              type="number"
              value={f.price?.toString() ?? ""}
              onChange={(v) => set("price", v ? parseInt(v, 10) : null)}
            />
          </Field>
          <Field label="אמצעי תשלום">
            <Select
              value={f.paymentMethod}
              onChange={(v) => set("paymentMethod", v)}
              options={["", "אשראי", "העברות", "צ'יק", "נדרים פלוס", "אחר"]}
            />
          </Field>
          <Field label="מספר תשלומים">
            <Input
              type="number"
              value={f.paymentsCount?.toString() ?? ""}
              onChange={(v) => set("paymentsCount", v ? parseInt(v, 10) : null)}
            />
          </Field>
          <Field label="מספר הוק בנדרים">
            <Input value={f.nedarimHook} onChange={(v) => set("nedarimHook", v)} />
          </Field>
          <Field label="תאריך סיום">
            <Input value={f.endDateLabel} onChange={(v) => set("endDateLabel", v)} />
          </Field>
        </Grid>
      </Section>

      <Section title="פרטי ההורה">
        <Grid>
          <Field label="שם פרטי (הורה)">
            <Input
              value={f.parent.firstName}
              onChange={(v) => setParent("firstName", v)}
            />
          </Field>
          <Field label="שם משפחה (הורה)">
            <Input
              value={f.parent.lastName}
              onChange={(v) => setParent("lastName", v)}
            />
          </Field>
          <Field label="ת.ז.">
            <Input value={f.parent.tz} onChange={(v) => setParent("tz", v)} />
          </Field>
          <Field label="טלפון">
            <Input value={f.parent.phone} onChange={(v) => setParent("phone", v)} />
          </Field>
          <Field label="אימייל">
            <Input
              type="email"
              value={f.parent.email}
              onChange={(v) => setParent("email", v)}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="הערות">
        <textarea
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
        />
      </Section>

      <div className="flex gap-3 justify-end pt-2">
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
          className="px-5 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60"
        >
          {pending ? "שומר..." : "שמור"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl card-shadow p-6">
      <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
function Input({
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
      className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
    />
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
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
