"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRoomCapacity, importCapacitiesFromModel } from "../actions";

type Room = { id: string; code: string; capacity: number | null; linked: boolean };
type Building = { building: string; rooms: Room[] };

export function RoomCapacityManager({ buildings }: { buildings: Building[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );

  function save(roomId: string, raw: string) {
    const n = raw.trim() === "" ? null : parseInt(raw, 10);
    startTransition(async () => {
      await setRoomCapacity(roomId, n);
    });
  }

  function doImport() {
    setMsg(null);
    startTransition(async () => {
      const r = await importCapacitiesFromModel();
      if (!r.ok) {
        setMsg({ tone: "err", text: r.error });
        return;
      }
      setMsg({
        tone: "ok",
        text: `יובאו ${r.updated} חדרים מקובץ המודל${
          r.unmatched ? ` · ${r.unmatched} לא נמצאו במאגר` : ""
        }`,
      });
      router.refresh();
    });
  }

  const grandTotal = buildings.reduce(
    (n, b) => n + b.rooms.reduce((m, r) => m + (r.capacity ?? 0), 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-xl card-shadow p-4">
        <div className="text-sm">
          סה״כ מיטות מוגדרות:{" "}
          <b className="text-[var(--color-primary)]">
            {grandTotal.toLocaleString("he-IL")}
          </b>
        </div>
        <button
          type="button"
          onClick={doImport}
          disabled={pending}
          className="px-4 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {pending ? "מייבא…" : "↧ ייבא מס' מיטות מקובץ המודל"}
        </button>
      </div>

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
        const beds = b.rooms.reduce((m, r) => m + (r.capacity ?? 0), 0);
        const missing = b.rooms.filter((r) => r.capacity == null).length;
        return (
          <section key={b.building} className="bg-white rounded-xl card-shadow p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                {b.building}
              </h3>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {b.rooms.length} חדרים · <b>{beds}</b> מיטות
                {missing > 0 && ` · ${missing} ללא מספר`}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {b.rooms.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 border border-[var(--color-border)] rounded-lg px-2 py-1.5"
                >
                  <span className="font-mono text-xs flex-1 truncate" title={r.code}>
                    {r.code}
                    {r.linked && <span className="opacity-60"> ⛓</span>}
                  </span>
                  <input
                    // Key includes capacity so a bulk import remounts the input
                    // with the fresh value (uncontrolled defaultValue alone
                    // wouldn't re-apply after router.refresh).
                    key={`${r.id}:${r.capacity ?? ""}`}
                    type="number"
                    min={0}
                    defaultValue={r.capacity ?? ""}
                    onBlur={(e) => save(r.id, e.target.value)}
                    placeholder="—"
                    className="w-12 h-7 text-center text-sm rounded border border-[var(--color-border)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
