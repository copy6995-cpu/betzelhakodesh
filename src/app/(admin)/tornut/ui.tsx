"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DutyLevel, TornutData } from "@/lib/tornut";
import {
  addShabbat,
  adminAssign,
  claimShabbat,
  deleteShabbat,
  releaseShabbat,
  saveLevelsAction,
  updateShabbat,
} from "./actions";

const OPEN = "— פנוי —";

export function TornutBoard({
  isAdmin,
  viewerYeshiva,
  data,
  yeshivot,
}: {
  isAdmin: boolean;
  viewerYeshiva: string | null;
  data: TornutData;
  yeshivot: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const levelNames = data.levels.map((l) => l.name);

  function run(fn: () => Promise<void>) {
    setErr("");
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  // Viewer's own picks per level (reps see counts, never the limit).
  const myCounts = viewerYeshiva ? data.counts[viewerYeshiva] ?? {} : {};

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {isAdmin && <LevelsEditor initial={data.levels} onRun={run} pending={pending} />}

      {!isAdmin && viewerYeshiva && data.levels.length > 0 && (
        <div className="bg-white rounded-xl card-shadow p-4 text-sm">
          <span className="font-medium">הישיבה שלך ({viewerYeshiva}) בחרה: </span>
          {data.levels.map((l) => (
            <span key={l.name} className="ms-2 text-[var(--color-muted-foreground)]">
              {l.name}: <b className="text-[var(--color-foreground)]">{myCounts[l.name] ?? 0}</b>
            </span>
          ))}
        </div>
      )}

      {/* Shabbatot table */}
      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-primary)]">
            {data.rows.length} שבתות
          </div>
          {pending && (
            <span className="text-xs text-[var(--color-muted-foreground)]">…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)] text-right">
                <th className="py-2 px-3 font-semibold min-w-[160px]">שבת</th>
                <th className="py-2 px-2 font-semibold">רמה</th>
                <th className="py-2 px-2 font-semibold min-w-[150px]">ישיבה בתורנות</th>
                <th className="py-2 px-2 font-semibold w-24" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const mine = !!viewerYeshiva && r.assignedYeshiva === viewerYeshiva;
                return (
                  <tr key={r.id} className="border-t border-[var(--color-border)]/50">
                    {/* label */}
                    <td className="px-3 py-1.5">
                      {isAdmin ? (
                        <input
                          defaultValue={r.label}
                          onBlur={(e) =>
                            e.target.value.trim() !== r.label &&
                            run(() => updateShabbat(r.id, { label: e.target.value }))
                          }
                          className="h-8 w-full rounded border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] px-1.5 bg-transparent outline-none font-medium"
                        />
                      ) : (
                        <span className="font-medium">{r.label}</span>
                      )}
                    </td>
                    {/* level */}
                    <td className="px-2 py-1.5">
                      {isAdmin ? (
                        <select
                          value={r.level}
                          onChange={(e) =>
                            run(() => updateShabbat(r.id, { level: e.target.value }))
                          }
                          className="h-8 rounded border border-[var(--color-border)] text-xs px-1 bg-white"
                        >
                          <option value="">(ללא)</option>
                          {levelNames.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : r.level ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                          {r.level}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]/50">—</span>
                      )}
                    </td>
                    {/* assigned yeshiva */}
                    <td className="px-2 py-1.5">
                      {isAdmin ? (
                        <select
                          value={r.assignedYeshiva ?? ""}
                          onChange={(e) =>
                            run(() => adminAssign(r.id, e.target.value || null))
                          }
                          className="h-8 rounded border border-[var(--color-border)] text-xs px-1 bg-white max-w-[150px]"
                        >
                          <option value="">{OPEN}</option>
                          {yeshivot.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      ) : r.assignedYeshiva ? (
                        <span className={mine ? "font-semibold text-green-700" : "font-medium"}>
                          {r.assignedYeshiva}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]/60">{OPEN}</span>
                      )}
                    </td>
                    {/* action */}
                    <td className="px-2 py-1.5 text-left">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() =>
                            confirm(`למחוק את "${r.label}"?`) &&
                            run(() => deleteShabbat(r.id))
                          }
                          disabled={pending}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="מחק"
                        >
                          ✕
                        </button>
                      ) : viewerYeshiva ? (
                        mine ? (
                          <button
                            type="button"
                            onClick={() => run(() => releaseShabbat(r.id))}
                            disabled={pending}
                            className="h-8 px-3 rounded-lg border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-muted)] disabled:opacity-50"
                          >
                            שחרר
                          </button>
                        ) : r.assignedYeshiva ? (
                          <span className="text-[11px] text-[var(--color-muted-foreground)]">תפוס</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => run(() => claimShabbat(r.id))}
                            disabled={pending}
                            className="h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                          >
                            קח
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--color-muted-foreground)]">
                    {isAdmin ? "אין שבתות עדיין. הוסיפו למטה." : "טרם הוגדרו שבתות."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isAdmin && <AddShabbatRow levelNames={levelNames} onRun={run} pending={pending} />}
      </div>
    </div>
  );
}

