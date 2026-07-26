import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { normalizeName } from "./names";

/**
 * Header-detected column mapping. The importer sniffs the first row of the
 * "כל הבחורים" sheet and figures out which column is which. This lets us
 * accept both the historical "בצילא [שנה].xlsx" layout (which has prices +
 * payment columns) and the newer "רשימה סופית תשפ"ז להעלאה.xlsx" layout
 * (roster-only, no prices) from the same code path.
 *
 * Add a new alias here if a future column shows up under a new name.
 */
const HEADER_ALIASES = {
  personalCode: ["קוד התלמיד", "קוד תלמיד", "קוד אישי", "קוד"],
  firstName: ["שם הבחור", "שם פרטי", "שם הילד"],
  lastName: ["משפחה", "שם משפחה"],
  fatherName: ["שם האב", "אב"],
  city: ["עיר", "יישוב"],
  shiur: ["שיעור", "כיתה"],
  yeshiva: ["ישיבה"],
  ariChul: ["מסלול", 'חו"ל/אר"י', "אר\"י/חו\"ל", "חול/ארי"],
  branch: ["תוקף", "קהילה", "סניף", "בית מדרש"],
  yeshivaCode: ["קוד ישיבה"],
  homePhone: ["טלפון", "טלפון בית"],
  phone: ["פלאפון", "פלאפון אב", "טלפון אב", "טלפון נייד"],
  motherPhone: ["פלאפון אם", "טלפון אם"],
  email: ["מייל", "אימייל", "דוא\"ל", "email"],
  registeredEshel: ["רישום לאשל", "אשל", "רשום באש\"ל"],
  price: ["מחיר", "סכום", "מחיר תלמיד"],
  paymentMethod: ["אמצעי תשלום", "אופן תשלום"],
  paymentsCount: ["מספר תשלומים", "תשלומים"],
  endDate: ["תאריך סיום", "עד מתי", "תוקף עד"],
  notes: ["הערות", "הערה"],
  nedarimHook: ["הוראת קבע", "הוק", "מספר הוק"],
  paymentNedarim: ["נדרים פלוס", "נדרים"],
  payment1: ["תשלום 1", "תשלום א"],
  payment2: ["תשלום 2", "תשלום ב"],
  payment3: ["תשלום 3", "תשלום ג"],
  payment4: ["תשלום 4", "תשלום ד"],
  payment5: ["תשלום 5", "תשלום ה"],
  payment6: ["תשלום 6", "תשלום ו"],
} as const;

type Field = keyof typeof HEADER_ALIASES;
type ColMap = Partial<Record<Field, number>>;

function detectColumns(header: unknown[]): ColMap {
  const map: ColMap = {};
  const norm = header.map((h) => String(h ?? "").trim().toLowerCase());
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const aliases = HEADER_ALIASES[field].map((s) => s.trim().toLowerCase());
    for (let i = 0; i < norm.length; i++) {
      if (aliases.includes(norm[i])) {
        map[field] = i;
        break;
      }
    }
  }
  return map;
}

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

