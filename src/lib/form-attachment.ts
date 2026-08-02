/**
 * Attach Nedarim Plus form submissions to Students.
 *
 * A form submission's `Kod_1` field is the student's personalCode; its
 * `TransactionId` field is the Nedarim הוראת קבע number, which equals the
 * `kevaId` on future NedarimTransaction rows (verified: form.TransactionId
 * = transaction.kevaId across the 1,185 submissions we already have).
 *
 * The year each submission belongs to comes from the raw `Snif1` field
 * (e.g. "תשפ״ו" / "תשפ״ז") — a single Nedarim form (like tofesId 651) can
 * be reused across school years, so we route each submission to its own
 * year instead of blanket-tagging every row with the form config's label.
 *
 * The attach step does two things per submission:
 *   1. Sets Student.nedarimHook = form.TransactionId  (so future transactions
 *      auto-attribute themselves via the existing kevaId lookup).
 *   2. Sets Student.registeredEshel = true  (paying via a form implies bed
 *      service is booked).
 *
 * Idempotent — safe to re-run after every sync.
 */
import { prisma } from "./prisma";
import { getActiveYear } from "./year";
import { parseNedarimDate } from "./nedarim";

export interface AttachResult {
  scanned: number;
  matched: number;
  hookSet: number;
  hookChanged: number;
  eshelFlipped: number;
  noCode: number;
  unmatched: number;
  /** Rows whose `submittedAt` was NULL and we backfilled from raw's
   *  `CreatedDate`. Not an error condition — just visibility. */
  datesBackfilled: number;
  /** kevaId rows (transactions + student.nedarimHook) that had a stray
   *  leading "-" stripped this run. */
  kevaDashesStripped: number;
  /** Students whose (year != form.Snif1 for the same hook) — leftovers
   *  from the old attach code that keyed on the form config label
   *  instead of per-submission year. Cleared nedarimHook + eshel. */
  misattributionsFixed: number;
  /** Breakdown of matched-vs-unmatched per school year (whatever appeared
   *  in Snif1 or fell back to config/active year). */
  perYear: Array<{
    year: string;
    scanned: number;
    matched: number;
    unmatched: number;
  }>;
}

const CODE_FIELD = "Kod_1";
const HOOK_FIELD = "TransactionId";
/** Field on each submission that names the school year. Nedarim's payment
 *  form saves it here — verified for tofes 651. */
const YEAR_FIELD = "Snif1";
const PRICE_FIELD = "TashlumAmount";
const PAYMENTS_FIELD = "Tashlumim";
const END_DATE_FIELD = "Time_1";
/** Ari/Chul (Israel vs abroad). Nedarim stores it in `TypeCuty` as
 *  "אר״י" / "חו״ל" (with gershayim); the app's select uses the bare
 *  "ארי" / "חול". Verified against 400 submissions. */
const ARICHUL_FIELD = "TypeCuty";
/** Phone the parent typed on the form (Nedarim's `Tel`). Copied to the
 *  matched student's Parent.phone so the roster keeps the latest number. */
const PHONE_FIELD = "Tel";
const PAYMENT_METHOD_HOOK = "נדרים פלוס";

/** Normalize TypeCuty → the app's canonical "ארי" / "חול" (strip quote
 *  marks). Returns null for anything else so we never copy garbage. */
