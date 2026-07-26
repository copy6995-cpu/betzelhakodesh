"use client";

import { syncFormNow } from "@/app/(admin)/settings/nedarim/actions";
import { SyncButton } from "@/components/sync-button";

export function SyncFormButton({ tofesId }: { tofesId: string }) {
  return (
    <SyncButton
      label="סנכרן טופס"
      variant="outline"
      action={() => syncFormNow(tofesId)}
      formatResult={(r) => (
        <div>
          <div>
            <b>{r.totalUpserted.toLocaleString("he-IL")}</b> הגשות עודכנו
          </div>
          {r.attach && (
            <div className="mt-1 pt-1 border-t border-green-200">
              <div>
                {r.attach.matched} תלמידים אותרו · {r.attach.hookSet} הוקים
                חדשים
              </div>
              <div>
                {r.attach.eshelFlipped} רשמו לאשל
                {r.attach.datesBackfilled > 0 &&
                  ` · ${r.attach.datesBackfilled} תאריכים הושלמו`}
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}
