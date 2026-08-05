/**
 * Group weekly registrations (Yemot HaMashiach approved bed reservations,
 * enriched with roster info from the Student table) by yeshiva and build
 * xlsx workbooks for each group. Mirrors the old פיצול_לפי_ישיבה.py script,
 * but the source is now automatic — no manual "רשימה כללית" sheet needed.
 *
 * Uses `exceljs` (rather than SheetJS) because we need real Excel tables,
 * frozen header rows, and RTL. SheetJS Community's writer literally emits
 * `<sheetView workbookViewId="0"/>` — no <pane>, no rightToLeft — so freeze
 * pane / table styling silently drop on the floor. exceljs writes all of it.
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { getActiveYear } from "./year";
import { loadCancellations, isLiveBooking } from "./bed-cancellations";

export type SubmissionRow = Record<string, string | number | null>;

/** Parse Yemot's "dd/mm/yyyy" date + optional "HH:MM[:SS]" time into a Date.
 *  Null on failure. Parsed as server-local so it compares consistently with
 *  the from/to datetimes the UI sends (both go through the same clock). */
function parseDmy(s: string | null | undefined, time?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  let HH = "00", MM = "00", SS = "00";
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((time ?? "").trim());
  if (tm) {
    HH = tm[1].padStart(2, "0");
    MM = tm[2];
    SS = tm[3] ?? "00";
  }
  const d = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Read the "שעה" (HH:MM:SS) time field out of a reservation's raw JSON. */
function timeFromRaw(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const v = (JSON.parse(raw) as Record<string, unknown>)["שעה"];
    return v == null ? "" : String(v);
  } catch {
    return "";
  }
}

/**
 * Column order and Hebrew labels of the exported Excel — chosen to match
 * exactly the file the old Python script produced (פיצול_לפי_ישיבה.py),
 * plus a couple of new automatic columns.
 */
export const EXPORT_COLUMNS = [
  "מספר זיהוי",
  "שם פרטי",
  "שם משפחה",
  "שם האב",
  "עיר",
  "שיעור",
  "ישיבה",
  'חו"ל/אר"י',
  "תאריך הרשמה",
  "מצב",
  "שבוע",
] as const;

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\n\r\t]/g, "_").trim() || "ללא_שם";
}

/**
 * Excel sheet names are limited to 31 chars and can't contain []:*?/\
 */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\[\]:*?/\\]/g, "_").trim();
  return cleaned.slice(0, 31) || "רישום";
}

/** Table names must be unique per workbook and can't contain spaces / most
 *  punctuation. Kept ASCII since Excel is picky about non-ASCII table names. */
