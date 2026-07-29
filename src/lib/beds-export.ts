/**
 * Export the /yemot/beds student × week matrix to Excel, matching the on-
 * screen table (same filters via loadBedsMatrix): one row per student, one
 * column per week (approved date / "אזל"), an אש"ל flag, a per-student total,
 * and a per-week totals summary row. Approved cells are shaded green and
 * out-of-stock yellow, like the screen.
 */
import ExcelJS from "exceljs";
import { loadBedsMatrix, shortDate } from "./beds-matrix";

const GREEN = "FFC6EFCE";
const YELLOW = "FFFFD966";
const HEADER = "FFDDEBF7";

function fill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export async function buildBedsWorkbook(opts: {
  activeYear: string;
  scope: "year" | "all";
  filter: "" | "not-registered";
  from: Date | null;
  to: Date | null;
}): Promise<{ buffer: Buffer; rowCount: number; weekCount: number }> {
  const m = await loadBedsMatrix(opts);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("הזמנות מיטה", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2, rightToLeft: true }],
  });

  const fixed = ["ישיבה", "שם", "קוד", "שיעור", 'אש"ל'];
  const weekHeaders = m.weeks.map((w) => shortDate(w.latestDate) || w.weekKey);
  const header = [...fixed, ...weekHeaders, 'סה"כ'];
  const headerRow = ws.addRow(header);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => fill(c, HEADER));

  for (const row of m.rows) {
    const cells = m.cells.get(row.code);
    const eshel =
      row.registeredEshel === true
        ? "✓"
        : row.registeredEshel === false
        ? "0"
        : "—";
    const weekVals = m.weeks.map((w) => {
      const c = cells?.get(w.weekKey);
      if (c?.status === "approved") return shortDate(c.date);
      if (c?.status === "outofstock") return "אזל";
      return "";
    });
    const r = ws.addRow([
      row.yeshiva,
      row.name,
      row.code,
      row.shiur ?? "",
      eshel,
      ...weekVals,
      row.approvedCount || "",
    ]);
    // Shade week cells (columns 6..6+weeks-1) by status.
    m.weeks.forEach((w, i) => {
      const c = cells?.get(w.weekKey);
      if (!c) return;
      const cell = r.getCell(6 + i);
      if (c.status === "approved") fill(cell, GREEN);
      else if (c.status === "outofstock") fill(cell, YELLOW);
    });
  }

  const summary = ws.addRow([
    "סיכום",
    "סה״כ הזמינו בשבוע",
    "",
    "",
    "",
    ...m.weeks.map((w) => m.totalByWeek[w.weekKey] || ""),
    m.grandTotal || "",
  ]);
  summary.font = { bold: true };

  // Column widths: name a bit wider, week columns compact.
  ws.getColumn(1).width = 16; // ישיבה
  ws.getColumn(2).width = 22; // שם
  ws.getColumn(3).width = 10; // קוד
  ws.getColumn(4).width = 7; // שיעור
  ws.getColumn(5).width = 6; // אש"ל
  for (let i = 0; i < m.weeks.length; i++) ws.getColumn(6 + i).width = 9;
  ws.getColumn(6 + m.weeks.length).width = 7; // סה"כ

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, rowCount: m.rows.length, weekCount: m.weeks.length };
}
