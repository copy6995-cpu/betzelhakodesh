"use client";

import { syncTransactionsNow } from "@/app/(admin)/settings/nedarim/actions";
import { SyncButton } from "@/components/sync-button";

export function SyncTransactionsButton() {
  return (
    <SyncButton
      label="סנכרן עסקאות"
      action={() => syncTransactionsNow()}
      formatResult={(r) => (
        <div>
          <div>
            <b>{r.totalUpserted.toLocaleString("he-IL")}</b> עסקאות נטענו
          </div>
          <div className="opacity-70">{r.pages} עמודים</div>
        </div>
      )}
    />
  );
}
