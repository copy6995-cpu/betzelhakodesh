/**
 * Export bachurim (filtered by year + status + yeshiva + search) as an
 * Excel workbook with one sheet per yeshiva.
 *
 * Reuses the ExcelJS table+freeze+RTL pattern from registration-export.ts
 * (SheetJS Community's writer drops both `!views` freeze panes and table
 * objects on the floor — verified against xlsx@0.20.3 source).
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import {
  getExpiredEndDateLabels,
  activeEshelWhere,
  notActiveEshelWhere,
  isEshelActive,
} from "./eshel";
import { tokenSearchWhere } from "./search";

export type BachurimExportRow = {
  firstName: string;
  lastName: string;
  personalCode: string;
  fatherName: string;
  yeshiva: string;
  shiur: string | null;
  city: string | null;
  ariChul: string | null;
  price: number | null;
  paid: number;
  remaining: number;
  hook: string | null;
  eshel: boolean;
  parentPhone: string | null;
  parentEmail: string | null;
  endDate: string | null;
  group: number | "";
};

/** Yemot HaMashiach group numbers, keyed by yeshiva. A bachur registered for
 *  eshel takes their yeshiva's number; one who is NOT registered goes to 23
 *  (the casual/one-time bucket). An unmapped yeshiva comes back blank. */
const YESHIVA_GROUP: Record<string, number> = {
  "בית שמש": 11,
  "ביתר": 11,
  "בני ברק": 12,
  "ברכת אהרן": 13,
  "דובר שלום": 14,
  "חיפה": 15,
  "ירושלים": 16,
  "ישמח לב": 17,
  "קריית הרצוג": 18,
};

function groupFor(yeshiva: string, eshel: boolean): number | "" {
  if (!eshel) return 23;
  return YESHIVA_GROUP[yeshiva.trim()] ?? "";
}

const COLUMNS: Array<{ header: string; key: keyof BachurimExportRow }> = [
  { header: "שם הבחור", key: "firstName" },
  { header: "משפחה", key: "lastName" },
  { header: "שם האב", key: "fatherName" },
  { header: "קוד אישי", key: "personalCode" },
  { header: "ישיבה", key: "yeshiva" },
  { header: "שיעור", key: "shiur" },
  { header: "עיר", key: "city" },
  { header: 'חו"ל/אר"י', key: "ariChul" },
  { header: "מחיר", key: "price" },
  { header: "שולם", key: "paid" },
  { header: "יתרה", key: "remaining" },
  { header: "הוראת קבע", key: "hook" },
  { header: 'אש"ל', key: "eshel" },
  { header: "טלפון הורה", key: "parentPhone" },
  { header: "מייל הורה", key: "parentEmail" },
  { header: "תאריך סיום", key: "endDate" },
  { header: "קבוצה", key: "group" },
];

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\n\r\t]/g, "_").trim() || "ללא_שם";
}

function safeSheetName(name: string): string {
  return name.replace(/[\[\]:*?/\\]/g, "_").trim().slice(0, 31) || "בחורים";
}

