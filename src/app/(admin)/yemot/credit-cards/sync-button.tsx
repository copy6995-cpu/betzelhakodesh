"use client";

import { SyncButton } from "@/components/sync-button";
import { syncYemotCreditCards } from "@/app/(admin)/settings/yemot/actions";

export function CreditCardSyncButton() {
  return (
    <SyncButton
      label="סנכרן סליקות"
      action={syncYemotCreditCards}
      formatResult={(r) => {
        if (!r.ok) return r.error;
        return `${r.stored} נשמרו · ${r.matched} התאמה · ${r.hookSet} הו״ק · ${r.eshelFlipped} רישום חדש`;
      }}
    />
  );
}
