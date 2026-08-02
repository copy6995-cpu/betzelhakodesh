/**
 * Yemot HaMashiach (call2all) API client. This is the same integration the
 * user had running as a Google Apps Script (`betzila_sync.gs`) — we bring
 * it into the app so beds can be viewed alongside students and payments.
 *
 * Token format: the full 3-part JWT string generated from Yemot's admin
 * panel (הגדרות מערכת → הרשאות → API). Looks like:
 *   "WU1BUElL.apik_XXXXXXXXXXX.YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
 * The old "system:password" form is NOT accepted — you need the full JWT.
 * Endpoints used:
 *   - GetIVR2Dir       — list files in an IVR folder
 *   - RenderYMGRFile   — convert a .ymgr file to JSON
 *
 * Files we care about are named ApprovalAll.YYYY-WW.ymgr (weekly bed
 * reservation approvals). Each row inside has these Hebrew keys:
 *   מספר זיהוי, שם מזהה, מצב הזמנה, תאריך, גזירה חמישית, גזירה שישית, תאריך עברי
 */
import { prisma } from "./prisma";

const API_BASE = "https://www.call2all.co.il/ym/api/";

export type YemotToken = string;

export async function getToken(): Promise<YemotToken | null> {
  // .env wins so the user can pin the token in a text file and rotate by
  // editing there. Falls back to the DB (from the UI) otherwise.
  const envToken = (process.env.YEMOT_TOKEN ?? "").trim();
  if (envToken) return envToken;
  const s = await prisma.appSetting.findUnique({
    where: { key: "yemot_token" },
  });
  return s?.value ?? null;
}

/** True when YEMOT_TOKEN is set in .env (UI edits won't override). */
export function tokenFromEnv(): boolean {
  return !!(process.env.YEMOT_TOKEN ?? "").trim();
}

export async function saveToken(token: string): Promise<void> {
  const t = token.trim();
  if (t.split(".").length < 3)
    throw new Error(
      'פורמט טוקן שגוי — הטוקן המלא מפאנל ימות (3 חלקים המופרדים בנקודות)'
    );
  await prisma.appSetting.upsert({
    where: { key: "yemot_token" },
    update: { value: t },
    create: { key: "yemot_token", value: t },
  });
}