function safeTableName(seed: string, index: number): string {
  return `TBL_${index}_${seed.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 32) ||
    `TBL_${index}`;
}

/** Column widths sized to the widest actual value in that column, capped
 *  at 48 chars so an outlier can't blow it open. Add 3 for the filter
 *  dropdown arrow. */
function autoColumnWidths(rows: BachurimExportRow[]): number[] {
  return COLUMNS.map((col) => {
    let max = col.header.length;
    for (const r of rows) {
      const v = r[col.key];
      const s =
        v === null || v === undefined
          ? ""
          : typeof v === "boolean"
          ? v
            ? "כן"
            : "לא"
          : String(v);
      if (s.length > max) max = s.length;
    }
    return Math.max(6, Math.min(48, max + 3));
  });
}

function rowToArray(r: BachurimExportRow): (string | number)[] {
  return COLUMNS.map((col) => {
    const v = r[col.key];
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "כן" : "לא";
    return v;
  });
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  opts: {
    sheetName: string;
    tableName: string;
    rows: BachurimExportRow[];
  }
) {
  const ws = wb.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, rightToLeft: true }],
  });
  const widths = autoColumnWidths(opts.rows);
  ws.columns = COLUMNS.map((col, i) => ({
    header: col.header,
    key: col.key,
    width: widths[i],
  }));
  ws.addTable({
    name: opts.tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: COLUMNS.map((col) => ({
      name: col.header,
      filterButton: true,
    })),
    rows: opts.rows.map(rowToArray),
  });
  for (let i = 0; i < widths.length; i++) {
    ws.getColumn(i + 1).width = widths[i];
  }
}

/** The status filter shape mirrors `/bachurim/page.tsx`. Kept in sync by
 *  hand — there's only one canonical list and it lives in that file. */
type StatusFilter =
  | "all"
  | "no-hook"
  | "no-eshel"
  | "unattached"
  | "hook"
  | "eshel"
  | "eshel-hook"
  | "eshel-no-hook";

function statusWhere(
  status: StatusFilter | undefined,
  expired: string[]
): Record<string, unknown> {
  const active = activeEshelWhere(expired);
  const notActive = notActiveEshelWhere(expired);
  const hasHook = { NOT: [{ nedarimHook: null }, { nedarimHook: "" }] };
  const noHook = { OR: [{ nedarimHook: null }, { nedarimHook: "" }] };
  switch (status) {
    case "no-hook":
      return noHook;
    case "no-eshel":
      return notActive;
    case "unattached":
      return { AND: [noHook, notActive] };
    case "hook":
      return hasHook;
    case "eshel":
      return active;
    case "eshel-hook":
      return { AND: [active, hasHook] };
    case "eshel-no-hook":
      return { AND: [active, noHook] };
    default:
      return {};
  }
}

export async function loadBachurimForExport(opts: {
  year: string;
  status?: StatusFilter;
  yeshiva?: string;
  q?: string;
}): Promise<{
  rows: BachurimExportRow[];
  byYeshiva: Map<string, BachurimExportRow[]>;
}> {
  const expired = await getExpiredEndDateLabels(opts.year);
  // statusWhere and the search can each contribute an `OR` — keep them in
  // separate AND slots so neither key overwrites the other.
  const where: Record<string, unknown> = {
    year: opts.year,
    archived: false,
    ...(opts.yeshiva ? { yeshiva: opts.yeshiva } : {}),
    AND: [
      statusWhere(opts.status, expired),
      ...(opts.q?.trim()
        ? [
            tokenSearchWhere(opts.q, [
              "firstName",
              "lastName",
              "fatherName",
              "personalCode",
              "nedarimHook",
            ])!,
          ]
        : []),
    ],
  };

  const students = await prisma.student.findMany({
    where,
    orderBy: [
      { yeshiva: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
    include: {
      parent: { select: { phone: true, email: true } },
      payments: { select: { amount: true } },
    },
  });

  const rows: BachurimExportRow[] = students.map((s) => {
    const paid = s.payments.reduce((a, p) => a + Number(p.amount), 0);
    const price = s.price ?? 0;
    const eshel = isEshelActive(s.registeredEshel, s.endDateLabel, expired);
    return {
      firstName: s.firstName,
      lastName: s.lastName,
      personalCode: s.personalCode,
      fatherName: s.fatherName ?? "",
      yeshiva: s.yeshiva,
      shiur: s.shiur,
      city: s.city,
      ariChul: s.ariChul,
      price: s.price,
      paid,
      remaining: price - paid,
      hook: s.nedarimHook,
      eshel,
      parentPhone: s.parent?.phone ?? null,
      parentEmail: s.parent?.email ?? null,
      endDate: s.endDateLabel,
      group: groupFor(s.yeshiva, eshel),
    };
  });

  const byYeshiva = new Map<string, BachurimExportRow[]>();
  for (const r of rows) {
    const arr = byYeshiva.get(r.yeshiva) ?? [];
    arr.push(r);
    byYeshiva.set(r.yeshiva, arr);
  }

  return { rows, byYeshiva };
}

/** Yemot upload template header — the exact layout the phone system expects,
 *  including the five blank spacer columns between שם משפחה and שם האב. */
const GROUP_CSV_HEADERS = [
  "קוד תלמיד",
  "מאושר",
  "שם תלמיד",
  "שם משפחה",
  "",
  "",
  "",
  "",
  "",
  "שם האב",
  "עיר",
  "שיעור",
  "ישיבה",
  'אר"י/חו"ל',
  "קבוצה",
];

/** Quote a CSV field only when it contains a comma, quote, or newline. */
function csvCell(v: string | number): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the Yemot HaMashiach "groups" upload as a comma-separated file, in the
 * exact template layout, with the קבוצה column derived per {@link groupFor}.
 * Honors the same year/yeshiva/status/search filters as the regular export.
 * The header row is emitted verbatim (matching the template the office uses);
 * data cells are quoted only when necessary.
 */
export async function buildBachurimGroupsCsv(opts: {
  year: string;
  status?: StatusFilter;
  yeshiva?: string;
  q?: string;
}): Promise<string> {
  const { rows } = await loadBachurimForExport(opts);
  const lines = [GROUP_CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.personalCode,
        1,
        r.firstName,
        r.lastName,
        "",
        "",
        "",
        "",
        "",
        r.fatherName,
        r.city ?? "",
        r.shiur ?? "",
        r.yeshiva,
        r.ariChul ?? "",
        r.group,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

/** Build a workbook with one sheet per yeshiva (sorted by row-count desc)
 *  plus a "כל הבחורים" summary sheet with everything. If a specific
 *  yeshiva filter was applied there's just one sheet. */
export async function buildBachurimWorkbook(opts: {
  year: string;
  status?: StatusFilter;
  yeshiva?: string;
  q?: string;
}): Promise<Buffer> {
  const { rows, byYeshiva } = await loadBachurimForExport(opts);

  const wb = new ExcelJS.Workbook();

  // Always start with the "all in one" sheet so the user can search across
  // yeshivot in a single view.
  if (rows.length > 0 && byYeshiva.size > 1) {
    addTableSheet(wb, {
      sheetName: safeSheetName("כל הבחורים"),
      tableName: safeTableName("all", 0),
      rows,
    });
  }

  const sorted = [...byYeshiva.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );
  const usedNames = new Set<string>([safeSheetName("כל הבחורים")]);
  let idx = 1;
  for (const [yeshiva, ys] of sorted) {
    let sheetName = safeSheetName(yeshiva);
    let attempt = sheetName;
    let n = 2;
    while (usedNames.has(attempt)) attempt = `${sheetName}(${n++})`.slice(0, 31);
    usedNames.add(attempt);
    addTableSheet(wb, {
      sheetName: attempt,
      tableName: safeTableName(yeshiva, idx++),
      rows: ys,
    });
  }

  if (wb.worksheets.length === 0) {
    // ExcelJS refuses to write an empty workbook.
    addTableSheet(wb, {
      sheetName: safeSheetName("(ריק)"),
      tableName: safeTableName("empty", 0),
      rows: [],
    });
  }

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

export { sanitizeFilename };
