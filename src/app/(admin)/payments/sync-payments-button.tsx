"use client";

import { syncPaymentsNow } from "./actions";
import { SyncButton } from "@/components/sync-button";

/**
 * Materialize NedarimTransaction rows into Payment records so the /payments
 * page + per-student balance pick them up. Idempotent — a second click
 * doesn't duplicate anything.
 */
export function SyncPaymentsButton() {
  return (
    <SyncButton
      label="סנכרן מנדרים לתשלומים"
      action={() => syncPaymentsNow()}
      formatResult={(r) => (
        <div>
          <div>
            <b>{r.created.toLocaleString("he-IL")}</b> תשלומים חדשים
          </div>
          <div className="opacity-70 mt-0.5">
            {r.scannedTransactions.toLocaleString("he-IL")} עסקאות נסרקו ·{" "}
            {r.eligibleTransactions.toLocaleString("he-IL")} תואמות תלמידים
          </div>
          <div className="opacity-70">
            {r.alreadyExisted.toLocaleString("he-IL")} כבר קיימות ·{" "}
            {r.unmatchedHooks.toLocaleString("he-IL")} הוקים ללא תלמיד
          </div>
        </div>
      )}
    />
  );
}