/** Excel dates are day-serial numbers. Convert to a JS Date, or null. */
function asDate(v: unknown): Date | null {
  if (isErrorValue(v)) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel epoch is 1899-12-30 UTC.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  const dmy = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(s);
  if (dmy) {
    return new Date(
      parseInt(dmy[3], 10),
      parseInt(dmy[2], 10) - 1,
      parseInt(dmy[1], 10)
    );
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
  detectedColumns: Record<string, number>;
};

/**
 * Parse the "כל הבחורים" sheet from a raw xlsx buffer and import into DB.
 *
 * - mode="skip-if-any-exist": no-op if any students already exist for the year.
 *   Used by the Docker-entrypoint seed.
 * - mode="replace-year": wipes Student+Payment rows for the given year first,
 *   then imports. Parent rows persist (they outlive years).
 *
 * Column layout is detected from the header row — both the legacy format
 * (with prices/payments) and the newer "רשימה סופית" format (roster only)
 * work through the same code path.
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
  if (rows.length === 0) throw new Error("הגיליון ריק");

  const columns = detectColumns(rows[0] ?? []);
  // Required fields — at minimum we need names to build a Student.
  const required: Field[] = ["firstName", "lastName"];
  for (const f of required) {
    if (columns[f] === undefined) {
      throw new Error(
        `כותרת חובה חסרה בגיליון: "${f}". וודא שהעמודות "שם הבחור" ו-"משפחה" קיימות.`
      );
    }
  }

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
        detectedColumns: columns as Record<string, number>,
      };
    }
  } else if (mode === "replace-year") {
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

  function get(row: unknown[], field: Field): unknown {
    const idx = columns[field];
    return idx === undefined ? null : row[idx];
  }

  // Skip row 0 (header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      rowsSkipped++;
      continue;
    }

    const firstName = asString(get(row, "firstName"));
    const lastName = asString(get(row, "lastName"));
    if (!firstName || !lastName) {
      rowsSkipped++;
      continue;
    }

    const fatherName = asString(get(row, "fatherName")) ?? "";
    const city = asString(get(row, "city"));
    const yeshiva = asString(get(row, "yeshiva")) ?? "שיעור א' - לא שובץ";
    const phone = asString(get(row, "phone"));
    const homePhone = asString(get(row, "homePhone"));
    const motherPhone = asString(get(row, "motherPhone"));
    const email = asString(get(row, "email"));

    // Parent bucketing — same normalized father+family collapses to one row.
    const normFather = normalizeName(fatherName);
    const normLast = normalizeName(lastName);
    const parentKey = `${normFather}|${normLast}`;
    let parentId = parentKeyToId.get(parentKey);
    if (!parentId) {
      const candidates = await prisma.parent.findMany({
        where: { lastName },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          homePhone: true,
          motherPhone: true,
          email: true,
        },
      });
      const match = candidates.find(
        (p) =>
          normalizeName(p.firstName) === normFather &&
          normalizeName(p.lastName) === normLast
      );
      if (match) {
        parentId = match.id;
        // Fill in any parent-level contact info this row has that the DB is
        // missing. Never overwrite existing values — assume the DB might be
        // more up-to-date than a bulk-uploaded roster.
        const updates: Record<string, string | null> = {};
        if (!match.phone && phone) updates.phone = phone;
        if (!match.homePhone && homePhone) updates.homePhone = homePhone;
        if (!match.motherPhone && motherPhone) updates.motherPhone = motherPhone;
        if (!match.email && email) updates.email = email;
        if (Object.keys(updates).length > 0) {
          await prisma.parent.update({ where: { id: match.id }, data: updates });
        }
      } else {
        const created = await prisma.parent.create({
          data: {
            firstName: fatherName || "(לא ידוע)",
            lastName,
            city,
            phone,
            homePhone,
            motherPhone,
            email,
          },
        });
        parentId = created.id;
        parentsCreated++;
      }
      parentKeyToId.set(parentKey, parentId);
    }

    const personalCode = normalizeCode(get(row, "personalCode"), codesSeen);

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
        shiur: asString(get(row, "shiur")),
        ariChul: asString(get(row, "ariChul")),
        branch: asString(get(row, "branch")),
        yeshivaCode: asString(get(row, "yeshivaCode")),
        price: asInt(get(row, "price")),
        paymentMethod: asString(get(row, "paymentMethod")),
        paymentsCount: asInt(get(row, "paymentsCount")),
        nedarimHook: asString(get(row, "nedarimHook")),
        endDateLabel: asString(get(row, "endDate")),
        endDate: asDate(get(row, "endDate")),
        registeredEshel: asBool(get(row, "registeredEshel")),
        notes: asString(get(row, "notes")),
      },
    });
    studentsCreated++;

    // Payment columns only exist in the legacy layout — silently skipped
    // when the roster-only layout is uploaded (they won't be detected).
    const paymentFields: Array<{ num: number; field: Field; method: string | null }> = [
      { num: 0, field: "paymentNedarim", method: "נדרים פלוס" },
      { num: 1, field: "payment1", method: null },
      { num: 2, field: "payment2", method: null },
      { num: 3, field: "payment3", method: null },
      { num: 4, field: "payment4", method: null },
      { num: 5, field: "payment5", method: null },
      { num: 6, field: "payment6", method: null },
    ];
    for (const p of paymentFields) {
      if (columns[p.field] === undefined) continue;
      const amt = asNumber(get(row, p.field));
      if (amt !== null && amt > 0) {
        await prisma.payment.create({
          data: {
            studentId: student.id,
            paymentNumber: p.num,
            amount: amt,
            method: p.method,
            // Every payment cell from the source xlsx is treated as "legacy"
            // — the office asked to be able to purge these in bulk once
            // Nedarim + manual entries take over.
            source: "legacy",
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
    detectedColumns: columns as Record<string, number>,
  };
}
