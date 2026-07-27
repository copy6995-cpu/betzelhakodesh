import Link from "next/link";
import { formatILS, formatNum } from "@/lib/utils";
import {
  findDuplicateRegistrations,
  type DupSeverity,
} from "@/lib/duplicate-registrations";
import { NedarimTabs } from "../tabs";

export const dynamic = "force-dynamic";

const SEVERITY_META: Record<
  DupSeverity,
  { label: string; badge: string; row: string; blurb: string }
> = {
  active: {
    label: "חיוב כפול פעיל",
    badge: "bg-red-100 text-red-800",
    row: "bg-red-50/60",
    blurb: "שתי הוראות הקבע כבר חייבו — הכסף נגבה פעמיים.",
  },
  pending: {
    label: "עומד לחייב כפול",
    badge: "bg-amber-100 text-amber-800",
    row: "bg-amber-50/50",
    blurb: "שתי הוראות קבע קיימות; טרם חויב כפול. לבטל אחת לפני החיוב הבא.",
  },
  borderline: {
    label: "טופס ללא הוק",
    badge: "bg-gray-100 text-gray-600",
    row: "",
    blurb: "הטופס הוגש בלי הוק — בפועל ערוץ אחד. לא דחוף.",
  },
};

export default async function DuplicatesPage() {
  const dupes = await findDuplicateRegistrations();

  const counts = {
    active: dupes.filter((d) => d.severity === "active").length,
    pending: dupes.filter((d) => d.severity === "pending").length,
    borderline: dupes.filter((d) => d.severity === "borderline").length,
  };

  const tiles = [
    {
      label: "חיוב כפול פעיל",
      value: counts.active,
      color: "var(--color-error, #dc2626)",
    },
    {
      label: "עומד לחייב כפול",
      value: counts.pending,
      color: "var(--color-warning, #d97706)",
    },
    {
      label: "טופס ללא הוק",
      value: counts.borderline,
      color: "var(--color-muted-foreground)",
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          רישום כפול
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          בחורים שנרשמו גם בטופס נדרים פלוס וגם בסליקת ימות המשיח באותה שנה —
          מצב שיוצר שתי הוראות קבע וחיוב כפול.
        </p>
      </div>

      <NedarimTabs />

      <div className="mb-6 grid grid-cols-3 gap-3 max-w-xl">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="bg-white rounded-xl card-shadow px-4 py-3 text-center"
          >
            <div className="text-2xl font-bold" style={{ color: t.color }}>
              {formatNum(t.value)}
            </div>
            <div className="text-xs text-[var(--color-muted-foreground)] mt-1">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {dupes.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-10 text-center">
          <div className="text-lg font-semibold text-[var(--color-success)]">
            ✓ לא נמצאו רישומים כפולים
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-2">
            אף בחור לא מופיע גם בטופס וגם בסליקת ימות המשיח באותה שנה.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
            <b>ביטול הוראת קבע הוא פעולה כספית שיש לבצע בפאנל נדרים פלוס.</b>{" "}
            לכל שורה החליטו איזו הוק להשאיר ובטלו את השנייה. עמודות העסקאות
            מראות על איזו הוק כבר נגבה כסף בפועל.
          </div>

          <div className="bg-white rounded-xl card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                    <th className="py-3 pe-5 ps-5 font-semibold">חומרה</th>
                    <th className="py-3 px-4 font-semibold">בחור</th>
                    <th className="py-3 px-4 font-semibold">שנה</th>
                    <th className="py-3 px-4 font-semibold">מחיר</th>
                    <th className="py-3 px-4 font-semibold">הוק טופס</th>
                    <th className="py-3 px-4 font-semibold">הוק ימות</th>
                  </tr>
                </thead>
                <tbody>
                  {dupes.map((d) => {
                    const meta = SEVERITY_META[d.severity];
                    return (
                      <tr
                        key={`${d.year}|${d.personalCode}`}
                        className={`border-b border-[var(--color-border)]/50 ${meta.row}`}
                      >
                        <td className="py-3 pe-5 ps-5 align-top">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                          <div className="text-xs text-[var(--color-muted-foreground)] mt-1 max-w-[15rem]">
                            {meta.blurb}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          {d.studentId ? (
                            <Link
                              href={`/bachurim/${d.studentId}`}
                              className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)] hover:underline"
                            >
                              {d.studentName}
                            </Link>
                          ) : (
                            <span className="text-[var(--color-muted-foreground)]">
                              {d.studentName ?? "(לא במאגר)"}
                            </span>
                          )}
                          <div className="text-xs text-[var(--color-muted-foreground)] font-mono mt-0.5">
                            {d.personalCode}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-[var(--color-muted-foreground)]">
                          {d.year}
                        </td>
                        <td className="py-3 px-4 align-top">
                          {formatILS(d.price)}
                        </td>
                        <td className="py-3 px-4 align-top">
                          {d.formHook ? (
                            <>
                              <div className="font-mono text-xs">
                                {d.formHook}
                              </div>
                              <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                                {d.formTxCount > 0 ? (
                                  <span className="text-[var(--color-success)]">
                                    {d.formTxCount} עסקאות ·{" "}
                                    {formatILS(d.formTxSum)}
                                  </span>
                                ) : (
                                  "0 עסקאות"
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">
                              — (ריק)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-mono text-xs">
                            {d.cardApprovals.join(", ")}
                          </div>
                          <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                            {d.cardTxCount > 0 ? (
                              <span className="text-[var(--color-success)]">
                                {d.cardTxCount} עסקאות · {formatILS(d.cardTxSum)}
                              </span>
                            ) : (
                              "0 עסקאות"
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
