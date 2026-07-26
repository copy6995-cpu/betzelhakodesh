/**
 * Nedarim Plus HTTPS client. All calls hit `matara.pro`. Credentials
 * (MosadId + ApiPassword) live in the AppSetting table so the user can enter
 * them from the settings page. The transaction endpoint is rate-limited to
 * 20 calls/hour by Nedarim — we don't enforce this ourselves; the caller is
 * expected to space out syncs.
 */
import { prisma } from "./prisma";

const HISTORY_URL = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";
const FORMS_URL = "https://matara.pro/nedarimplus/Forms/Manage.aspx";

export type NedarimCreds = {
  mosadId: string;
  apiPassword: string;
};

/** Transactions endpoint credentials. Env vars beat DB values so the user
 *  can pin secrets to .env and rotate them by editing a text file. */
export async function getCreds(): Promise<NedarimCreds | null> {
  const envMosad = (process.env.NEDARIM_MOSAD_ID ?? "").trim();
  const envPass = (process.env.NEDARIM_API_PASSWORD ?? "").trim();
  if (envMosad && envPass) return { mosadId: envMosad, apiPassword: envPass };

  const [mosadId, apiPassword] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "nedarim_mosad_id" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_api_password" } }),
  ]);
  const m = envMosad || mosadId?.value;
  const p = envPass || apiPassword?.value;
  if (!m || !p) return null;
  return { mosadId: m, apiPassword: p };
}

/**
 * Forms endpoint credentials. Nedarim Plus issues a SEPARATE API password for
 * the Forms API vs the transactions API. Priority: env forms password > DB
 * forms password > env main password > DB main password.
 */
export async function getFormsCreds(): Promise<NedarimCreds | null> {
  const envMosad = (process.env.NEDARIM_MOSAD_ID ?? "").trim();
  const envForms = (process.env.NEDARIM_FORMS_PASSWORD ?? "").trim();
  const envMain = (process.env.NEDARIM_API_PASSWORD ?? "").trim();

  const [mosadRow, formsRow, mainRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "nedarim_mosad_id" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_forms_password" } }),
    prisma.appSetting.findUnique({ where: { key: "nedarim_api_password" } }),
  ]);

  const mosadId = envMosad || mosadRow?.value;
  const password =
    envForms || formsRow?.value || envMain || mainRow?.value;
  if (!mosadId || !password) return null;
  return { mosadId, apiPassword: password };
}

/** Report which credentials came from .env (rather than the DB) so the UI can
 *  hint the user that editing settings won't take effect. */
export function envOverrides(): {
  mosadId: boolean;
  apiPassword: boolean;
  formsPassword: boolean;
} {
  return {
    mosadId: !!(process.env.NEDARIM_MOSAD_ID ?? "").trim(),
    apiPassword: !!(process.env.NEDARIM_API_PASSWORD ?? "").trim(),
    formsPassword: !!(process.env.NEDARIM_FORMS_PASSWORD ?? "").trim(),
  };
}

export async function saveCreds(creds: NedarimCreds): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "nedarim_mosad_id" },
    update: { value: creds.mosadId },
    create: { key: "nedarim_mosad_id", value: creds.mosadId },
  });
  await prisma.appSetting.upsert({
    where: { key: "nedarim_api_password" },
    update: { value: creds.apiPassword },
    create: { key: "nedarim_api_password", value: creds.apiPassword },
  });
}

export async function saveFormsPassword(password: string): Promise<void> {
  const p = password.trim();
  await prisma.appSetting.upsert({
    where: { key: "nedarim_forms_password" },
    update: { value: p },
    create: { key: "nedarim_forms_password", value: p },
  });
}

/**
 * Parse the various shapes Nedarim returns for `TransactionTime` /
 * date-like fields (dd/mm/yyyy hh:mm or ISO). Returns null on failure so we
 * never abort a sync over a single bad row.
 */
