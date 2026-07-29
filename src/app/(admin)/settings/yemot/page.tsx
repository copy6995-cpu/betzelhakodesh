import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tokenFromEnv } from "@/lib/yemot";
import { YemotSettingsForm } from "./form";

export const dynamic = "force-dynamic";

// Default sources from the original Google Apps Script. Used only to seed
// suggestion placeholders — the user still adds them explicitly.
const DEFAULT_SOURCES = [
  { path: "ivr2:3", label: "ארכיון", current: false },
  { path: "ivr2:דוחות/1", label: "דוחות 1", current: true },
  { path: "ivr2:דוחות/2", label: "דוחות 2", current: true },
  { path: "ivr2:דוחות/3", label: "דוחות 3", current: true },
];

async function load() {
  const [token, lastSync, sources] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "yemot_token" } }),
    prisma.appSetting.findUnique({ where: { key: "yemot_last_sync" } }),
    prisma.yemotSource.findMany({ orderBy: { order: "asc" } }),
  ]);
  const reservationCount = await prisma.yemotBedReservation.count();
  const distinctWeeks = await prisma.yemotBedReservation.groupBy({
    by: ["weekKey"],
  });
  return {
    hasToken: !!token?.value,
    lastSync: lastSync?.value ?? null,
    sources,
    reservationCount,
    weeksCount: distinctWeeks.length,
  };
}

export default async function YemotSettingsPage() {
  const s = await load();
  const envToken = tokenFromEnv();
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
          ימות המשיח
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          חיבור למערכת ימות המשיח לסנכרון הזמנות מיטה שבועיות.
          <br />
          הטוקן הוא המחרוזת המלאה שמייצר פאנל ימות (הגדרות מערכת ← הרשאות ← API)
          — 3 חלקים המופרדים בנקודות, למשל{" "}
          <code>WU1BUElL.apik_XXXX.YYYYYYYYYY</code>.
        </p>
      </div>

      <YemotSettingsForm
        hasToken={s.hasToken || envToken}
        envToken={envToken}
        lastSync={s.lastSync}
        sources={s.sources.map((x) => ({
          id: x.id,
          path: x.path,
          current: x.current,
          label: x.label ?? "",
          kind: x.kind === "cancellation" ? "cancellation" : "booking",
        }))}
        reservationCount={s.reservationCount}
        weeksCount={s.weeksCount}
        defaultSources={DEFAULT_SOURCES}
      />
    </div>
  );
}
