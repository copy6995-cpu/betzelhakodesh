/**
 * Export parents who still owe money (remaining balance > threshold) for a
 * given year, as a single-sheet Excel workbook — a collections worklist.
 *
 * Balance per parent = Σ(child price) − Σ(child payments) across that parent's
 * children in the year, exactly how /parents computes it. Sorted biggest-debt
 * first. Uses the same ExcelJS table + frozen RTL header pattern as
 * bachurim-export.ts (SheetJS Community drops freeze panes + table objects).
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";

export type ParentExportRow = {
  parentName: string;
  phone: string | null;
  tz: string | null;
  email: string | null;
  childrenCount: number;
  childrenNames: string;
  price: number;
  paid: number;
  remaining: number;
};

const COLUMNS: Array<{ header: string; key: keyof ParentExportRow }> = [
  { header: "שם הורה", key: "parentName" },
  { header: "טלפון", key: "phone" },
  { header: "ת.ז.", key: "tz" },
  { header: "מייל", key: "email" },
  { header: "ילדים", key: "childrenCount" },
  { header: "שמות הילדים", key: "childrenNames" },
  { header: 'סה"כ מחיר', key: "price" },
  { header: "שולם", key: "paid" },
  { header: "יתרה", key: "remaining" },
];

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\n\r\t]/g, "_").trim() || "הורים";
}

/** Parents with a balance strictly greater than `minBalance` (default 1₪),
 *  biggest debt first. */
export async function loadParentsWithBalance(opts: {
  year: string;
  minBalance?: number;
}): Promise<ParentExportRow[]> {
  const minBalance = opts.minBalance ?? 1;
  const parents = await prisma.parent.findMany({
    where: { students: { some: { year: opts.year, archived: false } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      students: {
        where: { year: opts.year, archived: false },
        select: {
          firstName: true,
          lastName: true,
          price: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const rows: ParentExportRow[] = [];
  for (const p of parents) {
    const price = p.students.reduce((a, s) => a + (s.price ?? 0), 0);
    const paid = p.students.reduce(
      (a, s) => a + s.payments.reduce((b, x) => b + Number(x.amount), 0),
      0
    );
    const remaining = price - paid;
    if (remaining <= minBalance) continue;
    rows.push({
      parentName: `${p.lastName} ${p.firstName}`.trim(),
      phone: p.phone ?? null,
      tz: p.tz ?? null,
      email: p.email ?? null,
      childrenCount: p.students.length,
      childrenNames: p.students
        .map((s) => `${s.lastName} ${s.firstName}`.trim())
        .join(", "),
      price,
      paid,
      remaining,
    });
  }
  rows.sort((a, b) => b.remaining - a.remaining);
  return rows;
}

function autoColumnWidths(rows: ParentExportRow[]): number[] {
  return COLUMNS.map((col) => {
    let max = col.header.length;
    for (const r of rows) {
      const v = r[col.key];
      const s = v === null || v === undefined ? "" : String(v);
      if (s.length > max) max = s.length;
    }
    return Math.max(6, Math.min(48, max + 3));
  });
}

function rowToArray(r: ParentExportRow): (string | number)[] {
  return COLUMNS.map((col) => {
    const v = r[col.key];
    return v === null || v === undefined ? "" : v;
  });
}

export async function buildParentsBalanceWorkbook(opts: {
  year: string;
  minBalance?: number;
}): Promise<{ buffer: Buffer; count: number; totalDebt: number }> {
  const rows = await loadParentsWithBalance(opts);
  const totalDebt = rows.reduce((a, r) => a + r.remaining, 0);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("הורים עם יתרה", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, rightToLeft: true }],
  });
  const widths = autoColumnWidths(rows);
  ws.columns = COLUMNS.map((col, i) => ({
    header: col.header,
    key: col.key,
    width: widths[i],
  }));
  ws.addTable({
    name: "TBL_ParentsBalance",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: COLUMNS.map((col) => ({ name: col.header, filterButton: true })),
    rows: rows.map(rowToArray),
  });
  for (let i = 0; i < widths.length; i++) {
    ws.getColumn(i + 1).width = widths[i];
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, count: rows.length, totalDebt };
}
