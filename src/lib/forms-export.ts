/**
 * Export Nedarim form submissions as an Excel workbook. Respects the
 * filters that the /nedarim/forms page uses (tofes / snif / stat) so what
 * you see is what you get in the file.
 *
 * Uses ExcelJS with the RTL + frozen-header + Excel-table style we've
 * standardized elsewhere (see registration-export.ts / bachurim-export.ts).
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";

/**
 * Fixed column layout for the export. The raw Nedarim JSON keys are opaque
 * (e.g. `Kod_1`, `Snif1`), so we rename them to Hebrew labels the office
 * team can read directly. Order left-to-right in the exported table.
 */
const COLUMNS: Array<{ label: string; key: string }> = [
  { label: "תאריך הגשה", key: "__submittedAt" },
  { label: "קוד הבחור", key: "Kod_1" },
  { label: "מס' הוק", key: "TransactionId" },
  { label: "שם הבחור", key: "fullName1" },
  { label: "שם משפחה", key: "Family" },
  { label: "שם האב", key: "Father_Name" },
  { label: "עיר", key: "CityName" },
  { label: "שיעור", key: "Class_1" },
  { label: "ישיבה", key: "Yeshiva_1" },
  { label: "שנה", key: "Snif1" },
  { label: "עד מתי", key: "Time_1" },
  { label: "מי רשם", key: "Rishum" },
  { label: "הערות", key: "Notes" },
];

type StatFilter =
  | "all"
  | "hook"
  | "eshel"
  | "unmatched"
  | "no-code"
  | "no-hook"
  | "duplicates"
  | "with-notes";

export async function loadFormRows(opts: {
  tofesId: string;
  snif?: string;
  stat?: StatFilter;
}): Promise<{
  rows: Array<{ submittedAt: Date | null; obj: Record<string, unknown> }>;
  filterLabel: string;
}> {
  const subs = await prisma.nedarimFormSubmission.findMany({
    where: { tofesId: opts.tofesId },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true, raw: true },
  });
  const config = await prisma.nedarimFormConfig.findUnique({
    where: { tofesId: opts.tofesId },
  });
  const cfgYear = (config?.label ?? "").trim();

  // Parse + snif filter
  type Row = {
    submittedAt: Date | null;
    obj: Record<string, unknown>;
    code: string;
    year: string;
  };
  const parsed: Row[] = [];
  for (const s of subs) {
    let obj: Record<string, unknown> = {};
    try {
      obj = JSON.parse(s.raw);
    } catch {
      continue;
    }
    const code = String(obj.Kod_1 ?? "").trim();
    const y = String(obj.Snif1 ?? "").trim() || cfgYear || "";
    if (opts.snif && opts.snif !== "all" && y !== opts.snif) continue;
    parsed.push({ submittedAt: s.submittedAt, obj, code, year: y });
  }

  // Attachment-state filter — same shape as the /nedarim/forms page.
  let filtered = parsed;
  if (opts.stat && opts.stat !== "all") {
    const bucketCounts = new Map<string, number>();
    for (const r of parsed) {
      if (!r.code) continue;
      const key = `${r.year}|${r.code}`;
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }
    const uniqueYears = [...new Set(parsed.map((p) => p.year).filter(Boolean))];
    const uniqueCodes = [...new Set(parsed.map((p) => p.code).filter(Boolean))];
    const students = uniqueCodes.length
      ? await prisma.student.findMany({
          where: {
            year: { in: uniqueYears },
            personalCode: { in: uniqueCodes },
          },
          select: {
            year: true,
            personalCode: true,
            nedarimHook: true,
            registeredEshel: true,
          },
        })
      : [];
    const byYearCode = new Map(
      students.map((s) => [`${s.year}|${s.personalCode}`, s])
    );
    filtered = parsed.filter((r) => {
      if (opts.stat === "no-code") return !r.code;
      if (opts.stat === "no-hook") {
        const tx = String(r.obj.TransactionId ?? "").trim();
        return !tx;
      }
      if (opts.stat === "with-notes") {
        const notes = String(r.obj.Notes ?? "").trim();
        return !!notes;
      }
      if (opts.stat === "duplicates") {
        if (!r.code) return false;
        return (bucketCounts.get(`${r.year}|${r.code}`) ?? 0) > 1;
      }
      if (!r.code) return false;
      const st = byYearCode.get(`${r.year}|${r.code}`);
      if (opts.stat === "unmatched") return !st;
      if (opts.stat === "hook") return !!st?.nedarimHook;
      if (opts.stat === "eshel") return !!st?.registeredEshel;
      return true;
    });
  }

  const filterParts: string[] = [];
  if (opts.snif && opts.snif !== "all") filterParts.push(opts.snif);
  if (opts.stat && opts.stat !== "all") filterParts.push(opts.stat);
  const filterLabel = filterParts.join("_") || "all";

  return {
    rows: filtered.map(({ submittedAt, obj }) => ({ submittedAt, obj })),
    filterLabel,
  };
}

function safeSheetName(name: string): string {
  return name.replace(/[\[\]:*?/\\]/g, "_").trim().slice(0, 31) || "טפסים";
}

function safeTableName(seed: string): string {
  return `TBL_${seed.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 32) || "TBL_FORMS";
}

/** Fetch the cell value for a given column key from one submission row. */
function valueOf(
  key: string,
  row: { submittedAt: Date | null; obj: Record<string, unknown> }
): string | number {
  if (key === "__submittedAt") {
    return row.submittedAt
      ? row.submittedAt.toLocaleString("he-IL", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";
  }
  const v = row.obj[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function buildFormsWorkbook(opts: {
  tofesId: string;
  snif?: string;
  stat?: StatFilter;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { rows, filterLabel } = await loadFormRows(opts);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeSheetName(`טופס ${opts.tofesId}`), {
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, rightToLeft: true }],
  });

  // Width = max(header, widest cell) capped at 48, min 6.
  const widths = COLUMNS.map((col) => {
    let max = col.label.length;
    for (const r of rows) {
      const s = String(valueOf(col.key, r));
      if (s.length > max) max = s.length;
    }
    return Math.max(6, Math.min(48, max + 3));
  });

  ws.columns = COLUMNS.map((col, i) => ({
    header: col.label,
    key: col.key,
    width: widths[i],
  }));

  const dataRows = rows.map((r) => COLUMNS.map((col) => valueOf(col.key, r)));

  ws.addTable({
    name: safeTableName(opts.tofesId + filterLabel),
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: COLUMNS.map((col) => ({ name: col.label, filterButton: true })),
    rows: dataRows,
  });
  for (let i = 0; i < widths.length; i++) ws.getColumn(i + 1).width = widths[i];

  const arr = await wb.xlsx.writeBuffer();
  const filename = `טופס_${opts.tofesId}_${filterLabel}.xlsx`;
  return { buffer: Buffer.from(arr as ArrayBuffer), filename };
}