async function apiCall(
  fn: string,
  params: Record<string, string>
): Promise<unknown> {
  const body = new URLSearchParams(params);
  const res = await fetch(API_BASE + fn, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Yemot ${fn}: HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Yemot ${fn}: non-JSON — ${text.slice(0, 200)}`);
  }
}

/**
 * List all ApprovalAll.YYYY-WW.ymgr files in a folder. Tries both "ivr2:X"
 * and "ivr2:/X" because Yemot accepts either. Returns { base, weeks[] }.
 */
export async function listWeeks(opts: {
  token: string;
  path: string;
}): Promise<{ base: string; weeks: string[] }> {
  const candidates = [opts.path, opts.path.replace(/^ivr2:/, "ivr2:/")];
  for (const p of candidates) {
    const o = (await apiCall("GetIVR2Dir", {
      token: opts.token,
      path: p,
    })) as { responseStatus?: string; files?: Array<{ name?: string }>; message?: string };
    if (o && o.responseStatus === "OK" && Array.isArray(o.files)) {
      const weeks = new Set<string>();
      for (const f of o.files) {
        const m = (f?.name ?? "").match(/^ApprovalAll\.(\d{4}-\d{2})\.ymgr$/);
        if (m) weeks.add(m[1]);
      }
      if (weeks.size > 0) return { base: p, weeks: [...weeks].sort() };
    }
    if (o && o.responseStatus === "EXCEPTION") {
      throw new Error(o.message ?? "שגיאה מימות המשיח");
    }
  }
  return { base: opts.path, weeks: [] };
}

type YmgrRow = Record<string, string | undefined>;

/**
 * Fetch one ApprovalAll.YYYY-WW.ymgr file's data. Batched externally.
 */
export async function fetchWeek(opts: {
  token: string;
  base: string;
  weekKey: string;
}): Promise<YmgrRow[]> {
  const wath = `${opts.base}/ApprovalAll.${opts.weekKey}.ymgr`;
  const o = (await apiCall("RenderYMGRFile", {
    token: opts.token,
    convertType: "json",
    wath,
  })) as { responseStatus?: string; data?: YmgrRow[]; message?: string };
  if (!o || o.responseStatus !== "OK") {
    // A missing week is not fatal — return empty.
    if (o?.responseStatus === "EXCEPTION" && o.message) throw new Error(o.message);
    return [];
  }
  return o.data ?? [];
}

/** Read one .ymgr file by its full name (used for cancellation files whose
 *  names carry a timestamp we can't reconstruct from a week key). */
export async function fetchApprovalFile(opts: {
  token: string;
  base: string;
  fileName: string;
}): Promise<YmgrRow[]> {
  const wath = `${opts.base}/${opts.fileName}`;
  const o = (await apiCall("RenderYMGRFile", {
    token: opts.token,
    convertType: "json",
    wath,
  })) as { responseStatus?: string; data?: YmgrRow[]; message?: string };
  if (!o || o.responseStatus !== "OK") {
    if (o?.responseStatus === "EXCEPTION" && o.message) throw new Error(o.message);
    return [];
  }
  return o.data ?? [];
}

/** List the weekly cancellation files in a שלוחה-5 folder
 *  (ApprovalOk.A-<seq>-<timestamp>.ymgr). weekKey = the stable "A-<seq>" part
 *  so re-syncs replace the same file instead of duplicating it. */
export async function listCancelFiles(opts: {
  token: string;
  path: string;
}): Promise<{ base: string; files: Array<{ name: string; weekKey: string }> }> {
  const candidates = [opts.path, opts.path.replace(/^ivr2:/, "ivr2:/")];
  for (const p of candidates) {
    const o = (await apiCall("GetIVR2Dir", {
      token: opts.token,
      path: p,
    })) as {
      responseStatus?: string;
      files?: Array<{ name?: string }>;
      message?: string;
    };
    if (o && o.responseStatus === "OK" && Array.isArray(o.files)) {
      const files: Array<{ name: string; weekKey: string }> = [];
      for (const f of o.files) {
        const name = f?.name ?? "";
        const m = name.match(/^ApprovalOk\.(A-\d+)(?:-\d+)?\.ymgr$/);
        if (m) files.push({ name, weekKey: m[1] });
      }
      if (files.length > 0) return { base: p, files };
    }
    if (o && o.responseStatus === "EXCEPTION") {
      throw new Error(o.message ?? "שגיאה מימות המשיח");
    }
  }
  return { base: opts.path, files: [] };
}

/** Sync one cancellation source: read each weekly ApprovalOk file and replace
 *  its rows. Stored as ordinary reservations under this source; because the
 *  source is marked kind="cancellation", loadCancellations() treats them as
 *  cancellations and voids the matching booking (by date, within 7 days). */
export async function syncCancellationSource(opts: {
  token: string;
  path: string;
}): Promise<{ inserted: number; files: number }> {
  const { base, files } = await listCancelFiles({
    token: opts.token,
    path: opts.path,
  });
  let inserted = 0;
  for (const f of files) {
    const rows = await fetchApprovalFile({
      token: opts.token,
      base,
      fileName: f.name,
    });
    await prisma.yemotBedReservation.deleteMany({
      where: { source: opts.path, weekKey: f.weekKey },
    });
    for (const row of rows) {
      const ok = await persistRow({ source: opts.path, weekKey: f.weekKey, row });
      if (ok) inserted++;
    }
  }
  return { inserted, files: files.length };
}

/** Upsert a single row into BedReservation. Ignored if personalCode missing. */
export async function persistRow(opts: {
  source: string;
  weekKey: string;
  row: YmgrRow;
}): Promise<boolean> {
  const code = (opts.row["מספר זיהוי"] ?? "").toString().trim();
  if (!code) return false;
  await prisma.yemotBedReservation.upsert({
    where: {
      source_weekKey_personalCode: {
        source: opts.source,
        weekKey: opts.weekKey,
        personalCode: code,
      },
    },
    create: {
      source: opts.source,
      weekKey: opts.weekKey,
      personalCode: code,
      name: opts.row["שם מזהה"] ?? null,
      status: opts.row["מצב הזמנה"] ?? null,
      date: opts.row["תאריך"] ?? null,
      className: opts.row["גזירה חמישית"] ?? null,
      branch: opts.row["גזירה שישית"] ?? null,
      hebDate: opts.row["תאריך עברי"] ?? null,
      raw: JSON.stringify(opts.row),
    },
    update: {
      name: opts.row["שם מזהה"] ?? null,
      status: opts.row["מצב הזמנה"] ?? null,
      date: opts.row["תאריך"] ?? null,
      className: opts.row["גזירה חמישית"] ?? null,
      branch: opts.row["גזירה שישית"] ?? null,
      hebDate: opts.row["תאריך עברי"] ?? null,
      raw: JSON.stringify(opts.row),
      fetchedAt: new Date(),
    },
  });
  return true;
}

/**
 * Sync a specific list of (source, weekKey) items. Deletes rows for those
 * weeks that no longer appear in the fetched data (so cancellations are
 * reflected), then inserts the fresh rows.
 */
export async function syncItems(opts: {
  token: string;
  items: Array<{ source: string; base: string; weekKey: string }>;
}): Promise<{ inserted: number; deletedWeeks: number }> {
  let inserted = 0;
  const touchedKeys = new Set<string>();

  for (const it of opts.items) {
    const rows = await fetchWeek({
      token: opts.token,
      base: it.base,
      weekKey: it.weekKey,
    });
    touchedKeys.add(`${it.source}|${it.weekKey}`);
    // Delete old rows for this (source, weekKey) so cancelled reservations are dropped.
    await prisma.yemotBedReservation.deleteMany({
      where: { source: it.source, weekKey: it.weekKey },
    });
    for (const row of rows) {
      const ok = await persistRow({
        source: it.source,
        weekKey: it.weekKey,
        row,
      });
      if (ok) inserted++;
    }
  }
  return { inserted, deletedWeeks: touchedKeys.size };
}

/** Full sync: pull every week from every source (cancellation sources read
 *  their ApprovalOk files instead of the weekly ApprovalAll files). */
export async function syncFull(opts: {
  token: string;
  sources: Array<{ path: string; kind?: string }>;
}): Promise<{ inserted: number; weeks: number }> {
  const items: Array<{ source: string; base: string; weekKey: string }> = [];
  let cancelInserted = 0;
  let cancelWeeks = 0;
  for (const s of opts.sources) {
    if (s.kind === "cancellation") {
      const r = await syncCancellationSource({ token: opts.token, path: s.path });
      cancelInserted += r.inserted;
      cancelWeeks += r.files;
    } else {
      const { base, weeks } = await listWeeks({ token: opts.token, path: s.path });
      for (const w of weeks) items.push({ source: s.path, base, weekKey: w });
    }
  }
  const r = await syncItems({ token: opts.token, items });
  return {
    inserted: r.inserted + cancelInserted,
    weeks: r.deletedWeeks + cancelWeeks,
  };
}

// ---------------------------------------------------------------------------
// LogCreditCardOK — phone-based credit card eshel registrations
// ---------------------------------------------------------------------------

/**
 * Normalize Hebrew year from geresh/gershayim (Unicode ׳ U+05F3 / ״ U+05F4)
 * to standard ASCII quotes that the rest of the app uses.
 *   "תשפ״ג" → 'תשפ"ג'
 */
function normalizeHebYear(raw: string): string {
  return raw.replace(/׳/g, "'").replace(/״/g, '"');
}

/**
 * Bump a Hebrew year string by one: תשפ"ו → תשפ"ז.
 * Credit card registrations are made in the summer for the NEXT academic year.
 */
const HEB_UNITS = "אבגדהוזחט";
function nextHebYear(year: string): string {
  const last = year[year.length - 1];
  const idx = HEB_UNITS.indexOf(last);
  if (idx >= 0 && idx < HEB_UNITS.length - 1) {
    return year.slice(0, -1) + HEB_UNITS[idx + 1];
  }
  return year;
}

/**
 * Extract the Hebrew year from a "תאריך עברי" value like "י׳ תמוז תשפ״ג".
 * Returns the NEXT year (registration target), e.g. תשפ"ד for תשפ"ג.
 */
function extractYearFromHebDate(hebDate: string): string | null {
  const parts = hebDate.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (!last || !last.startsWith("תש")) return null;
  return nextHebYear(normalizeHebYear(last));
}

export async function fetchLogCreditCard(opts: {
  token: string;
  path?: string;
}): Promise<YmgrRow[]> {
  const wath = opts.path ?? "ivr2:2/LogCreditCard.ymgr";
  const o = (await apiCall("RenderYMGRFile", {
    token: opts.token,
    convertType: "json",
    wath,
  })) as { responseStatus?: string; data?: YmgrRow[]; message?: string };
  if (!o || o.responseStatus !== "OK") {
    if (o?.responseStatus === "EXCEPTION" && o.message)
      throw new Error(o.message);
    return [];
  }
  return o.data ?? [];
}

export interface CreditCardSyncResult {
  total: number;
  stored: number;
  approved: number;
  matched: number;
  eshelFlipped: number;
  /** Students whose nedarimHook was set/updated from the approval number.
   *  Both registration channels (Nedarim form / Yemot phone) create a
   *  standing order in Nedarim Plus — the Yemot approval number IS the
   *  hoq id, and payment-sync matches transactions through it. */
  hookSet: number;
  unmatched: number;
  perYear: Array<{ year: string; matched: number; unmatched: number }>;
}

/**
 * Sync LogCreditCardOK.ymgr: mark students who paid via the Yemot phone
 * credit-card flow as eshel-registered and copy hook / price / payments.
 *
 * Matching key: "מספר זיהוי" → Student.personalCode, year from "תאריך עברי".
 * Only "מאושר" (approved) rows are considered.
 *
 * Fields copied:
 *   "מספר אישור" (col V) → nedarimHook
 *   "סכום"        (col M) → price
 *   "תשלומים"     (col Q) → paymentsCount
 */
export async function syncLogCreditCard(opts: {
  token: string;
  path?: string;
}): Promise<CreditCardSyncResult> {
  const rows = await fetchLogCreditCard(opts);

  // Persist every row into YemotCreditCard table (upsert by approvalNum).
  let stored = 0;
  for (const row of rows) {
    const approval = (row["מספר אישור"] ?? "").trim();
    if (!approval) continue;
    const code = (row["מספר זיהוי"] ?? "").trim();
    const hebDate = (row["תאריך עברי"] ?? "").trim();
    const year = extractYearFromHebDate(hebDate);
    const rawAmt = parseFloat(String(row["סכום"] ?? ""));
    const rawInst = parseInt(String(row["תשלומים"] ?? ""), 10);
    const data = {
      personalCode: code,
      phone: (row["טלפון"] ?? "").trim() || null,
      amount: isNaN(rawAmt) ? null : rawAmt,
      currency: parseInt(String(row["מטבע (1-שקל,2-דולר אמריקאי,978-אירו)"] ?? row["מטבע"] ?? ""), 10) || null,
      installments: isNaN(rawInst) ? null : rawInst,
      status: (row["סטטוס"] ?? "").trim() || null,
      approvalNum: approval,
      date: (row["תאריך"] ?? "").trim() || null,
      hebDate: hebDate || null,
      year,
      lastDigits: (row["ספרות אחרונות"] ?? "").trim() || null,
      chargeDay: (row["יום חיוב"] ?? "").trim() || null,
      nextChargeDate: (row["תאריך חיוב הבא"] ?? "").trim() || null,
      customerName: (row["שם לקוח"] ?? "").trim() || null,
      raw: JSON.stringify(row),
      fetchedAt: new Date(),
    };
    await prisma.yemotCreditCard.upsert({
      where: { approvalNum: approval },
      create: { ...data },
      update: { ...data },
    });
    stored++;
  }

  // Now match approved rows to students
  type Plan = {
    code: string;
    year: string;
    hook: string;
    price: number | null;
    paymentsCount: number | null;
  };
  const byYearCode = new Map<string, Plan>();
  let approved = 0;

  for (const row of rows) {
    const status = (row["סטטוס"] ?? "").trim();
    if (status !== "מאושר") continue;
    approved++;

    const code = (row["מספר זיהוי"] ?? "").trim();
    if (!code) continue;

    const hebDate = (row["תאריך עברי"] ?? "").trim();
    const year = extractYearFromHebDate(hebDate);
    if (!year) continue;

    const hook = (row["מספר אישור"] ?? "").trim();
    const rawPrice = parseFloat(String(row["סכום"] ?? ""));
    const rawPayments = parseInt(String(row["תשלומים"] ?? ""), 10);

    byYearCode.set(`${year}|${code}`, {
      code,
      year,
      hook,
      price: isNaN(rawPrice) ? null : rawPrice,
      paymentsCount: isNaN(rawPayments) ? null : rawPayments,
    });
  }

  if (byYearCode.size === 0) {
    return {
      total: rows.length,
      stored,
      approved,
      matched: 0,
      eshelFlipped: 0,
      hookSet: 0,
      unmatched: 0,
      perYear: [],
    };
  }

  const uniqueYears = [
    ...new Set([...byYearCode.values()].map((p) => p.year)),
  ];
  const uniqueCodes = [
    ...new Set([...byYearCode.values()].map((p) => p.code)),
  ];

  const students = await prisma.student.findMany({
    where: {
      year: { in: uniqueYears },
      personalCode: { in: uniqueCodes },
    },
    select: {
      id: true,
      year: true,
      personalCode: true,
      registeredEshel: true,
      nedarimHook: true,
      price: true,
      paymentsCount: true,
      paymentMethod: true,
    },
  });
  const studentByYC = new Map(
    students.map((s) => [`${s.year}|${s.personalCode}`, s])
  );

  let matched = 0,
    eshelFlipped = 0,
    hookSet = 0,
    unmatched = 0;
  const perYear = new Map<string, { matched: number; unmatched: number }>();

  for (const plan of byYearCode.values()) {
    const ys = perYear.get(plan.year) ?? { matched: 0, unmatched: 0 };
    const student = studentByYC.get(`${plan.year}|${plan.code}`);
    if (!student) {
      unmatched++;
      ys.unmatched++;
      perYear.set(plan.year, ys);
      continue;
    }
    matched++;
    ys.matched++;
    perYear.set(plan.year, ys);

    const updates: Record<string, unknown> = {};
    // The approval number is the Nedarim Plus hoq id — store it so
    // payment-sync attributes the monthly charges to this student.
    if (plan.hook && student.nedarimHook !== plan.hook) {
      updates.nedarimHook = plan.hook;
      hookSet++;
    }
    if (!student.registeredEshel) {
      updates.registeredEshel = true;
      eshelFlipped++;
    }
    if (plan.price !== null && !student.price) {
      updates.price = plan.price;
    }
    if (plan.paymentsCount !== null && !student.paymentsCount) {
      updates.paymentsCount = plan.paymentsCount;
    }
    if (student.paymentMethod !== "ימות המשיח") {
      updates.paymentMethod = "ימות המשיח";
    }
    if (Object.keys(updates).length > 0) {
      await prisma.student.update({
        where: { id: student.id },
        data: updates,
      });
    }
  }

  return {
    total: rows.length,
    stored,
    approved,
    matched,
    eshelFlipped,
    hookSet,
    unmatched,
    perYear: [...perYear.entries()]
      .map(([year, s]) => ({ year, ...s }))
      .sort((a, b) => b.matched - a.matched),
  };
}

/** Sync only the most recent week across `current` sources. Cancellation
 *  sources are small, so we refresh all their weekly files each run. */
export async function syncLatest(opts: {
  token: string;
  sources: Array<{ path: string; current: boolean; kind?: string }>;
}): Promise<{ inserted: number; weekKey: string | null }> {
  const currentSources = opts.sources.filter((s) => s.current);
  if (currentSources.length === 0) return { inserted: 0, weekKey: null };

  let cancelInserted = 0;
  for (const s of currentSources.filter((s) => s.kind === "cancellation")) {
    const r = await syncCancellationSource({ token: opts.token, path: s.path });
    cancelInserted += r.inserted;
  }
  const bookingSources = currentSources.filter((s) => s.kind !== "cancellation");
  if (bookingSources.length === 0) {
    return { inserted: cancelInserted, weekKey: null };
  }

  // Discover the latest week across all booking `current` sources.
  const listings = await Promise.all(
    bookingSources.map(async (s) => ({
      source: s.path,
      ...(await listWeeks({ token: opts.token, path: s.path })),
    }))
  );
  const allWeeks = new Set<string>();
  for (const l of listings) for (const w of l.weeks) allWeeks.add(w);
  const sorted = [...allWeeks].sort();
  const latest = sorted[sorted.length - 1];
  if (!latest) return { inserted: 0, weekKey: null };

  const items = listings
    .filter((l) => l.weeks.includes(latest))
    .map((l) => ({ source: l.source, base: l.base, weekKey: latest }));
  const r = await syncItems({ token: opts.token, items });
  return { inserted: r.inserted, weekKey: latest };
}
