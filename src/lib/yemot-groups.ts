/**
 * "חד פעמי" and the other Yemot bed-money buckets — these are NOT tuition and
 * do not touch a bachur's balance. Sources:
 *   - live bed-bookings' "סכום לתשלום", by CutList8 group (23 / 25 / 11–18)
 *   - manual payments with method "חד פעמי" (folded into the one-time bucket)
 * Attributed to the booker's yeshiva (active-year student, by personalCode).
 */
import { prisma } from "./prisma";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";
import { weekKeyOf } from "./weeks";

export const ONE_TIME_GROUP = "23";
export const GRACE_GROUP = "25";
export const YESHIVA_GROUPS = new Set(["11", "12", "13", "14", "15", "16", "17", "18"]);
export const ONE_TIME_METHOD = "חד פעמי";

export type YeshivaGroupMoney = { oneTime: number; grace25: number; yesh: number };

export type GroupMoney = {
  byYeshiva: Map<string, YeshivaGroupMoney>;
  /** weekKey → one-time (group 23 + manual חד פעמי) sum, for the weekly report. */
  weekly23: Map<string, number>;
};

export async function loadYemotGroupMoney(year: string): Promise<GroupMoney> {
  const [liveRes, cancellations, students, chadPayments] = await Promise.all([
    prisma.yemotBedReservation.findMany({
      where: { status: "מאושר" },
      select: { personalCode: true, weekKey: true, source: true, raw: true },
    }),
    loadCancellations(),
    prisma.student.findMany({
      where: { year, archived: false },
      select: { personalCode: true, yeshiva: true },
    }),
    prisma.payment.findMany({
      where: { method: ONE_TIME_METHOD, student: { year, archived: false } },
      select: { amount: true, date: true, student: { select: { yeshiva: true } } },
    }),
  ]);

  const codeToYeshiva = new Map(
    students.map((s) => [s.personalCode, s.yeshiva?.trim() || "ללא ישיבה"])
  );
  const byYeshiva = new Map<string, YeshivaGroupMoney>();
  const weekly23 = new Map<string, number>();
  const add = (y: string, k: keyof YeshivaGroupMoney, amt: number) => {
    const g = byYeshiva.get(y) ?? { oneTime: 0, grace25: 0, yesh: 0 };
    g[k] += amt;
    byYeshiva.set(y, g);
  };
  const addWeek = (wk: string, amt: number) =>
    weekly23.set(wk, (weekly23.get(wk) ?? 0) + amt);

  for (const r of liveRes) {
    if (!isLiveBooking(r, cancellations)) continue;
    let grp = "";
    let pay = 0;
    try {
      const j = JSON.parse(r.raw) as Record<string, unknown>;
      grp = String(j.CutList8 ?? "");
      pay = Number(j["סכום לתשלום"]) || 0;
    } catch {
      /* ignore */
    }
    if (!pay) continue;
    const y = codeToYeshiva.get(r.personalCode);
    if (grp === ONE_TIME_GROUP) {
      addWeek(r.weekKey, pay);
      if (y) add(y, "oneTime", pay);
    } else if (!y) {
      continue; // 25 / 11-18 need a known yeshiva
    } else if (grp === GRACE_GROUP) {
      add(y, "grace25", pay);
    } else if (YESHIVA_GROUPS.has(grp)) {
      add(y, "yesh", pay);
    }
  }

  // Manual "חד פעמי" payments fold into the one-time bucket (by yeshiva + week).
  for (const p of chadPayments) {
    const amt = Number(p.amount);
    const y = p.student.yeshiva?.trim() || "ללא ישיבה";
    add(y, "oneTime", amt);
    if (p.date) addWeek(weekKeyOf(p.date), amt);
  }

  return { byYeshiva, weekly23 };
}
