/**
 * Bed report grouped by "קבוצה" (the CutList8 field on each Yemot booking).
 *
 * A student can book across several groups (≈320 of them do), so counting per
 * group naively double-counts people and money. To keep every figure additive
 * — the group rows sum exactly to the deduped total — each student is assigned
 * to ONE primary group: the group they booked most in (ties broken by their
 * latest booking, then by the lower group number). This satisfies both the
 * "report by group" ask and the "count each registrant once" ask.
 */
import { prisma } from "./prisma";
import { dateKey, shortDate } from "./beds-matrix";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";

export type BedGroupRow = {
  group: string;
  students: number; // distinct students whose primary group is this
  subscribers: number; // registered for אש״ל (Student.registeredEshel === true)
  nonSubscribers: number; // in the roster but not registered
  notInRoster: number; // booked but not an active-year student
  alsoInOtherGroup: number; // of `students`, how many also booked elsewhere
  payment: number; // ₪ — approved Yemot card charges by these students
  bookedThisWeek: number; // subscribers ("regulars") who booked the selected week
};

export type BedGroupWeek = { weekKey: string; label: string };

export type BedGroupReport = {
  rows: BedGroupRow[];
  totals: {
    students: number;
    subscribers: number;
    nonSubscribers: number;
    notInRoster: number;
    payment: number;
    bookedThisWeek: number;
  };
  crossGroupStudents: number; // total students who booked in >1 group
  weeks: BedGroupWeek[]; // selectable weeks (newest first)
  selectedWeek: string | null;
};

function rawGroup(raw: string): string {
  try {
    const g = JSON.parse(raw)?.CutList8;
    const s = g == null ? "" : String(g).trim();
    return s || "(ללא קבוצה)";
  } catch {
    return "(ללא קבוצה)";
  }
}

export async function loadBedGroupReport(
  activeYear: string,
  weekKey?: string
): Promise<BedGroupReport> {
  const [reservationsRaw, students, charges, cancellations] = await Promise.all([
    prisma.yemotBedReservation.findMany({
      where: { status: "מאושר" },
      select: {
        personalCode: true,
        weekKey: true,
        source: true,
        date: true,
        raw: true,
      },
    }),
    prisma.student.findMany({
      where: { year: activeYear, archived: false },
      select: { personalCode: true, registeredEshel: true },
    }),
    prisma.yemotCreditCard.findMany({
      where: { status: "מאושר" },
      select: { personalCode: true, amount: true },
    }),
    loadCancellations(),
  ]);

  // Drop cancellation rows + weeks a cancellation voided.
  const reservations = reservationsRaw.filter((r) =>
    isLiveBooking(r, cancellations)
  );

  // Selectable weeks (latest booking date per week key), newest first.
  const weekLatest = new Map<string, number>();
  const weekRepr = new Map<string, string>();
  for (const r of reservations) {
    const dk = dateKey(r.date);
    if (dk >= (weekLatest.get(r.weekKey) ?? 0)) {
      weekLatest.set(r.weekKey, dk);
      weekRepr.set(r.weekKey, shortDate(r.date) || r.weekKey);
    }
  }
  const weeks: BedGroupWeek[] = [...weekLatest.keys()]
    .sort((a, b) => (weekLatest.get(b) ?? 0) - (weekLatest.get(a) ?? 0))
    .map((wk) => ({ weekKey: wk, label: weekRepr.get(wk) ?? wk }));
  const selectedWeek =
    weekKey && weekLatest.has(weekKey) ? weekKey : weeks[0]?.weekKey ?? null;
  const bookedThisWeekCodes = new Set(
    reservations
      .filter((r) => r.weekKey === selectedWeek)
      .map((r) => r.personalCode)
  );

  const eshelByCode = new Map(
    students.map((s) => [s.personalCode, s.registeredEshel])
  );
  const paymentByCode = new Map<string, number>();
  for (const c of charges) {
    if (!c.amount) continue;
    paymentByCode.set(
      c.personalCode,
      (paymentByCode.get(c.personalCode) ?? 0) + c.amount
    );
  }

  // Per student: how many bookings in each group + their latest booking date.
  const perStudent = new Map<
    string,
    { counts: Map<string, number>; latest: number }
  >();
  for (const r of reservations) {
    const g = rawGroup(r.raw);
    const s =
      perStudent.get(r.personalCode) ??
      { counts: new Map<string, number>(), latest: 0 };
    s.counts.set(g, (s.counts.get(g) ?? 0) + 1);
    const dk = dateKey(r.date);
    if (dk > s.latest) s.latest = dk;
    perStudent.set(r.personalCode, s);
  }

  const groupOrder = (g: string) => {
    const n = parseInt(g, 10);
    return Number.isFinite(n) ? n : 9999;
  };

  const rowMap = new Map<string, BedGroupRow>();
  const ensure = (g: string): BedGroupRow => {
    let row = rowMap.get(g);
    if (!row) {
      row = {
        group: g,
        students: 0,
        subscribers: 0,
        nonSubscribers: 0,
        notInRoster: 0,
        alsoInOtherGroup: 0,
        payment: 0,
        bookedThisWeek: 0,
      };
      rowMap.set(g, row);
    }
    return row;
  };

  let crossGroupStudents = 0;
  for (const [code, s] of perStudent) {
    // Primary group: most bookings, then latest, then lower group number.
    let primary = "";
    let best = -1;
    for (const [g, cnt] of s.counts) {
      if (cnt > best || (cnt === best && groupOrder(g) < groupOrder(primary))) {
        best = cnt;
        primary = g;
      }
    }
    const multi = s.counts.size > 1;
    if (multi) crossGroupStudents++;

    const row = ensure(primary);
    row.students++;
    if (multi) row.alsoInOtherGroup++;
    const eshel = eshelByCode.get(code);
    if (eshel === undefined) row.notInRoster++;
    else if (eshel === true) {
      row.subscribers++;
      // "regulars" who actually booked the selected week
      if (bookedThisWeekCodes.has(code)) row.bookedThisWeek++;
    } else row.nonSubscribers++;
    row.payment += paymentByCode.get(code) ?? 0;
  }

  const rows = [...rowMap.values()].sort(
    (a, b) => groupOrder(a.group) - groupOrder(b.group)
  );
  const totals = rows.reduce(
    (t, r) => ({
      students: t.students + r.students,
      subscribers: t.subscribers + r.subscribers,
      nonSubscribers: t.nonSubscribers + r.nonSubscribers,
      notInRoster: t.notInRoster + r.notInRoster,
      payment: t.payment + r.payment,
      bookedThisWeek: t.bookedThisWeek + r.bookedThisWeek,
    }),
    {
      students: 0,
      subscribers: 0,
      nonSubscribers: 0,
      notInRoster: 0,
      payment: 0,
      bookedThisWeek: 0,
    }
  );

  return { rows, totals, crossGroupStudents, weeks, selectedWeek };
}
