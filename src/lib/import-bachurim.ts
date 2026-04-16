import * as XLSX from "xlsx";
import { prisma } from "./prisma";

// Column map for "כל הבחורים" sheet (0-indexed).
// Kept in sync with prisma/seed-bachurim.ts.
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

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeCode(raw: unknown, seen: Set<string>): string {
  const n = asInt(raw);
  if (n !== null && n > 0) {
    const s = String(n);
    if (s.length === 6 && !seen.has(s)) {
      seen.add(s);
      return s;
    }
    if (s.length < 6) {
      const padded = s.padStart(6, "0");
      if (!seen.has(padded)) {
        seen.add(padded);
        return padded;
      }
    }
  }
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    if (!seen.has(code)) {
      seen.add(code);
      return code;
    }
  }
  throw new Error("Unable to generate a unique 6-digit code");
}

export type ImportMode = "skip-if-any-exist" | "replace-year";

export type ImportResult = {
  year: string;
  sheetName: string;
  rowsInSheet: number;
  studentsDeleted: number;
  parentsCreated: number;
  studentsCreated: number;
  paymentsCreated: number;
  rowsSkipped: number;
};

/**
 * Parse the "כל הבחורים" sheet from a raw xlsx buffer and import into DB.
 *
 * - mode="skip-if-any-exist": no-op if any students already exist for the year.
 *   Used by the Docker-entrypoint seed.
 * - mode="replace-year": wipes Student+Payment rows for the given year first,
 *   then imports. Parent rows persist (they outlive years).
 */
export async function importBachurimFromBuffer(
  buffer: Buffer,
  year: string,
  mode: ImportMode = "replace-year"
): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { cellDates: true });
  const sheetName = "כל הבחורים";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `הגיליון "${sheetName}" לא נמצא. גיליונות זמינים: ${wb.SheetNames.join(", ")}`
    );
  }
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  let studentsDeleted = 0;
  if (mode === "skip-if-any-exist") {
    const existing = await prisma.student.count({ where: { year } });
    if (existing > 0) {
      return {
        year,
        sheetName,
        rowsInSheet: rows.length,
        studentsDeleted: 0,
        parentsCreated: 0,
        studentsCreated: 0,
        paymentsCreated: 0,
        rowsSkipped: 0,
      };
    }
  } else if (mode === "replace-year") {
    // Delete payments for students in this year (cascade only cascades if relation
    // is configured with onDelete: Cascade — which it is for Payment).
    const toDelete = await prisma.student.findMany({
      where: { year },
      select: { id: true },
    });
    if (toDelete.length) {
      await prisma.payment.deleteMany({
        where: { studentId: { in: toDelete.map((s) => s.id) } },
      });
      const del = await prisma.student.deleteMany({ where: { year } });
      studentsDeleted = del.count;
    }
  }

  const codesSeen = new Set<string>();
  const parentKeyToId = new Map<string, string>();
  let parentsCreated = 0;
  let studentsCreated = 0;
  let paymentsCreated = 0;
  let rowsSkipped = 0;

  // Skip row 0 (header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { rowsSkipped++; continue; }

    const firstName = asString(row[COL.firstName]);
    const lastName = asString(row[COL.lastName]);
    if (!firstName || !lastName) { rowsSkipped++; continue; }

    const fatherName = asString(row[COL.fatherName]) ?? "";
    const city = asString(row[COL.city]);
    const yeshiva = asString(row[COL.yeshiva]) ?? "לא משובץ";

    const parentKey = `${fatherName.trim()}|${lastName.trim()}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      // Try to find an existing parent from a prior import.
      const existing = await prisma.parent.findFirst({
        where: {
          firstName: fatherName || "(לא ידוע)",
          lastName,
        },
      });
      if (existing) {
        parentId = existing.id;
      } else {
        const created = await prisma.parent.create({
          data: {
            firstName: fatherName || "(לא ידוע)",
            lastName,
            city,
          },
        });
        parentId = created.id;
        parentsCreated++;
      }
      parentKeyToId.set(parentKey, parentId);
    }

    const personalCode = normalizeCode(row[COL.personalCode], codesSeen);

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
        nedarimHook: asString(row[COL.nedarimHook]),
        endDateLabel: asString(row[COL.endDate]),
        registeredEshel: asBool(row[COL.registeredEshel]),
        notes: asString(row[COL.notes]),
      },
    });
    studentsCreated++;

    const paymentCols: Array<{ num: number; col: number; method: string | null }> = [
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
  }

  return {
    year,
    sheetName,
    rowsInSheet: rows.length,
    studentsDeleted,
    parentsCreated,
    studentsCreated,
    paymentsCreated,
    rowsSkipped,
  };
}