export function parseNedarimDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  // Nedarim's dd/mm/yyyy[ HH:mm[:ss]] — check FIRST so we don't accidentally
  // let JS's Date constructor treat it as MM/dd/yyyy (which some Node
  // versions do for two-digit-month strings).
  const m = v.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const [, dd, mm, yyyy, HH = "00", MM = "00", SS = "00"] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}Z`);
    if (!isNaN(d.getTime())) return d;
  }
  const iso = new Date(v);
  return !isNaN(iso.getTime()) ? iso : null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Normalize a kevaId (הוק) coming from Nedarim. Sometimes the API emits a
 * leading "-" (e.g. "-1853053") which breaks the lookup against
 * Student.nedarimHook. Strip it silently.
 */
export function normalizeKevaId(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  return s.replace(/^-/, "");
}

type ApiRow = Record<string, unknown>;

/**
 * Fetch one page of transaction history from Nedarim, upsert each row into
 * NedarimTransaction, and return how many are new/updated plus the largest
 * TransactionId seen so the caller can page.
 */
export async function syncTransactionsPage(opts: {
  creds: NedarimCreds;
  lastId?: string;
  maxId?: number; // 1..2000, default 2000
}): Promise<{ pulled: number; upserted: number; largestId: string | null }> {
  const body = new URLSearchParams({
    Action: "GetHistoryJson",
    MosadId: opts.creds.mosadId,
    ApiPassword: opts.creds.apiPassword,
  });
  if (opts.lastId) body.set("LastId", opts.lastId);
  body.set("MaxId", String(Math.min(2000, Math.max(1, opts.maxId ?? 2000))));

  const res = await fetch(HISTORY_URL + "?" + body.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nedarim returned HTTP ${res.status}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Nedarim returned non-JSON: ${text.slice(0, 200)}`);
  }
  // Nedarim signals auth/param problems as { Result/Status: "Error", Message }.
  const errObj = json as { Result?: string; Status?: string; Message?: string };
  if (errObj && (errObj.Result === "Error" || errObj.Status === "Error")) {
    throw new Error(errObj.Message ?? "שגיאה מנדרים פלוס");
  }
  const rows: ApiRow[] = Array.isArray(json)
    ? (json as ApiRow[])
    : Array.isArray((json as { data?: unknown }).data)
    ? ((json as { data: ApiRow[] }).data)
    : [];

  let upserted = 0;
  let largestId: string | null = null;
  for (const row of rows) {
    const txId = strOrNull(row.TransactionId);
    if (!txId) continue;
    if (!largestId || Number(txId) > Number(largestId)) largestId = txId;
    await prisma.nedarimTransaction.upsert({
      where: { transactionId: txId },
      create: {
        transactionId: txId,
        shovar: strOrNull(row.Shovar),
        zeout: strOrNull(row.Zeout),
        clientName: strOrNull(row.ClientName),
        adresse: strOrNull(row.Adresse),
        phone: strOrNull(row.Phone),
        mail: strOrNull(row.Mail),
        amount: numOrNull(row.Amount),
        currency: numOrNull(row.Currency) as number | null,
        transactionTime: parseNedarimDate(row.TransactionTime),
        confirmation: strOrNull(row.Confirmation),
        lastNum: strOrNull(row.LastNum),
        transactionType: strOrNull(row.TransactionType),
        groupe: strOrNull(row.Groupe),
        comments: strOrNull(row.Comments),
        tashloumim: numOrNull(row.Tashloumim) as number | null,
        firstTashloum: numOrNull(row.FirstTashloum),
        nextTashloum: numOrNull(row.NextTashloum),
        kabalaId: strOrNull(row.KabalaId),
        kevaId: normalizeKevaId(row.KevaId),
        callId: strOrNull(row.CallId),
        masofId: strOrNull(row.MasofId),
        raw: JSON.stringify(row),
      },
      update: {
        // Only the volatile fields — TransactionId is the identity, everything
        // else can change if Nedarim later attaches confirmation number, etc.
        shovar: strOrNull(row.Shovar),
        confirmation: strOrNull(row.Confirmation),
        transactionTime: parseNedarimDate(row.TransactionTime),
        kabalaId: strOrNull(row.KabalaId),
        kevaId: normalizeKevaId(row.KevaId),
        raw: JSON.stringify(row),
        fetchedAt: new Date(),
      },
    });
    upserted++;
  }

  return { pulled: rows.length, upserted, largestId };
}