function safeTableName(seed: string, index: number): string {
  return `TBL_${index}_${seed.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 32) ||
    `TBL_${index}`;
}

/**
 * Fetch approved Yemot bed reservations whose reservation date is in
 * [from, to], enrich with Student roster info (matched on personalCode
 * within the active year), and group by yeshiva.
 *
 * Duplicates per person are collapsed: only the LATEST reservation date is
 * kept per personalCode — one row per person even if they booked twice.
 * Personas that appear in Yemot but not in the roster still show up (yeshiva
 * falls back to "(לא ברשימה)").
 */
export async function loadRegistrationsByYeshiva(opts: {
  from: Date;
  to: Date;
  year?: string;
}): Promise<{
  columns: string[];
  groups: Map<string, SubmissionRow[]>;
  totalRows: number;
}> {
  const year = opts.year ?? (await getActiveYear());
  const [approved, cancellations] = await Promise.all([
    prisma.yemotBedReservation.findMany({ where: { status: "מאושר" } }),
    loadCancellations(),
  ]);

  const perCode = new Map<
    string,
    { date: Date; hebDate: string | null; weekKey: string; status: string; nameFromYemot: string | null }
  >();
  for (const r of approved) {
    // Drop bookings the bachur later cancelled (שלוחה 5).
    if (!isLiveBooking(r, cancellations)) continue;
    const d = parseDmy(r.date, timeFromRaw(r.raw));
    if (!d) continue;
    if (d < opts.from || d > opts.to) continue;
    const prev = perCode.get(r.personalCode);
    if (!prev || d > prev.date) {
      perCode.set(r.personalCode, {
        date: d,
        hebDate: r.hebDate,
        weekKey: r.weekKey,
        status: r.status ?? "",
        nameFromYemot: r.name,
      });
    }
  }
  if (perCode.size === 0) {
    return { columns: [...EXPORT_COLUMNS], groups: new Map(), totalRows: 0 };
  }

  const students = await prisma.student.findMany({
    where: {
      year,
      personalCode: { in: [...perCode.keys()] },
    },
    select: {
      personalCode: true,
      firstName: true,
      lastName: true,
      fatherName: true,
      city: true,
      shiur: true,
      yeshiva: true,
      ariChul: true,
    },
  });
  const byCode = new Map(students.map((s) => [s.personalCode, s]));

  const groups = new Map<string, SubmissionRow[]>();
  for (const [code, y] of perCode.entries()) {
    const roster = byCode.get(code);
    const nameFromYemot = y.nameFromYemot ?? "";
    let firstName = "", lastName = "";
    if (!roster && nameFromYemot) {
      const parts = nameFromYemot.trim().split(/\s+/);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }

    const row: SubmissionRow = {
      "מספר זיהוי": code,
      "שם פרטי": roster?.firstName ?? firstName,
      "שם משפחה": roster?.lastName ?? lastName,
      "שם האב": roster?.fatherName ?? "",
      "עיר": roster?.city ?? "",
      "שיעור": roster?.shiur ?? "",
      "ישיבה": roster?.yeshiva ?? "(לא ברשימה)",
      'חו"ל/אר"י': roster?.ariChul ?? "",
      "תאריך הרשמה": y.date.toLocaleString("he-IL"),
      "מצב": y.status,
      "שבוע": y.weekKey,
    };

    const yeshiva = row["ישיבה"] as string;
    const arr = groups.get(yeshiva) ?? [];
    arr.push(row);
    groups.set(yeshiva, arr);
  }

  return {
    columns: [...EXPORT_COLUMNS],
    groups,
    totalRows: perCode.size,
  };
}

/** Compute column widths that fit the widest value + a little padding. */
function autoColumnWidths(
  columns: string[],
  rows: SubmissionRow[]
): number[] {
  return columns.map((col) => {
    let max = col.length;
    for (const r of rows) {
      const v = r[col];
      if (v === null || v === undefined) continue;
      const s = String(v);
      if (s.length > max) max = s.length;
    }
    // +3 = padding for filter arrow + a little breathing room.
    return Math.max(6, Math.min(48, max + 3));
  });
}

/**
 * Add one sheet to the workbook, structured as a real Excel table with:
 *   - Frozen top row (header stays visible on scroll)
 *   - RTL viewport (Hebrew reading direction)
 *   - AutoFilter dropdowns via the table object itself
 *   - Built-in "TableStyleMedium9" (blue banded)
 *   - Column widths sized to content
 */
function addTableSheet(
  wb: ExcelJS.Workbook,
  opts: {
    sheetName: string;
    tableName: string;
    columns: string[];
    rows: SubmissionRow[];
  }
) {
  const ws = wb.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, rightToLeft: true }],
  });

  const widths = autoColumnWidths(opts.columns, opts.rows);
  ws.columns = opts.columns.map((name, i) => ({
    header: name,
    key: name,
    width: widths[i],
  }));

  // Add data rows (no header — exceljs's addTable puts the header itself).
  // We build a plain array-of-arrays and let addTable own the range.
  const dataRows = opts.rows.map((r) =>
    opts.columns.map((c) => {
      const v = r[c];
      return v === null || v === undefined ? "" : v;
    })
  );

  ws.addTable({
    name: opts.tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium9",
      showRowStripes: true,
    },
    columns: opts.columns.map((n) => ({ name: n, filterButton: true })),
    rows: dataRows,
  });

  // exceljs's ws.columns above set widths, but adding a table replaces some
  // column state, so re-apply widths after addTable to be safe.
  for (let i = 0; i < widths.length; i++) {
    ws.getColumn(i + 1).width = widths[i];
  }
}

export async function buildSingleYeshivaWorkbook(opts: {
  yeshiva: string;
  columns: string[];
  rows: SubmissionRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addTableSheet(wb, {
    sheetName: safeSheetName(opts.yeshiva),
    tableName: safeTableName(opts.yeshiva, 1),
    columns: opts.columns,
    rows: opts.rows,
  });
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

export async function buildCombinedWorkbook(opts: {
  columns: string[];
  groups: Map<string, SubmissionRow[]>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sorted = [...opts.groups.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );
  const usedNames = new Set<string>();
  let idx = 1;

  // First sheet: everyone together, across all yeshivot.
  const allRows = sorted.flatMap(([, rows]) => rows);
  if (allRows.length > 0) {
    const allName = safeSheetName("כל הישיבות");
    usedNames.add(allName);
    addTableSheet(wb, {
      sheetName: allName,
      tableName: safeTableName("all", 0),
      columns: opts.columns,
      rows: allRows,
    });
  }

  for (const [yeshiva, rows] of sorted) {
    let sheetName = safeSheetName(yeshiva);
    let attempt = sheetName;
    let n = 2;
    while (usedNames.has(attempt)) attempt = `${sheetName}(${n++})`.slice(0, 31);
    usedNames.add(attempt);
    addTableSheet(wb, {
      sheetName: attempt,
      tableName: safeTableName(yeshiva, idx++),
      columns: opts.columns,
      rows,
    });
  }
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

export { sanitizeFilename };
