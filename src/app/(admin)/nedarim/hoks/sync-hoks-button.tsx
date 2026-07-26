"use client";

import { syncKevasNow } from "@/app/(admin)/settings/nedarim/actions";
import { SyncButton } from "@/components/sync-button";

export function SyncHoksButton() {
  return (
    <SyncButton
      label="סנכרן הו״ק"
      action={async () => {
        const r = await syncKevasNow();
        if (!r.ok) throw new Error(r.error);
        return r;
      }}
      formatResult={(r) => (
        <div>
          <div>
            <b>{r.totalUpserted.toLocaleString("he-IL")}</b> הו״ק סונכרנו
          </div>
          <div className="opacity-70 mt-0.5">
            סה״כ חודשי: {r.totalMonth.toLocaleString("he-IL")} ₪
            {r.totalMonth2 > 0 && ` · ${r.totalMonth2.toLocaleString("he-IL")} $`}
          </div>
          <div className="opacity-70">
            צפי 12 חודשים: {r.totalYear.toLocaleString("he-IL")} ₪
          </div>
        </div>
      )}
    />
  );
}