/**
 * Full sync loop — keeps paging with LastId until Nedarim returns an empty
 * page. Stops early if the caller hits `stopAfterPages` (defence against
 * runaway loops). Returns total rows written.
 */
export async function syncTransactionsAll(opts: {
  creds: NedarimCreds;
  stopAfterPages?: number;
  /** Only used on first sync (empty DB). Skip all Nedarim transactions with
   *  ID ≤ this value. Useful when you have years of history but only care
   *  about recent transactions. */
  minStartId?: string;
}): Promise<{ totalUpserted: number; pages: number }> {
  let totalUpserted = 0;
  let pages = 0;
  let lastId: string | undefined;
  // Start from the most recent row we already have — no reason to re-page from 1.
  // Cast to INTEGER in SQL so we don't hit the string-sort trap where "9999999"
  // comes out "greater" than "10000000".
  const existingMax = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT transactionId AS id FROM NedarimTransaction
    ORDER BY CAST(transactionId AS INTEGER) DESC
    LIMIT 1
  `;
  if (existingMax.length > 0) {
    lastId = existingMax[0].id;
  } else if (opts.minStartId) {
    lastId = opts.minStartId;
  }

  while (pages < (opts.stopAfterPages ?? 40)) {
    const { pulled, upserted, largestId } = await syncTransactionsPage({
      creds: opts.creds,
      lastId,
      maxId: 2000,
    });
    pages++;
    totalUpserted += upserted;
    if (pulled === 0 || !largestId || largestId === lastId) break;
    lastId = largestId;
  }
  return { totalUpserted, pages };
}

/**
 * Fetch one page of form submissions for a specific TofesId. Rows are
 * variable-shape so we key by rowId and store the JSON blob.
 */
export async function syncFormPage(opts: {
  creds: NedarimCreds;
  tofesId: string;
  lastId?: string;
  maxId?: number;
}): Promise<{ pulled: number; upserted: number; largestId: string | null }> {
  const body = new URLSearchParams({
    Action: "GetJson",
    MosadId: opts.creds.mosadId,
    ApiPassword: opts.creds.apiPassword,
    TofesId: opts.tofesId,
  });
  if (opts.lastId) body.set("LastId", opts.lastId);
  body.set("MaxId", String(Math.min(500, Math.max(1, opts.maxId ?? 500))));

  const res = await fetch(FORMS_URL + "?" + body.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nedarim (forms) returned HTTP ${res.status}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Nedarim (forms) returned non-JSON: ${text.slice(0, 200)}`);
  }
  const errObj = json as { Result?: string; Status?: string; Message?: string };
  if (errObj && (errObj.Result === "Error" || errObj.Status === "Error")) {
    throw new Error(errObj.Message ?? "שגיאה מנדרים פלוס");
  }
  const rows: ApiRow[] = Array.isArray(json)
    ? (json as ApiRow[])
    : Array.isArray((json as { data?: unknown }).data)
    ? ((json as { data: ApiRow[] }).data)
    : [];

  let upserted = 0;
  let largestId: string | null = null;
  for (const row of rows) {
    const rowId = strOrNull(row.ID) ?? strOrNull(row.id) ?? strOrNull(row.RowId);
    if (!rowId) continue;
    if (!largestId || Number(rowId) > Number(largestId)) largestId = rowId;
    // Nedarim forms use "CreatedDate" ("22/07/2025 22:42:17"). Older or
    // customised forms sometimes have Date / SubmittedAt / CreatedAt, so we
    // fall back through them too.
    const submittedAt =
      parseNedarimDate(row.CreatedDate) ??
      parseNedarimDate(row.Date) ??
      parseNedarimDate(row.SubmittedAt) ??
      parseNedarimDate(row.CreatedAt) ??
      null;

    await prisma.nedarimFormSubmission.upsert({
      where: { tofesId_rowId: { tofesId: opts.tofesId, rowId } },
      create: {
        tofesId: opts.tofesId,
        rowId,
        submittedAt,
        raw: JSON.stringify(row),
      },
      update: {
        submittedAt,
        raw: JSON.stringify(row),
        fetchedAt: new Date(),
      },
    });
    upserted++;
  }

  return { pulled: rows.length, upserted, largestId };
}

