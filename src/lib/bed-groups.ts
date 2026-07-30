/**
 * Bed report grouped by "קבוצה" (the CutList8 field on each Yemot booking).
 *
 * A student can book across several groups (≈320 of them do), so counting per
 * group naively double-counts people. To keep every head-count additive, each
 * student is assigned to ONE primary group (most bookings, ties → latest, then
 * lower group number).
 *
 * Money is different: the clearing amount is the per-bed fee "סכום לתשלום"
 * (column X of the שלוחה-1 report — small amounts like 3/60/65 ₪), NOT the
 * one-time אש״ל registration. It's summed per SELECTED WEEK and attributed to
 * the booking's own CutList8, matching the office's report. It only appears in
 * a booking's raw once the payment has come in, so recent weeks need a fresh
 * sync to show it.
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
  bookedThisWeek: number; // subscribers ("regulars") who booked the selected week
  payment: number; // ₪ — סכום לתשלום for this group's bookings in the selected week
};

export type BedGroupWeek = { weekKey: string; label: string };

export type WeeklyDetailRow = {
  weekKey: string;
  label: string;
  bookings: number; // live bookings that week for the detail group
  payment: number; // ₪ — סכום לתשלום that week for the detail group
};

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
  crossGroupStudents: number;
  weeks: BedGroupWeek[]; // selectable weeks (newest first)
  selectedWeek: string | null;
  groups: string[]; // every group id, for the weekly-detail picker
  detailGroup: string | null; // which group the weekly breakdown is for
  weeklyDetail: WeeklyDetailRow[]; // per-week bookings + clearing for detailGroup
  detailTotals: { bookings: number; payment: number };
};

/** Parse a booking's group (CutList8) and per-bed fee (סכום לתשלום) from raw. */
function parseRaw(raw: string): { group: string; pay: number } {
  try {
    const o = JSON.parse(raw);
    const g = o?.CutList8;
    const group = (g == null ? "" : String(g).trim()) || "(ללא קבוצה)";
    const p = parseFloat(String(o?.["סכום לתשלום"] ?? "").trim());
    return { group, pay: Number.isFinite(p) ? p : 0 };
  } catch {
    return { group: "(ללא קבוצה)", pay: 0 };
  }
}

const groupOrder = (g: string) => {
  const n = parseInt(g, 10);
  return Number.isFinite(n) ? n : 9999;
};

export async function loadBedGroupReport(
  activeYear: string,
  weekKey?: string,
  detailGroupArg?: string
): Promise<BedGroupReport> {
  const [reservationsRaw, students, cancellations] = await Promise.all([
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
    loadCancellations(),
  ]);

  const reservations = reservationsRaw.filter((r) =>
    isLiveBooking(r, cancellations)
  );

  // Decorate each booking with its group + fee once.
  const parsed = reservations.map((r) => ({ ...r, ...parseRaw(r.raw) }));

  // Selectable weeks (latest booking date per week key), newest first.
  const weekLatest = new Map<string, number>();
  const weekRepr = new Map<string, string>();
  for (const r of parsed) {
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
    parsed.filter((r) => r.weekKey === selectedWeek).map((r) => r.personalCode)
  );
  // Selected-week clearing, attributed to each booking's own group.
  const weekPaymentByGroup = new Map<string, number>();
  for (const r of parsed) {
    if (r.weekKey !== selectedWeek || !r.pay) continue;
    weekPaymentByGroup.set(r.group, (weekPaymentByGroup.get(r.group) ?? 0) + r.pay);
  }

  const eshelByCode = new Map(
    students.map((s) => [s.personalCode, s.registeredEshel])
  );

  // Per student: bookings per group + latest booking date → primary group.
  const perStudent = new Map<
    string,
    { counts: Map<string, number>; latest: number }
  >();
  for (const r of parsed) {
    const s =
      perStudent.get(r.personalCode) ??
      { counts: new Map<string, number>(), latest: 0 };
    s.counts.set(r.group, (s.counts.get(r.group) ?? 0) + 1);
    const dk = dateKey(r.date);
    if (dk > s.latest) s.latest = dk;
    perStudent.set(r.personalCode, s);
  }

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
        bookedThisWeek: 0,
        payment: 0,
      };
      rowMap.set(g, row);
    }
    return row;
  };

  let crossGroupStudents = 0;
  for (const [code, s] of perStudent) {
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
      if (bookedThisWeekCodes.has(code)) row.bookedThisWeek++;
    } else row.nonSubscribers++;
  }

  // Attach each group's selected-week clearing (by the booking's own group).
  for (const g of weekPaymentByGroup.keys()) ensure(g);
  for (const row of rowMap.values()) {
    row.payment = weekPaymentByGroup.get(row.group) ?? 0;
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

  // Weekly breakdown for one group (defaults to 23 — the casual-bookers group).
  const groups = [...new Set(parsed.map((r) => r.group))].sort(
    (a, b) => groupOrder(a) - groupOrder(b)
  );
  const detailGroup =
    detailGroupArg && groups.includes(detailGroupArg)
      ? detailGroupArg
      : groups.includes("23")
      ? "23"
      : groups[0] ?? null;

  const detailByWeek = new Map<string, { bookings: number; payment: number }>();
  for (const r of parsed) {
    if (r.group !== detailGroup) continue;
    const d = detailByWeek.get(r.weekKey) ?? { bookings: 0, payment: 0 };
    d.bookings++;
    d.payment += r.pay;
    detailByWeek.set(r.weekKey, d);
  }
  const weeklyDetail: WeeklyDetailRow[] = weeks
    .filter((w) => detailByWeek.has(w.weekKey))
    .map((w) => ({
      weekKey: w.weekKey,
      label: w.label,
      bookings: detailByWeek.get(w.weekKey)!.bookings,
      payment: detailByWeek.get(w.weekKey)!.payment,
    }));
  const detailTotals = weeklyDetail.reduce(
    (t, w) => ({ bookings: t.bookings + w.bookings, payment: t.payment + w.payment }),
    { bookings: 0, payment: 0 }
  );

  return {
    rows,
    totals,
    crossGroupStudents,
    weeks,
    selectedWeek,
    groups,
    detailGroup,
    weeklyDetail,
    detailTotals,
  };
}
