import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { envOverrides } from "@/lib/nedarim";
import { NedarimSettingsForm } from "./form";

export const dynamic = "force-dynamic";

async function loadSettings() {
  const [mosad, api, formsApi, lastTx, minStartId, forms] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "nedarim_mosad_id" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_api_password" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_forms_password" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_last_sync_tx" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_min_start_id" } }),
    prisma.nedarimFormConfig.findMany({ orderBy: { order: "asc" } }),
  ]);
  const txCount = await prisma.nedarimTransaction.count();
  const formSyncKeys = await prisma.appSetting.findMany({
    where: { key: { startsWith: "nedarim_last_sync_form_" } },
  });
  const lastByTofes = new Map(
    formSyncKeys.map((k) => [
      k.key.replace("nedarim_last_sync_form_", ""),
      k.value,
    ])
  );
  const formsWithCounts = await Promise.all(
    forms.map(async (f) => ({
      ...f,
      count: await prisma.nedarimFormSubmission.count({
        where: { tofesId: f.tofesId },
      }),
      lastSync: lastByTofes.get(f.tofesId) ?? null,
    }))
  );
  return {
    mosadId: mosad?.value ?? "",
    hasApiPassword: !!api?.value,
    hasFormsPassword: !!formsApi?.value,
    lastTxSync: lastTx?.value ?? null,
    minStartId: minStartId?.value ?? "",
    txCount,
    forms: formsWithCounts,
  };
}

export default async function NedarimSettingsPage() {
  const s = await loadSettings();
  const env = envOverrides();
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-xs text-[var(--color-muted-foreground)] hover:underline"
        >
          → הגדרות
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          נדרים פלוס
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          חיבור למערכת נדרים פלוס: היסטוריית עסקאות אשראי + טפסים.
          <br />
          לקבלת מזהה מוסד וסיסמת API, שלח מייל ל-<b>office@nedar.im</b> מכתובת
          מייל המורשית במוסד ובקש &quot;קוד אימות API&quot;.
        </p>
      </div>

      <NedarimSettingsForm
        mosadId={s.mosadId}
        hasApiPassword={s.hasApiPassword}
        hasFormsPassword={s.hasFormsPassword}
        envMosadId={env.mosadId}
        envApiPassword={env.apiPassword}
        envFormsPassword={env.formsPassword}
        lastTxSync={s.lastTxSync}
        minStartId={s.minStartId}
        txCount={s.txCount}
        forms={s.forms.map((f) => ({
          id: f.id,
          tofesId: f.tofesId,
          label: f.label,
          count: f.count,
          lastSync: f.lastSync,
        }))}
      />
    </div>
  );
}
