"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveNedarimCreds,
  saveNedarimFormsPassword,
  saveMinStartId,
  syncTransactionsNow,
  addNedarimForm,
  removeNedarimForm,
  syncFormNow,
} from "./actions";

type FormRow = {
  id: string;
  tofesId: string;
  label: string;
  count: number;
  lastSync: string | null;
};

function formatSince(iso: string | null): string {
  if (!iso) return "לא סונכרן עדיין";
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function NedarimSettingsForm({
  mosadId: initialMosadId,
  hasApiPassword,
  hasFormsPassword,
  envMosadId,
  envApiPassword,
  envFormsPassword,
  lastTxSync,
  minStartId: initialMinStartId,
  txCount,
  forms,
}: {
  mosadId: string;
  hasApiPassword: boolean;
  hasFormsPassword: boolean;
  envMosadId: boolean;
  envApiPassword: boolean;
  envFormsPassword: boolean;
  lastTxSync: string | null;
  minStartId: string;
  txCount: number;
  forms: FormRow[];
}) {
  const router = useRouter();
  const [mosadId, setMosadId] = useState(initialMosadId);
  const [apiPassword, setApiPassword] = useState("");
  const [formsPassword, setFormsPassword] = useState("");
  const [minStartId, setMinStartId] = useState(initialMinStartId);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function saveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      try {
        await saveNedarimCreds(mosadId, apiPassword || "____keep____");
        // Only wipe the input when the user typed something new
        if (apiPassword && apiPassword !== "____keep____") setApiPassword("");
        setStatus({ tone: "ok", msg: "פרטי החיבור נשמרו" });
        router.refresh();
      } catch (err) {
        setStatus({
          tone: "err",
          msg: err instanceof Error ? err.message : "שגיאה בשמירה",
        });
      }
    });
  }

  function runTxSync() {
    setStatus(null);
    startTransition(async () => {
      try {
        const r = await syncTransactionsNow();
        setStatus({
          tone: "ok",
          msg: `סנכרון עסקאות: ${r.totalUpserted.toLocaleString("he-IL")} רשומות ב-${r.pages} עמודי משיכה`,
        });
        router.refresh();
      } catch (err) {
        setStatus({
          tone: "err",
          msg: err instanceof Error ? err.message : "שגיאת סנכרון",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {status && (
        <div
          className={
            "rounded-lg px-4 py-3 text-sm border " +
            (status.tone === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800")
          }
        >
          {status.msg}
        </div>
      )}

      <section className="bg-white rounded-xl card-shadow p-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
          פרטי חיבור — עסקאות
        </h2>
        {(envMosadId || envApiPassword) && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
            {envMosadId && envApiPassword
              ? "מזהה המוסד וסיסמת ה-API מוגדרים בקובץ .env — עריכה כאן לא תשפיע."
              : envMosadId
              ? "מזהה המוסד מוגדר בקובץ .env — עריכה כאן לא תשפיע."
              : "סיסמת ה-API מוגדרת בקובץ .env — עריכה כאן לא תשפיע."}
          </div>
        )}
        <form onSubmit={saveCredentials} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              מזהה מוסד (7 ספרות)
            </span>
            <input
              value={mosadId}
              onChange={(e) => setMosadId(e.target.value)}
              inputMode="numeric"
              maxLength={7}
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              סיסמת API לעסקאות {hasApiPassword && "(מוגדרת — השאר ריק לשמירה על הקיימת)"}
            </span>
            <input
              value={apiPassword}
              onChange={(e) => setApiPassword(e.target.value)}
              type="password"
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="px-5 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            שמור
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl card-shadow p-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-1">
          סיסמת API לטפסים
        </h2>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
          נדרים פלוס מנפיק סיסמת API נפרדת לטפסים. אם הסיסמאות זהות — אין
          צורך להזין כאן (המערכת תשתמש בסיסמת העסקאות למעלה).
        </p>
        {envFormsPassword && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
            סיסמת ה-API לטפסים מוגדרת בקובץ .env — עריכה כאן לא תשפיע.
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStatus(null);
            startTransition(async () => {
              try {
                await saveNedarimFormsPassword(formsPassword);
                setFormsPassword("");
                setStatus({ tone: "ok", msg: "סיסמת הטפסים נשמרה" });
                router.refresh();
              } catch (err) {
                setStatus({
                  tone: "err",
                  msg: err instanceof Error ? err.message : "שגיאה",
                });
              }
            });
          }}
          className="space-y-4 max-w-md"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              סיסמת API טפסים{" "}
              {hasFormsPassword && "(מוגדרת — הזן חדשה להחלפה)"}
            </span>
            <input
              value={formsPassword}
              onChange={(e) => setFormsPassword(e.target.value)}
              type="password"
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !formsPassword.trim()}
            className="px-5 h-10 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            שמור
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl card-shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-[var(--color-primary)]">
            היסטוריית עסקאות
          </h2>
          <button
            type="button"
            onClick={runTxSync}
            disabled={pending || !hasApiPassword}
            className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {pending ? "מסנכרן..." : "סנכרן עכשיו"}
          </button>
        </div>
        <div className="text-sm text-[var(--color-muted-foreground)] space-y-1">
          <div>
            במאגר: <b>{txCount.toLocaleString("he-IL")}</b> עסקאות
          </div>
          <div>סנכרון אחרון: {formatSince(lastTxSync)}</div>
        </div>

        <MinStartIdField
          initial={initialMinStartId}
          disabled={txCount > 0}
          onSave={async (v) => {
            await saveMinStartId(v);
            router.refresh();
          }}
        />

        <p className="text-xs text-[var(--color-muted-foreground)] mt-3">
          נדרים פלוס מגביל ל-20 קריאות בשעה. הסנכרון מושך רק עסקאות חדשות מאז
          הפעם הקודמת.
        </p>
      </section>

      <section className="bg-white rounded-xl card-shadow p-6">
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
          טפסים
        </h2>

        <AddFormRow />

        {forms.length === 0 ? (
          <div className="text-sm text-[var(--color-muted-foreground)] py-4">
            עדיין לא הוגדרו טפסים. הזן מזהה טופס ותווית לזיהוי.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {forms.map((f) => (
              <FormRowView key={f.id} form={f} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MinStartIdField({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await onSave(value.trim());
      setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 pt-4 border-t border-[var(--color-border)]">
      <label className="block text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          התחל מעסקה מספר (רק בסנכרון הראשון)
        </span>
        <div className="flex gap-2 mt-1 items-center">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder="לדוגמה: 2500000 = דלג על עסקאות ישנות עד מספר זה"
            inputMode="numeric"
            className="flex-1 h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm disabled:opacity-50 disabled:bg-[var(--color-muted)]"
          />
          <button
            type="submit"
            disabled={disabled || pending}
            className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {pending ? "..." : saved ? "נשמר ✓" : "שמור"}
          </button>
        </div>
      </label>
      <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
        {disabled
          ? "המאגר כבר מכיל עסקאות — הסנכרון ממשיך אוטומטית מהעסקה האחרונה שנשלפה."
          : "רלוונטי רק לסנכרון הראשון. השאר ריק כדי למשוך את כל ההיסטוריה. הזן מספר עסקה מנדרים כדי להתחיל ממנה והלאה."}
      </p>
    </form>
  );
}

function AddFormRow() {
  const router = useRouter();
  const [tofesId, setTofesId] = useState("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addNedarimForm(tofesId, label);
        setTofesId("");
        setLabel("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <form onSubmit={onAdd} className="flex gap-2 flex-wrap items-end">
      <label className="block flex-1 min-w-[140px]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          מזהה טופס
        </span>
        <input
          value={tofesId}
          onChange={(e) => setTofesId(e.target.value)}
          className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
        />
      </label>
      <label className="block flex-1 min-w-[140px]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          תווית לתצוגה
        </span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='למשל: "רישום לישיבה"'
          className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        + הוסף
      </button>
      {error && (
        <div className="text-xs text-red-700 basis-full">{error}</div>
      )}
    </form>
  );
}

function FormRowView({ form }: { form: FormRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runSync() {
    setError(null);
    startTransition(async () => {
      try {
        await syncFormNow(form.tofesId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function del() {
    if (!confirm(`למחוק את "${form.label}" ואת כל ${form.count} הרשומות שלו?`))
      return;
    startTransition(async () => {
      await removeNedarimForm(form.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="font-semibold text-[var(--color-primary)]">
          {form.label}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          מזהה: <span className="font-mono">{form.tofesId}</span> · במאגר:{" "}
          {form.count.toLocaleString("he-IL")} · סנכרון:{" "}
          {formatSince(form.lastSync)}
        </div>
        {error && <div className="text-xs text-red-700 mt-1">{error}</div>}
      </div>
      <button
        type="button"
        onClick={runSync}
        disabled={pending}
        className="px-3 h-8 rounded-md bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {pending ? "..." : "סנכרן"}
      </button>
      <button
        type="button"
        onClick={del}
        disabled={pending}
        className="px-3 h-8 rounded-md border border-red-300 text-red-700 text-xs hover:bg-red-50"
      >
        מחק
      </button>
    </div>
  );
}
