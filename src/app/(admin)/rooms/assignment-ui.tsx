"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoomUnit } from "@/lib/rooms";
import {
  assignRooms,
  unassignRoom,
  clearYeshivaAllocations,
  copyFromWeek,
} from "./actions";

type Building = { building: string; units: RoomUnit[] };

const PALETTE = [
  "#FDE68A", "#BFDBFE", "#BBF7D0", "#FBCFE8", "#DDD6FE",
  "#FED7AA", "#A7F3D0", "#FCA5A5", "#C7D2FE",
];

function colorFor(yeshiva: string): string {
  let h = 0;
  for (let i = 0; i < yeshiva.length; i++) h = (h * 31 + yeshiva.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function previousSunday(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 7);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function RoomAssignmentUI({
  weekKey,
  yeshivot,
  buildings,
  countsByYeshiva,
}: {
  weekKey: string;
  yeshivot: string[];
  buildings: Building[];
  countsByYeshiva: Record<string, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetYeshiva, setTargetYeshiva] = useState<string>(yeshivot[0] ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copyFrom, setCopyFrom] = useState(previousSunday(weekKey));
  const [weekPicker, setWeekPicker] = useState(weekKey);

  const totalRooms = useMemo(
    () => buildings.reduce((n, b) => n + b.units.length, 0),
    [buildings]
  );

  // Map each unit key to its room ids so a linked pair assigns/clears together.
  const roomIdsByKey = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of buildings) for (const u of b.units) m.set(u.key, u.roomIds);
    return m;
  }, [buildings]);

  function toggleUnit(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function selectAllUnassignedIn(building: Building) {
    const next = new Set(selected);
    for (const u of building.units) if (!u.assignedTo) next.add(u.key);
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectedRoomIds(): string[] {
    const ids: string[] = [];
    for (const key of selected) ids.push(...(roomIdsByKey.get(key) ?? []));
    return ids;
  }

  function doAssign() {
    if (!targetYeshiva) {
      setMsg({ tone: "err", text: "בחר ישיבה" });
      return;
    }
    if (selected.size === 0) {
      setMsg({ tone: "err", text: "בחר לפחות חדר אחד" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        await assignRooms({
          weekKey,
          yeshiva: targetYeshiva,
          roomIds: selectedRoomIds(),
        });
        const units = selected.size;
        setSelected(new Set());
        setMsg({ tone: "ok", text: `שובצו ${units} חדרים ל-${targetYeshiva}` });
        router.refresh();
      } catch (err) {
        setMsg({ tone: "err", text: err instanceof Error ? err.message : "שגיאה" });
      }
    });
  }

  function doUnassignUnit(unit: RoomUnit) {
    startTransition(async () => {
      for (const roomId of unit.roomIds) await unassignRoom(weekKey, roomId);
      const next = new Set(selected);
      next.delete(unit.key);
      setSelected(next);
      router.refresh();
    });
  }

  function doClearYeshiva() {
    if (!targetYeshiva) return;
    if (!confirm(`לבטל את כל החדרים המשויכים ל-${targetYeshiva} השבוע?`)) return;
    startTransition(async () => {
      const r = await clearYeshivaAllocations(weekKey, targetYeshiva);
      setMsg({ tone: "ok", text: `בוטלו ${r.removed} חדרים מ-${targetYeshiva}` });
      router.refresh();
    });
  }

  function doCopyFrom() {
    if (!copyFrom.trim()) return;
    startTransition(async () => {
      try {
        const r = await copyFromWeek(copyFrom.trim(), weekKey);
        setMsg({
          tone: "ok",
          text: `הועתקו ${r.copied} שיבוצים מ-${copyFrom} לשבוע הנוכחי`,
        });
        router.refresh();
      } catch (err) {
        setMsg({ tone: "err", text: err instanceof Error ? err.message : "שגיאה" });
      }
    });
  }

  function jumpToWeek() {
    router.push(`/rooms?week=${weekPicker}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-4">
        <section className="bg-white rounded-xl card-shadow p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
            שבוע נוכחי
          </h3>
          <div className="flex gap-2">
            <input
              type="date"
              value={weekPicker}
              onChange={(e) => setWeekPicker(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
            <button
              type="button"
              onClick={jumpToWeek}
              className="px-3 h-9 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
            >
              עבור
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-2">
            בחר כל יום — המערכת תעבור לשבוע המכיל אותו (יום ראשון).
          </p>
        </section>

        <section className="bg-white rounded-xl card-shadow p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
            שיבוץ
          </h3>
          <label className="block mb-3">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              ישיבה
            </span>
            <select
              value={targetYeshiva}
              onChange={(e) => setTargetYeshiva(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
            >
              {yeshivot.map((y) => (
                <option key={y} value={y}>
                  {y}
                  {countsByYeshiva[y] ? ` (${countsByYeshiva[y]})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
            נבחרו: <b>{selected.size}</b> חדרים
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={doAssign}
              disabled={pending || selected.size === 0}
              className="w-full px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {pending ? "..." : `שבץ ${selected.size} חדרים`}
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="w-full px-4 h-9 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)]"
              >
                נקה בחירה
              </button>
            )}
            <button
              type="button"
              onClick={doClearYeshiva}
              disabled={pending || !countsByYeshiva[targetYeshiva]}
              className="w-full px-4 h-9 rounded-lg border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              בטל את כל שיבוצי {targetYeshiva}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl card-shadow p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
            סיכום השבוע
          </h3>
          <div className="space-y-1 text-sm">
            {yeshivot.map((y) => {
              const n = countsByYeshiva[y] ?? 0;
              return (
                <div key={y} className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => setTargetYeshiva(y)}
                    style={{ cursor: "pointer" }}
                  >
                    <span
                      className="w-3 h-3 rounded"
                      style={{
                        background: n > 0 ? colorFor(y) : "transparent",
                        border: "1px solid var(--color-border)",
                      }}
                    />
                    <span className={y === targetYeshiva ? "font-semibold" : ""}>
                      {y}
                    </span>
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">
                    {n || ""}
                  </span>
                </div>
              );
            })}
            <div className="pt-2 mt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
              <span>סה״כ משובצים</span>
              <span>
                {Object.values(countsByYeshiva).reduce((a, b) => a + b, 0)} /{" "}
                {totalRooms}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl card-shadow p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
            העתקה משבוע קודם
          </h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
            מעתיק את השיבוצים ממה שהיה בשבוע אחר. חדרים שכבר שובצו השבוע לא
            ידרסו.
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-[var(--color-border)] px-3 text-sm"
            />
            <button
              type="button"
              onClick={doCopyFrom}
              disabled={pending || !copyFrom.trim()}
              className="px-3 h-9 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
            >
              העתק
            </button>
          </div>
        </section>
      </aside>

      <div className="space-y-4">
        {msg && (
          <div
            className={
              "rounded-lg px-4 py-2.5 text-sm border " +
              (msg.tone === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800")
            }
          >
            {msg.text}
          </div>
        )}
        {buildings.map((b) => {
          const unassignedHere = b.units.filter((u) => !u.assignedTo).length;
          return (
            <section
              key={b.building}
              className="bg-white rounded-xl card-shadow p-5"
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                  {b.building}
                </h3>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {b.units.length} חדרים · {unassignedHere} פנויים
                  {unassignedHere > 0 && (
                    <button
                      type="button"
                      onClick={() => selectAllUnassignedIn(b)}
                      className="ms-3 underline hover:text-[var(--color-accent)]"
                    >
                      בחר את כל הפנויים
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.units.map((u) => {
                  const isSelected = selected.has(u.key);
                  const linked = u.roomIds.length > 1;
                  const bg = u.assignedTo ? colorFor(u.assignedTo) : "white";
                  return (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => toggleUnit(u.key)}
                      className={
                        "relative min-w-[72px] px-3 py-2 rounded-lg text-sm text-center transition-all border-2 " +
                        (isSelected
                          ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30"
                          : u.assignedTo
                          ? "border-transparent"
                          : "border-[var(--color-border)] hover:border-[var(--color-accent)]")
                      }
                      style={{ background: bg }}
                      title={
                        (u.assignedTo ? `משוייך: ${u.assignedTo}` : "פנוי") +
                        (linked ? " · חדר מחובר" : "")
                      }
                    >
                      <div className="font-mono font-semibold flex items-center justify-center gap-1">
                        {u.code}
                        {linked && <span className="text-[9px] opacity-70">⛓</span>}
                        {u.capacity != null && (
                          <span className="text-[9px] font-normal opacity-70">
                            · {u.capacity} מ׳
                          </span>
                        )}
                      </div>
                      {u.assignedTo && (
                        <div className="text-[10px] mt-0.5 text-[var(--color-foreground)] truncate max-w-[80px]">
                          {u.assignedTo}
                        </div>
                      )}
                      {u.assignedTo && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`לבטל שיבוץ ${u.code} מ-${u.assignedTo}?`))
                              doUnassignUnit(u);
                          }}
                          className="absolute top-0.5 right-1 text-[10px] text-red-700 hover:font-bold cursor-pointer"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