function LevelsEditor({
  initial,
  onRun,
  pending,
}: {
  initial: DutyLevel[];
  onRun: (fn: () => Promise<void>) => void;
  pending: boolean;
}) {
  const [levels, setLevels] = useState<DutyLevel[]>(initial);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("2");

  function addLevel() {
    if (!name.trim()) return;
    setLevels((ls) => [
      ...ls.filter((l) => l.name !== name.trim()),
      { name: name.trim(), limit: Math.max(0, parseInt(limit || "0", 10)) },
    ]);
    setName("");
    setLimit("2");
  }

  return (
    <div className="bg-white rounded-xl card-shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--color-primary)]">
          רמות ומגבלות
        </h2>
        <button
          type="button"
          onClick={() => onRun(() => saveLevelsAction(levels))}
          disabled={pending}
          className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          שמור רמות
        </button>
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
        לכל רמה — כמה שבתות מקסימום ישיבה אחת יכולה לבחור בה (הנציגים רואים את
        הרמה אך לא את המספר).
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {levels.map((l, i) => (
          <div
            key={l.name}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 h-9 text-sm"
          >
            <span className="font-medium">{l.name}</span>
            <span className="text-[var(--color-muted-foreground)] text-xs">מקס׳</span>
            <input
              type="number"
              min={0}
              value={l.limit}
              onChange={(e) =>
                setLevels((ls) =>
                  ls.map((x, xi) =>
                    xi === i ? { ...x, limit: Math.max(0, parseInt(e.target.value || "0", 10)) } : x
                  )
                )
              }
              className="w-12 h-7 rounded border border-[var(--color-border)] text-center text-sm"
            />
            <button
              type="button"
              onClick={() => setLevels((ls) => ls.filter((_, xi) => xi !== i))}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        {levels.length === 0 && (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            אין רמות עדיין.
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLevel()}
          placeholder="שם רמה (למשל א׳)"
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-40"
        />
        <input
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="מקס׳"
          className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm w-20"
        />
        <button
          type="button"
          onClick={addLevel}
          className="h-9 px-4 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-muted)]"
        >
          + רמה
        </button>
      </div>
    </div>
  );
}

function AddShabbatRow({
  levelNames,
  onRun,
  pending,
}: {
  levelNames: string[];
  onRun: (fn: () => Promise<void>) => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState("");

  function add() {
    if (!label.trim()) return;
    onRun(() => addShabbat(label, level));
    setLabel("");
  }

  return (
    <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap items-end gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="שבת / פרשה"
        className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm flex-1 min-w-[150px]"
      />
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        className="h-9 rounded-lg border border-[var(--color-border)] px-2 text-sm bg-white"
      >
        <option value="">רמה (ללא)</option>
        {levelNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        + הוסף שבת
      </button>
    </div>
  );
}
