import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import * as XLSX from "xlsx";
import * as path from "node:path";
import * as fs from "node:fs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Column map for "כל הבחורים" sheet (1-based → zero-based already by XLSX)
// A:ישיבה B:קוד אישי C:רשום באש"ל D:תקנון E:שם פרטי F:משפחה G:שם האב H:עיר
// I:שיעור J:חו"ל/אר"י K:מחיר L:אמצעי תשלום M:תשלומים N:תשלום אשראי נדרים
// O-T:תשלום 1-6 U:סה"כ שולם V:נשאר לתשלום W:תאריך סיום X:הערות Y:מספר הוק בנדרים
const COL = {
  yeshiva: 0,
  personalCode: 1,
  registeredEshel: 2,
  firstName: 4,
  lastName: 5,
  fatherName: 6,
  city: 7,
  shiur: 8,
  ariChul: 9,
  price: 10,
  paymentMethod: 11,
  paymentsCount: 12,
  paymentNedarim: 13,
  payment1: 14,
  payment2: 15,
  payment3: 16,
  payment4: 17,
  payment5: 18,
  payment6: 19,
  endDate: 22,
  notes: 23,
  nedarimHook: 24,
} as const;

function isErrorValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || s === "#N/A" || s === "#REF!" || s === "#VALUE!" || s === "#DIV/0!";
  }
  return false;
}

function asString(v: unknown): string | null {
  if (isErrorValue(v)) return null;
  return String(v).trim() || null;
}

function asNumber(v: unknown): number | null {
  if (isErrorValue(v)) return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n === null ? null : Math.round(n);
}

function asBool(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "כן";
}

/** generate a 6-digit random code, checking a seen set to avoid dups */
function generateCode(seen: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!seen.has(code)) {
      seen.add(code);
      return code;
    }
  }
  throw new Error("Unable to generate a unique 6-digit code");
}

function normalizeCode(raw: unknown, seen: Set<string>): string {
  const n = asInt(raw);
  if (n !== null && n > 0) {
    const s = String(n);
    // codes of all sizes kept, pad to 6 with random prefix if shorter
    if (s.length === 6 && !seen.has(s)) {
      seen.add(s);
      return s;
    }
    if (s.length < 6) {
      // try zero-pad first (preserves original number), then random generate
      const padded = s.padStart(6, "0");
      if (!seen.has(padded)) {
        seen.add(padded);
        return padded;
      }
    }
  }
  return generateCode(seen);
}

async function main() {
  // Guard: only seed if Students table is empty.
  const existingCount = await prisma.student.count();
  if (existingCount > 0) {
    console.log(`Students table already has ${existingCount} rows — skipping import.`);
    return;
  }

  const xlsxPath = process.env.IMPORT_XLSX ?? "./prisma/seed-data.xlsx";
  const absPath = path.resolve(xlsxPath);

  if (!fs.existsSync(absPath)) {
    console.warn(`Import file not found at ${absPath} — skipping (set IMPORT_XLSX).`);
    return;
  }

  const year = process.env.ACTIVE_YEAR ?? 'תשפ"ו';

  console.log(`Reading ${absPath}...`);
  const wb = XLSX.readFile(absPath, { cellDates: true });
  const ws = wb.Sheets["כל הבחורים"];
  if (!ws) {
    console.error(`Sheet "כל הבחורים" not found. Available: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  console.log(`Sheet has ${rows.length} rows (including header)`);

  const codesSeen = new Set<string>();
  const parentsMap = new Map<string, string>(); // key: "fatherName|lastName" → parent.id

  let parentsCreated = 0;
  let studentsCreated = 0;
  let paymentsCreated = 0;
  let skipped = 0;

  // skip row 0 (header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { skipped++; continue; }

    const firstName = asString(row[COL.firstName]);
    const lastName = asString(row[COL.lastName]);
    if (!firstName || !lastName) { skipped++; continue; }

    const fatherName = asString(row[COL.fatherName]) ?? "";
    const city = asString(row[COL.city]);
    const yeshiva = asString(row[COL.yeshiva]) ?? "לא משובץ";

    // parent grouping key
    const parentKey = `${fatherName.trim()}|${lastName.trim()}`;
    let parentId = parentsMap.get(parentKey);
    if (!parentId) {
      const parent = await prisma.parent.create({
        data: {
          firstName: fatherName || "(לא ידוע)",
          lastName,
          city,
        },
      });
      parentId = parent.id;
      parentsMap.set(parentKey, parentId);
      parentsCreated++;
    }

    const personalCode = normalizeCode(row[COL.personalCode], codesSeen);

    const endDateLabel = asString(row[COL.endDate]);
    const nedarimHook = asString(row[COL.nedarimHook]);

    const student = await prisma.student.create({
      data: {
        year,
        personalCode,
        parentId,
        firstName,
        lastName,
        fatherName,
        city,
        yeshiva,
        shiur: asString(row[COL.shiur]),
        ariChul: asString(row[COL.ariChul]),
        price: asInt(row[COL.price]),
        paymentMethod: asString(row[COL.paymentMethod]),
        paymentsCount: asInt(row[COL.paymentsCount]),
        nedarimHook,
        endDateLabel,
        registeredEshel: asBool(row[COL.registeredEshel]),
        notes: asString(row[COL.notes]),
      },
    });
    studentsCreated++;

    // Payments: col N (Nedarim) = paymentNumber 0, cols O-T (1-6) = paymentNumber 1..6
    const paymentCols = [
      { num: 0, col: COL.paymentNedarim, method: "נדרים פלוס" },
      { num: 1, col: COL.payment1, method: null },
      { num: 2, col: COL.payment2, method: null },
      { num: 3, col: COL.payment3, method: null },
      { num: 4, col: COL.payment4, method: null },
      { num: 5, col: COL.payment5, method: null },
      { num: 6, col: COL.payment6, method: null },
    ];
    for (const p of paymentCols) {
      const amt = asNumber(row[p.col]);
      if (amt !== null && amt > 0) {
        await prisma.payment.create({
          data: {
            studentId: student.id,
            paymentNumber: p.num,
            amount: amt,
            method: p.method,
          },
        });
        paymentsCreated++;
      }
    }

    if (studentsCreated % 200 === 0) {
      console.log(`... ${studentsCreated} students processed`);
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Parents created:  ${parentsCreated}`);
  console.log(`  Students created: ${studentsCreated}`);
  console.log(`  Payments created: ${paymentsCreated}`);
  console.log(`  Rows skipped:     ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