/**
 * Fetch every הוראת קבע from `GetKevaNew` and upsert into NedarimKeva.
 * Unlike transactions/forms this endpoint returns the FULL current list
 * on every call (no LastId pagination), so we do a single request and
 * mirror the whole DB every time.
 */
export async function syncKevaList(opts: {
  creds: NedarimCreds;
}): Promise<{
  totalUpserted: number;
  totalMonth: number;
  totalMonth2: number;
  totalYear: number;
  totalYear2: number;
}> {
  const body = new URLSearchParams({
    Action: "GetKevaNew",
    MosadNumber: opts.creds.mosadId,
    ApiPassword: opts.creds.apiPassword,
  });
  const res = await fetch(HISTORY_URL + "?" + body.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nedarim GetKevaNew: HTTP ${res.status}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Nedarim GetKevaNew: non-JSON — ${text.slice(0, 200)}`);
  }
  const errObj = json as { Result?: string; Status?: string; Message?: string };
  if (errObj && (errObj.Result === "Error" || errObj.Status === "Error")) {
    throw new Error(errObj.Message ?? "שגיאה מנדרים פלוס");
  }

  // The response can be either a bare list or {data: [...], TotalMonth: ...}.
  const wrap = json as {
    data?: unknown[];
    TotalMonth?: number;
    TotalMonth2?: number;
    TotalYear?: number;
    TotalYear2?: number;
  };
  const dataArr: unknown[] = Array.isArray(json)
    ? (json as unknown[])
    : Array.isArray(wrap?.data)
    ? wrap.data
    : [];

  let upserted = 0;
  for (const row of dataArr) {
    const r = row as Record<string, unknown>;
    // GetKevaNew's shape (from api docs):
    //   DT_RowId  = הוראת קבע id
    //   "2"       = שם מלא
    //   "3"       = כתובת + טלפון
    //   "4"       = סכום לחיוב (may be like "125.00 ₪")
    //   "5"       = קטגוריה
    //   "6"       = הערות
    //   "7"       = יתרת חיובים
    //   "8"       = בוצעו
    //   "9"       = תאריך חיוב הבא
    //   "10"      = שגיאה
    //   "11"      = 4 ספרות אחרונות
    //   "12"      = תוקף
    //   "14"      = 1 יש כרטיס תורם
    const kevaId = strOrNull(r.DT_RowId);
    if (!kevaId) continue;
    // "4" may look like "125.00 ₪" or "125.00 $" — strip and detect currency.
    const amtStr = String(r["4"] ?? "");
    const currency = amtStr.includes("$") ? 2 : 1;
    const amount = numOrNull(amtStr.replace(/[^0-9.-]/g, ""));

    await prisma.nedarimKeva.upsert({
      where: { kevaId },
      create: {
        kevaId,
        clientName: strOrNull(r["2"]),
        addressPhone: strOrNull(r["3"]),
        amount,
        currency,
        category: strOrNull(r["5"]),
        comments: strOrNull(r["6"]),
        itra: numOrNull(r["7"]) as number | null,
        success: numOrNull(r["8"]) as number | null,
        nextDate: strOrNull(r["9"]),
        errorText: strOrNull(r["10"]),
        lastNum: strOrNull(r["11"]),
        tokef: strOrNull(r["12"]),
        hasToremCard: String(r["14"] ?? "").trim() === "1",
        raw: JSON.stringify(r),
      },
      update: {
        clientName: strOrNull(r["2"]),
        addressPhone: strOrNull(r["3"]),
        amount,
        currency,
        category: strOrNull(r["5"]),
        comments: strOrNull(r["6"]),
        itra: numOrNull(r["7"]) as number | null,
        success: numOrNull(r["8"]) as number | null,
        nextDate: strOrNull(r["9"]),
        errorText: strOrNull(r["10"]),
        lastNum: strOrNull(r["11"]),
        tokef: strOrNull(r["12"]),
        hasToremCard: String(r["14"] ?? "").trim() === "1",
        raw: JSON.stringify(r),
        fetchedAt: new Date(),
      },
    });
    upserted++;
  }

  return {
    totalUpserted: upserted,
    totalMonth: Number(wrap?.TotalMonth ?? 0),
    totalMonth2: Number(wrap?.TotalMonth2 ?? 0),
    totalYear: Number(wrap?.TotalYear ?? 0),
    totalYear2: Number(wrap?.TotalYear2 ?? 0),
  };
}

/**
 * Charge a single payment (`TashlumBodedNew`) against an existing HoK.
 * Nedarim POSTs the parameters and returns {Status, Message}.
 */
export async function chargeSingleFromKeva(opts: {
  creds: NedarimCreds;
  kevaId: string;
  amount: number;
  currency?: 1 | 2;
  tashloumim?: number;
  category?: string;
  comments?: string;
  joinToKevaId?: "Join" | "NoJoin";
}): Promise<{ ok: boolean; message: string }> {
  const body = new URLSearchParams({
    Action: "TashlumBodedNew",
    MosadNumber: opts.creds.mosadId,
    ApiPassword: opts.creds.apiPassword,
    KevaId: opts.kevaId,
    Amount: String(opts.amount),
    Currency: String(opts.currency ?? 1),
  });
  if (opts.tashloumim) body.set("Tashloumim", String(opts.tashloumim));
  if (opts.category) body.set("Groupe", opts.category);
  if (opts.comments) body.set("Comments", opts.comments);
  if (opts.joinToKevaId) body.set("JoinToKevaId", opts.joinToKevaId);

  const res = await fetch(HISTORY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Nedarim TashlumBodedNew: HTTP ${res.status}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Nedarim TashlumBodedNew: non-JSON — ${text.slice(0, 200)}`
    );
  }
  const r = json as { Status?: string; Message?: string };
  const ok = r?.Status === "OK";
  return {
    ok,
    message: r?.Message ?? (ok ? "בוצע" : "שגיאה"),
  };
}

export async function syncFormAll(opts: {
  creds: NedarimCreds;
  tofesId: string;
  stopAfterPages?: number;
}): Promise<{ totalUpserted: number; pages: number }> {
  let totalUpserted = 0;
  let pages = 0;
  let lastId: string | undefined;
  // Numeric-sort the string rowId column so a decimal-place cross doesn't
  // pick "9999" over "10000".
  const existingMax = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT rowId AS id FROM NedarimFormSubmission
    WHERE tofesId = ${opts.tofesId}
    ORDER BY CAST(rowId AS INTEGER) DESC
    LIMIT 1
  `;
  if (existingMax.length > 0) lastId = existingMax[0].id;

  while (pages < (opts.stopAfterPages ?? 40)) {
    const { pulled, upserted, largestId } = await syncFormPage({
      creds: opts.creds,
      tofesId: opts.tofesId,
      lastId,
      maxId: 500,
    });
    pages++;
    totalUpserted += upserted;
    if (pulled === 0 || !largestId || largestId === lastId) break;
    lastId = largestId;
  }
  return { totalUpserted, pages };
}
