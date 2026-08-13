/**
 * Representatives paid by the fund. "yeshiva" reps have a monthly-payment grid
 * (one ₪ amount per Hebrew month of the fiscal year, stored as a JSON map on
 * the row). The month list is leap-aware — תשפ"ז has both Adar I and Adar II.
 */
import { HDate } from "@hebcal/core";
import { prisma } from "./prisma";
import { hebYearFromLabel } from "./hebrew-calendar";

export type HebMonth = { key: string; label: string };

/** The Hebrew months of a fiscal year, in civil (Tishrei-first) order, with a
 *  stable key per month. Leap years split Adar into א׳/ב׳ (13 months). */
export function fiscalMonths(yearLabel: string): HebMonth[] {
  const leap = HDate.isLeapYear(hebYearFromLabel(yearLabel));
  const adar: HebMonth[] = leap
    ? [
        { key: "adar1", label: "אדר א׳" },
        { key: "adar2", label: "אדר ב׳" },
      ]
    : [{ key: "adar", label: "אדר" }];
  return [
    { key: "tishrei", label: "תשרי" },
    { key: "cheshvan", label: "חשון" },
    { key: "kislev", label: "כסלו" },
    { key: "tevet", label: "טבת" },
    { key: "shvat", label: "שבט" },
    ...adar,
    { key: "nisan", label: "ניסן" },
    { key: "iyar", label: "אייר" },
    { key: "sivan", label: "סיון" },
    { key: "tamuz", label: "תמוז" },
    { key: "av", label: "אב" },
    { key: "elul", label: "אלול" },
  ];
}

export function parseAmounts(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v);
      if (Number.isFinite(n) && n !== 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export type RepRow = {
  id: string;
  name: string;
  yeshiva: string | null;
  note: string | null;
  amounts: Record<string, number>;
  total: number;
};

export async function loadReps(year: string, kind: string): Promise<RepRow[]> {
  const reps = await prisma.representative.findMany({
    where: { year, kind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return reps.map((r) => {
    const amounts = parseAmounts(r.amounts);
    return {
      id: r.id,
      name: r.name,
      yeshiva: r.yeshiva,
      note: r.note,
      amounts,
      total: Object.values(amounts).reduce((a, n) => a + n, 0),
    };
  });
}

/** Total ₪ paid to representatives of the given kinds this year (an expense). */
export async function loadRepsTotal(year: string, kinds: string[]): Promise<number> {
  const reps = await prisma.representative.findMany({
    where: { year, kind: { in: kinds } },
    select: { amounts: true },
  });
  let total = 0;
  for (const r of reps) {
    const a = parseAmounts(r.amounts);
    for (const v of Object.values(a)) total += v;
  }
  return total;
}

// ---- Overseas (חול) reps: each has a list of donations (income) ----

export type ChulRepSummary = {
  id: string;
  name: string;
  count: number;
  total: number; // Σ ₪
};

export async function loadChulReps(year: string): Promise<ChulRepSummary[]> {
  const reps = await prisma.representative.findMany({
    where: { year, kind: "chul" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const ids = reps.map((r) => r.id);
  const sums = ids.length
    ? await prisma.chulDonation.groupBy({
        by: ["repId"],
        where: { repId: { in: ids } },
        _sum: { ils: true },
        _count: { _all: true },
      })
    : [];
  const byRep = new Map(
    sums.map((s) => [s.repId, { total: s._sum.ils ?? 0, count: s._count._all }])
  );
  return reps.map((r) => ({
    id: r.id,
    name: r.name,
    count: byRep.get(r.id)?.count ?? 0,
    total: byRep.get(r.id)?.total ?? 0,
  }));
}

/** Total ₪ collected by all overseas reps this year (income). */
export async function loadChulTotal(year: string): Promise<number> {
  const reps = await prisma.representative.findMany({
    where: { year, kind: "chul" },
    select: { id: true },
  });
  const ids = reps.map((r) => r.id);
  if (!ids.length) return 0;
  const agg = await prisma.chulDonation.aggregate({
    where: { repId: { in: ids } },
    _sum: { ils: true },
  });
  return agg._sum.ils ?? 0;
}

export type DonationRow = {
  id: string;
  donor: string;
  date: string | null;
  usd: number;
  rate: number | null;
  ils: number;
  notes: string | null;
};

export async function loadChulRep(id: string): Promise<{
  rep: { id: string; name: string };
  donations: DonationRow[];
  total: number;
} | null> {
  const rep = await prisma.representative.findUnique({
    where: { id },
    include: {
      donations: {
        orderBy: [{ sortOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!rep) return null;
  const donations: DonationRow[] = rep.donations.map((d) => ({
    id: d.id,
    donor: d.donor,
    date: d.date ? d.date.toISOString().slice(0, 10) : null,
    usd: d.usd,
    rate: d.rate,
    ils: d.ils,
    notes: d.notes,
  }));
  return {
    rep: { id: rep.id, name: rep.name },
    donations,
    total: donations.reduce((a, d) => a + d.ils, 0),
  };
}