function normalizeAriChul(raw: unknown): string | null {
  const v = String(raw ?? "")
    .replace(/["'׳״]/g, "")
    .trim();
  return v === "ארי" || v === "חול" ? v : null;
}

/** Parse an integer, returning null on any garbage input. */
function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : Math.round(n);
}

export async function attachFormsToStudents(
  opts: {
    tofesId?: string;
    fallbackYear?: string;
  } = {}
): Promise<AttachResult> {
  const activeYear = opts.fallbackYear ?? (await getActiveYear());

  // One-shot cleanup: strip stray leading "-" that Nedarim sometimes emits
  // on kevaId. It causes hooks to fail matching against Student.nedarimHook.
  // Runs before the attach loop so a fresh sync ends up self-healing.
  const kevaDashesStripped = await stripDashedKevaIds();

  const [submissions, configs] = await Promise.all([
    prisma.nedarimFormSubmission.findMany({
      where: opts.tofesId ? { tofesId: opts.tofesId } : undefined,
      orderBy: { submittedAt: "asc" },
    }),
    prisma.nedarimFormConfig.findMany({}),
  ]);
  const configByTofes = new Map(configs.map((c) => [c.tofesId, c]));

  // Plans are keyed by (year, code) — a person can legitimately appear in
  // both תשפ"ו and תשפ"ז with the same code but a different hook, and each
  // year's record deserves its own attachment.
  type Plan = {
    code: string;
    year: string;
    hook: string;
    price: number | null;
    paymentsCount: number | null;
    endDateLabel: string | null;
    ariChul: string | null;
    phone: string | null;
  };
  const planByYearCode = new Map<string, Plan>();
  const perYearScanned = new Map<string, number>();
  const stats = { scanned: 0, noCode: 0, datesBackfilled: 0 };

  for (const s of submissions) {
    stats.scanned++;
    let obj: Record<string, unknown> = {};
    try {
      obj = JSON.parse(s.raw);
    } catch {
      continue;
    }

    // Opportunistic date backfill — the original sync only checked Date /
    // SubmittedAt / CreatedAt, but Nedarim actually uses `CreatedDate`.
    // Existing rows have the correct value in `raw` and just need to be
    // hoisted out to the top-level column.
    if (!s.submittedAt) {
      const d =
        parseNedarimDate(obj.CreatedDate) ??
        parseNedarimDate(obj.Date) ??
        parseNedarimDate(obj.SubmittedAt) ??
        parseNedarimDate(obj.CreatedAt);
      if (d) {
        await prisma.nedarimFormSubmission.update({
          where: { id: s.id },
          data: { submittedAt: d },
        });
        stats.datesBackfilled++;
      }
    }

    const code = String(obj[CODE_FIELD] ?? "").trim();
    const hook = String(obj[HOOK_FIELD] ?? "").trim();
    if (!code) {
      stats.noCode++;
      continue;
    }

    // Priority for the year of this submission:
    //   1. What the form itself says (Snif1)
    //   2. The form config's label (usually the current school year)
    //   3. The globally-active year
    const cfg = configByTofes.get(s.tofesId);
    const submissionYear = String(obj[YEAR_FIELD] ?? "").trim();
    const cfgYear = (cfg?.label ?? "").trim();
    const year = submissionYear || cfgYear || activeYear;

    perYearScanned.set(year, (perYearScanned.get(year) ?? 0) + 1);
    // Last submission for the same (year, code) wins.
    planByYearCode.set(`${year}|${code}`, {
      code,
      year,
      hook,
      price: toInt(obj[PRICE_FIELD]),
      paymentsCount: toInt(obj[PAYMENTS_FIELD]),
      endDateLabel:
        String(obj[END_DATE_FIELD] ?? "").trim() || null,
      ariChul: normalizeAriChul(obj[ARICHUL_FIELD]),
      phone: String(obj[PHONE_FIELD] ?? "").trim() || null,
    });
  }

  if (planByYearCode.size === 0) {
    return {
      scanned: stats.scanned,
      matched: 0,
      hookSet: 0,
      hookChanged: 0,
      eshelFlipped: 0,
      noCode: stats.noCode,
      unmatched: 0,
      datesBackfilled: stats.datesBackfilled,
      kevaDashesStripped,
      misattributionsFixed: 0,
      perYear: [],
    };
  }

  // Misattribution cleanup runs BEFORE the forward attach so the forward
  // pass gets to re-establish anything that turns out to be legitimate.
  // (Previous ordering — cleanup after forward — cleared eshel on students
  // whose current-year form had no hook but who had a stale wrong-year
  // hook + eshel from a pre-Snif attach run.)
  const correctByHookPre = new Map<string, { year: string; code: string }>();
  for (const plan of planByYearCode.values()) {
    if (plan.hook) correctByHookPre.set(plan.hook, { year: plan.year, code: plan.code });
  }
  let misattributionsFixed = 0;
  if (correctByHookPre.size > 0) {
    const stragglers = await prisma.student.findMany({
      where: { nedarimHook: { in: [...correctByHookPre.keys()] } },
      select: { id: true, year: true, personalCode: true, nedarimHook: true },
    });
    for (const s of stragglers) {
      const correct = correctByHookPre.get(s.nedarimHook!);
      if (!correct) continue;
      if (correct.year !== s.year || correct.code !== s.personalCode) {
        await prisma.student.update({
          where: { id: s.id },
          data: { nedarimHook: null, registeredEshel: false },
        });
        misattributionsFixed++;
      }
    }
  }

  // Bulk load: fetch every candidate student in one query, then filter per
  // plan.  We ask for the exact (year, personalCode) tuples so we don't
  // over-fetch.
  const uniqueYears = [...new Set([...planByYearCode.values()].map((p) => p.year))];
  const uniqueCodes = [...new Set([...planByYearCode.values()].map((p) => p.code))];
  const candidates = await prisma.student.findMany({
    where: {
      year: { in: uniqueYears },
      personalCode: { in: uniqueCodes },
    },
    select: {
      id: true,
      year: true,
      personalCode: true,
      nedarimHook: true,
      registeredEshel: true,
      price: true,
      paymentMethod: true,
      paymentsCount: true,
      endDateLabel: true,
      ariChul: true,
      parentId: true,
      parent: { select: { phone: true } },
    },
  });
  const byYearCode = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) byYearCode.set(`${c.year}|${c.personalCode}`, c);

  let matched = 0,
    hookSet = 0,
    hookChanged = 0,
    eshelFlipped = 0,
    unmatched = 0;
  const perYearMatched = new Map<string, number>();

  for (const plan of planByYearCode.values()) {
    const student = byYearCode.get(`${plan.year}|${plan.code}`);
    if (!student) {
      unmatched++;
      continue;
    }
    matched++;
    perYearMatched.set(plan.year, (perYearMatched.get(plan.year) ?? 0) + 1);

    const updates: {
      nedarimHook?: string;
      registeredEshel?: boolean;
      price?: number;
      paymentMethod?: string;
      paymentsCount?: number;
      endDateLabel?: string;
      ariChul?: string;
    } = {};
    if (plan.hook) {
      if (!student.nedarimHook) {
        updates.nedarimHook = plan.hook;
        hookSet++;
      } else if (student.nedarimHook !== plan.hook) {
        updates.nedarimHook = plan.hook;
        hookChanged++;
      }
    }
    if (!student.registeredEshel) {
      updates.registeredEshel = true;
      eshelFlipped++;
    }
    // Copy pricing fields from the form. Overwrite when the form has a
    // fresh value — the form is the source of truth for these. Never
    // clear a filled-in student field with a form-side blank.
    if (plan.price !== null && plan.price !== student.price) {
      updates.price = plan.price;
    }
    if (
      plan.paymentsCount !== null &&
      plan.paymentsCount !== student.paymentsCount
    ) {
      updates.paymentsCount = plan.paymentsCount;
    }
    if (plan.endDateLabel && plan.endDateLabel !== student.endDateLabel) {
      updates.endDateLabel = plan.endDateLabel;
    }
    // Ari/Chul from the form (normalized). Overwrite when the form has a
    // clean value — it's the parent's own declaration and also repairs the
    // inconsistently-quoted legacy values ("אר״י" → "ארי").
    if (plan.ariChul && plan.ariChul !== student.ariChul) {
      updates.ariChul = plan.ariChul;
    }
    if (student.paymentMethod !== PAYMENT_METHOD_HOOK) {
      updates.paymentMethod = PAYMENT_METHOD_HOOK;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.student.update({
        where: { id: student.id },
        data: updates,
      });
    }
    // Copy the phone the parent typed on the form (Tel) onto the Parent row.
    if (plan.phone && student.parentId && plan.phone !== student.parent?.phone) {
      await prisma.parent.update({
        where: { id: student.parentId },
        data: { phone: plan.phone },
      });
    }
  }

  const perYear = [...perYearScanned.entries()]
    .map(([year, scanned]) => {
      const m = perYearMatched.get(year) ?? 0;
      return { year, scanned, matched: m, unmatched: scanned - m };
    })
    .sort((a, b) => b.scanned - a.scanned);

  return {
    scanned: stats.scanned,
    matched,
    hookSet,
    hookChanged,
    eshelFlipped,
    noCode: stats.noCode,
    unmatched,
    datesBackfilled: stats.datesBackfilled,
    kevaDashesStripped,
    misattributionsFixed,
    perYear,
  };
}

/**
 * Walk NedarimTransaction + Student.nedarimHook, strip a leading "-" from
 * any value that has one, and return how many rows were fixed. Idempotent.
 */
async function stripDashedKevaIds(): Promise<number> {
  const badTx = await prisma.nedarimTransaction.findMany({
    where: { kevaId: { startsWith: "-" } },
    select: { id: true, kevaId: true },
  });
  const badStudents = await prisma.student.findMany({
    where: { nedarimHook: { startsWith: "-" } },
    select: { id: true, nedarimHook: true },
  });
  for (const t of badTx) {
    await prisma.nedarimTransaction.update({
      where: { id: t.id },
      data: { kevaId: (t.kevaId ?? "").replace(/^-/, "") },
    });
  }
  for (const s of badStudents) {
    await prisma.student.update({
      where: { id: s.id },
      data: { nedarimHook: (s.nedarimHook ?? "").replace(/^-/, "") },
    });
  }
  return badTx.length + badStudents.length;
}
