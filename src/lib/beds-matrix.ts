/**
 * Build the student × week bed-reservation matrix shown on /yemot/beds.
 * Extracted so the page and the Excel export derive the exact same data
 * from the same filters (year scope, date range, "booked but not registered").
 */
import { prisma } from "./prisma";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";

export type BedCell = {
  status: "approved" | "outofstock" | null;
  date: string | null;
  manual: boolean; // the winning reservation was entered by hand (source="manual")
};

export type BedWeek = {
  weekKey: string;
  latestDate: string | null;
  hebDate: string | null;
};

export type BedRow = {
  code: string;
  name: string;
  yeshiva: string;
  shiur: string | null;
  registeredEshel: boolean | null;
  approvedCount: number;
  fromRoster: boolean;
};

export type BedsMatrix = {
  weeks: BedWeek[];
  rows: BedRow[];
  cells: Map<string, Map<string, BedCell>>;
  totalByWeek: Record<string, number>;
  grandTotal: number;
  reservationCount: number;
};

/** Parse "dd/mm/yyyy" (Yemot's date format) into a JS Date. Null on bad input. */
export function parseDmyLocal(d: string | null | undefined): Date | null {
  if (!d) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

/** Convert "dd/mm/yyyy" to a sortable numeric key. */
export function dateKey(d: string | null | undefined): number {
  if (!d) return 0;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return 0;
  return parseInt(m[3] + m[2] + m[1], 10);
}

/** Turn "dd/mm/yyyy" into "dd/mm/yy". */
export function shortDate(d: string | null | undefined): string {
  if (!d) return "";
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[1]}/${m[2]}/${m[3].slice(-2)}` : d;
}

export async function loadBedsMatrix(opts: {
  activeYear: string;
  scope: "year" | "all";
  filter: "" | "not-registered";
  from: Date | null;
  to: Date | null;
  q?: string;
}): Promise<BedsMatrix> {
  const { activeYear, scope, filter, from, to } = opts;

  const [reservationsRaw, students, cancellations] = await Promise.all([
    prisma.yemotBedReservation.findMany({
      orderBy: [{ weekKey: "asc" }, { personalCode: "asc" }],
    }),
    prisma.student.findMany({
      where: { year: activeYear, archived: false },
      select: {
        id: true,
        personalCode: true,
        firstName: true,
        lastName: true,
        yeshiva: true,
        shiur: true,
        registeredEshel: true,
      },
    }),
    loadCancellations(),
  ]);

  const yearCodes = new Set(students.map((s) => s.personalCode));
  const reservations = reservationsRaw.filter((r) => {
    // Cancellation rows aren't bookings; a cancelled week is voided.
    if (!isLiveBooking(r, cancellations)) return false;
    if (scope === "year" && !yearCodes.has(r.personalCode)) return false;
    if (from || to) {
      const d = parseDmyLocal(r.date);
      if (!d) return false;
      if (from && d < from) return false;
      if (to) {
        const endOfDay = new Date(to.getTime() + 24 * 3600 * 1000 - 1);
        if (d > endOfDay) return false;
      }
    }
    return true;
  });

  // Representative date per week = latest approved reservation's date.
  const weekMeta = new Map<
    string,
    { latestDate: string | null; hebDate: string | null }
  >();
  for (const r of reservations) {
    if (r.status !== "מאושר") continue;
    const cur = weekMeta.get(r.weekKey);
    if (!cur || dateKey(r.date) > dateKey(cur.latestDate)) {
      weekMeta.set(r.weekKey, { latestDate: r.date, hebDate: r.hebDate ?? null });
    }
  }
  const weeks: BedWeek[] = Array.from(weekMeta.entries())
    .sort((a, b) => dateKey(a[1].latestDate) - dateKey(b[1].latestDate))
    .map(([weekKey, meta]) => ({ weekKey, ...meta }));

  // Cells per student × week.
  const cells = new Map<string, Map<string, BedCell>>();
  for (const r of reservations) {
    const s = cells.get(r.personalCode) ?? new Map<string, BedCell>();
    const existing = s.get(r.weekKey);
    let cell: BedCell = {
      status: null,
      date: r.date,
      manual: r.source === "manual",
    };
    if (r.status === "מאושר") cell.status = "approved";
    else if (r.status === "אזל") cell.status = "outofstock";
    if (existing) {
      if (existing.status === "approved") cell = existing;
      else if (cell.status === null && dateKey(r.date) < dateKey(existing.date))
        cell = existing;
    }
    s.set(r.weekKey, cell);
    cells.set(r.personalCode, s);
  }

  const countApproved = (code: string): number => {
    const c = cells.get(code);
    if (!c) return 0;
    let n = 0;
    for (const w of weeks) if (c.get(w.weekKey)?.status === "approved") n++;
    return n;
  };

  const byCode = new Map(students.map((s) => [s.personalCode, s]));
  const rows: BedRow[] = [];
  for (const s of students) {
    rows.push({
      code: s.personalCode,
      name: `${s.lastName} ${s.firstName}`,
      yeshiva: s.yeshiva,
      shiur: s.shiur,
      registeredEshel: s.registeredEshel,
      approvedCount: countApproved(s.personalCode),
      fromRoster: true,
    });
  }
  const extra = new Set<string>();
  for (const r of reservations) {
    if (!byCode.has(r.personalCode) && !extra.has(r.personalCode)) {
      extra.add(r.personalCode);
      rows.push({
        code: r.personalCode,
        name: r.name ?? "(לא ידוע)",
        yeshiva: r.branch ?? "",
        shiur: r.className ?? null,
        registeredEshel: null,
        approvedCount: countApproved(r.personalCode),
        fromRoster: false,
      });
    }
  }

  let filtered =
    filter === "not-registered"
      ? rows.filter((r) => r.approvedCount > 0 && r.registeredEshel === false)
      : rows;
  const needle = (opts.q ?? "").trim();
  if (needle) {
    filtered = filtered.filter(
      (r) => r.name.includes(needle) || r.code.includes(needle)
    );
  }
  filtered.sort((a, b) =>
    `${a.yeshiva}${a.name}`.localeCompare(`${b.yeshiva}${b.name}`, "he")
  );

  const totalByWeek: Record<string, number> = {};
  for (const w of weeks) totalByWeek[w.weekKey] = 0;
  for (const row of filtered) {
    const c = cells.get(row.code);
    if (!c) continue;
    for (const w of weeks) if (c.get(w.weekKey)?.status === "approved") totalByWeek[w.weekKey]++;
  }
  const grandTotal = Object.values(totalByWeek).reduce((a, b) => a + b, 0);

  return {
    weeks,
    rows: filtered,
    cells,
    totalByWeek,
    grandTotal,
    reservationCount: reservations.length,
  };
}
