"use client";

import { syncYemotLatest } from "@/app/(admin)/settings/yemot/actions";
import { SyncButton } from "@/components/sync-button";

export function SyncBedsButton() {
  return (
    <SyncButton
      label="סנכרן מיטות"
      action={async () => {
        // safe() wrapper on the action returns errors as data, so we translate
        // failures back into a thrown error here — SyncButton catches it and
        // shows the real message instead of Next.js's masked digest.
        const r = await syncYemotLatest();
        if (!r.ok) throw new Error(r.error);
        return r;
      }}
      formatResult={(r) => (
        <div>
          <div>
            <b>{r.inserted.toLocaleString("he-IL")}</b> הזמנות נטענו
          </div>
          {r.weekKey && (
            <div className="opacity-70">שבוע {r.weekKey}</div>
          )}
        </div>
      )}
    />
  );
}
