"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveYemotToken,
  addYemotSource,
  removeYemotSource,
  toggleYemotSourceCurrent,
  syncYemotFull,
  syncYemotLatest,
  syncYemotCreditCards,
} from "./actions";

type SourceRow = {
  id: string;
  path: string;
  current: boolean;
  label: string;
};

type DefaultSource = { path: string; label: string; current: boolean };

function formatSince(iso: string | null): string {
  if (!iso) return "לא סונכרן עדיין";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function YemotSettingsForm({
  hasToken,
  envToken,
  lastSync,
  sources,
  reservationCount,
  weeksCount,
  defaultSources,
}: {
  hasToken: boolean;
  envToken: boolean;
  lastSync: string | null;
  sources: SourceRow[];
  reservationCount: number;
  weeksCount: number;
  defaultSources: DefaultSource[];
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function saveTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!token.trim()) {
      setStatus({ tone: "err", msg: "הזן טוקן" });
      return;
    }
    startTransition(async () => {
      try {
        await saveYemotToken(token);
        setToken("");
        setStatus({ tone: "ok", msg: "הטוקן נשמר" });
        router.refresh();
      } catch (err) {
        setStatus({
          tone: "err",
          msg: err instanceof Error ? err.message : "שגיאה",
        });
      }
    });
  }

  function runFull() {
    setStatus(null);
    startTransition(async () => {
      const r = await syncYemotFull();
      if (!r.ok) {
        setStatus({ tone: "err", msg: r.error });
        return;
      }
      setStatus({
        tone: "ok",
        msg: `סנכרון מלא: ${r.inserted.toLocaleString("he-IL")} רשומות מ-${r.weeks} שבועות`,
      });
      router.refresh();
    });
  }

  function runLatest() {
    setStatus(null);
    startTransition(async () => {
      const r = await syncYemotLatest();
      if (!r.ok) {
        setStatus({ tone: "err", msg: r.error });
        return;
      }
      setStatus({
        tone: "ok",
        msg: r.weekKey
          ? `שבוע ${r.weekKey}: ${r.inserted.toLocaleString("he-IL")} רשומות`
          : "לא נמצא שבוע חדש",
      });
      router.refresh();
    });
  }

  function runCreditCards() {
    setStatus(null);
    startTransition(async () => {
      const r = await syncYemotCreditCards();
      if (!r.ok) {
        setStatus({ tone: "err", msg: r.error });
        return;
      }
      const yearInfo = r.perYear
        .map((y) => `${y.year}: ${y.matched} התאמה, ${y.unmatched} ללא`)
        .join(" | ");
      setStatus({
        tone: "ok",
        msg: `סליקות: ${r.stored} נשמרו, ${r.approved} מאושרות, ${r.matched} התאמה, ${r.hookSet} הו״ק, ${r.eshelFlipped} רישום חדש${yearInfo ? ` (${yearInfo})` : ""}`,
      });
      router.refresh();
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
          טוקן API
        </h2>
        {envToken && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
            הטוקן מוגדר בקובץ .env (משתנה YEMOT_TOKEN) — עריכה כאן לא תשפיע.
          </div>
        )}
        <form onSubmit={saveTokenSubmit} className="space-y-3 max-w-md">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              טוקן {hasToken && "(מוגדר — הזן חדש להחלפה)"}
            </span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="WU1BUElL.apik_XXXX.YYYYYYYYYY"
              dir="ltr"
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm font-mono"
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
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
          נתיבי מקור
        </h2>

        <AddSourceRow defaultSources={defaultSources} />

        {sources.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)] mt-4">
            עדיין לא הוגדרו נתיבים. הוסף אחד מהמוצעים או הזן ידנית.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {sources.map((s) => (
              <SourceRowView key={s.id} source={s} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl card-shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-[var(--color-primary)]">
            סנכרון מיטות
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runLatest}
              disabled={pending || !hasToken || sources.length === 0}
              className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
            >
              {pending ? "..." : "עדכן שבוע אחרון"}
            </button>
            <button
              type="button"
              onClick={runFull}
              disabled={pending || !hasToken || sources.length === 0}
              className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {pending ? "מסנכרן..." : "סנכרון מלא"}
            </button>
          </div>
        </div>
        <div className="text-sm text-[var(--color-muted-foreground)] space-y-1">
          <div>
            במאגר: <b>{reservationCount.toLocaleString("he-IL")}</b> הזמנות
            מ-<b>{weeksCount}</b> שבועות
          </div>
          <div>סנכרון אחרון: {formatSince(lastSync)}</div>
        </div>
      </section>

      <section className="bg-white rounded-xl card-shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-[var(--color-primary)]">
            סליקות אשראי
          </h2>
          <button
            type="button"
            onClick={runCreditCards}
            disabled={pending || !hasToken}
            className="px-4 h-9 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {pending ? "מסנכרן..." : "סנכרן סליקות"}
          </button>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          מושך את קובץ LogCreditCard מימות המשיח ומסמן תלמידים שנרשמו
          לאש&quot;ל דרך סליקת כרטיס אשראי בטלפון (לפי מספר זיהוי = קוד אישי).
        </p>
      </section>
    </div>
  );
}

function AddSourceRow({ defaultSources }: { defaultSources: DefaultSource[] }) {
  const router = useRouter();
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [current, setCurrent] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addYemotSource(path, current, label);
        setPath("");
        setLabel("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="block flex-1 min-w-[160px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            נתיב IVR
          </span>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="ivr2:דוחות/1"
            className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            dir="ltr"
          />
        </label>
        <label className="block flex-1 min-w-[140px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            תווית
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="למשל: דוחות 1"
            className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--color-border)]">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => setCurrent(e.target.checked)}
          />
          <span className="text-xs">פעיל (בסנכרון שבוע אחרון)</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          + הוסף
        </button>
      </form>
      {error && <div className="text-xs text-red-700 mt-1">{error}</div>}

      {defaultSources.length > 0 && (
        <div className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          מוצעים:{" "}
          {defaultSources.map((d, i) => (
            <button
              key={d.path}
              type="button"
              onClick={() => {
                setPath(d.path);
                setLabel(d.label);
                setCurrent(d.current);
              }}
              className="underline hover:text-[var(--color-accent)] ms-1"
            >
              {d.label} ({d.path}){i < defaultSources.length - 1 ? "," : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRowView({ source }: { source: SourceRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleYemotSourceCurrent(source.id);
      router.refresh();
    });
  }

  function del() {
    if (
      !confirm(
        `למחוק את "${source.label || source.path}" ואת כל ההזמנות שלו?`
      )
    )
      return;
    startTransition(async () => {
      await removeYemotSource(source.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="font-semibold text-[var(--color-primary)]">
          {source.label || source.path}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)] font-mono" dir="ltr">
          {source.path}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={
          "px-3 h-8 rounded-md text-xs font-medium " +
          (source.current
            ? "bg-[var(--color-success)] text-white"
            : "border border-[var(--color-border)]")
        }
      >
        {source.current ? "פעיל" : "ארכיון"}
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
