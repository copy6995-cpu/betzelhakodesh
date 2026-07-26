/**
 * One-shot migration: parse the Postgres `pg_dump` file we saved from the old
 * cloud deployment and insert every row into the fresh local SQLite database.
 *
 * Runs after `prisma db push` has created the empty tables. Idempotent:
 * exits without touching anything if the DB already has students.
 *
 * Usage:
 *   npx tsx scripts/migrate-from-pg-dump.ts [path/to/betzel-dump.sql]
 *
 * Default dump path is `../betzel-dump.sql` (parent of the app folder), which
 * matches where scp landed the file on this machine.
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";

const DEFAULT_DUMP_PATH = path.resolve(__dirname, "..", "..", "betzel-dump.sql");

// The order rows must be inserted in to satisfy FK constraints:
// User & AppSetting & Yeshiva & Shiur & EndDateOption are independent.
// Parent must be inserted before Student. Student before Payment.
const INSERT_ORDER = [
  "User",
  "AppSetting",
  "Yeshiva",
  "Shiur",
  "EndDateOption",
  "Parent",
  "Student",
  "Payment",
] as const;

type TableName = (typeof INSERT_ORDER)[number];

type ParsedTable = {
  table: TableName;
  columns: string[];
  rows: (string | null)[][];
};

/** Split a COPY block's row line by TAB. Postgres pg_dump escapes tabs
 *  and newlines inside string values, so a raw split on \t is safe. */
function splitCopyRow(line: string): (string | null)[] {
  return line.split("\t").map((p) => (p === "\\N" ? null : unescapeCell(p)));
}

/** Single-pass unescape of a pg_dump COPY cell.
 *  Recognized escapes: \\ \t \n \r \b \f \v. Unknown sequences are passed
 *  through as the raw char. */
function unescapeCell(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") { out += ch; continue; }
    const next = s[++i];
    switch (next) {
      case "t": out += "\t"; break;
      case "n": out += "\n"; break;
      case "r": out += "\r"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "\\": out += "\\"; break;
      default: out += next ?? ""; break;
    }
  }
  return out;
}


/** Extract all COPY blocks from the dump. Non-target tables are ignored. */
function parseDump(sql: string): Map<TableName, ParsedTable> {
  const out = new Map<TableName, ParsedTable>();
  const lines = sql.split(/\r?\n/);

  let current: ParsedTable | null = null;
  for (const line of lines) {
    if (current) {
      if (line === "\\.") {
        out.set(current.table, current);
        current = null;
      } else {
        current.rows.push(splitCopyRow(line));
      }
      continue;
    }

    // Match: COPY public."TableName" (col1, "col2", ...) FROM stdin;
    const m = line.match(/^COPY public\."([A-Za-z]+)" \(([^)]+)\) FROM stdin;/);
    if (!m) continue;
    const table = m[1] as TableName;
    if (!(INSERT_ORDER as readonly string[]).includes(table)) continue;
    const columns = m[2]
      .split(",")
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    current = { table, columns, rows: [] };
  }

  return out;
}

/** Convert a raw pg cell into a JS value fit for Prisma. `hint` tells us
 *  whether to coerce to number / boolean / Date. */
function coerce(
  value: string | null,
  hint: "string" | "int" | "float" | "bool" | "date"
): unknown {
  if (value === null) return null;
  switch (hint) {
    case "string":
      return value;
    case "int":
      return parseInt(value, 10);
    case "float":
      return parseFloat(value);
    case "bool":
      return value === "t" || value === "true";
    case "date":
      // Postgres timestamps come out like "2026-04-16 05:28:51.682".
      // Add "Z" so Date treats them as UTC (matches the original DB).
      return new Date(value.replace(" ", "T") + "Z");
  }
}

/** Per-table column-to-type map. Any column absent here defaults to string. */
const COLUMN_TYPES: Record<TableName, Record<string, ReturnType<typeof coerce> extends unknown ? "string" | "int" | "float" | "bool" | "date" : never>> = {
  AppSetting: { key: "string", value: "string" },
  EndDateOption: { id: "string", year: "string", label: "string", date: "date" },
  Parent: {
    id: "string",
    tz: "string",
    phone: "string",
    email: "string",
    firstName: "string",
    lastName: "string",
    city: "string",
    notes: "string",
    createdAt: "date",
    updatedAt: "date",
  },
  Payment: {
    id: "string",
    studentId: "string",
    paymentNumber: "int",
    amount: "float",
    method: "string",
    date: "date",
    externalRef: "string",
    notes: "string",
    createdAt: "date",
  },
  Shiur: { id: "string", name: "string", displayOrder: "int" },
  Student: {
    id: "string",
    year: "string",
    personalCode: "string",
    parentId: "string",
    firstName: "string",
    lastName: "string",
    fatherName: "string",
    city: "string",
    yeshiva: "string",
    shiur: "string",
    ariChul: "string",
    price: "int",
    paymentMethod: "string",
    paymentsCount: "int",
    nedarimHook: "string",
    endDateLabel: "string",
    endDate: "date",
    registeredEshel: "bool",
    notes: "string",
    archived: "bool",
    createdAt: "date",
    updatedAt: "date",
  },
  User: {
    id: "string",
    email: "string",
    name: "string",
    passwordHash: "string",
    role: "string",
    createdAt: "date",
    updatedAt: "date",
  },
  Yeshiva: {
    id: "string",
    name: "string",
    displayOrder: "int",
    active: "bool",
  },
};

/** Build a plain object of { column: value } from a parsed row. */
function rowToObject(table: TableName, columns: string[], row: (string | null)[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const types = COLUMN_TYPES[table];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const hint = types[col] ?? "string";
    obj[col] = coerce(row[i], hint);
  }
  return obj;
}

async function insertBatch(table: TableName, records: Record<string, unknown>[]): Promise<number> {
  if (records.length === 0) return 0;
  // SQLite's Prisma driver doesn't support skipDuplicates; the outer
  // idempotency guard (student count) makes it moot anyway.
  const model = (prisma as unknown as Record<string, { createMany: (args: { data: unknown[] }) => Promise<{ count: number }> }>)[
    table.charAt(0).toLowerCase() + table.slice(1)
  ];
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const res = await model.createMany({ data: chunk });
    inserted += res.count;
  }
  return inserted;
}

async function main() {
  const dumpPath = process.argv[2] ?? DEFAULT_DUMP_PATH;
  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump file not found: ${dumpPath}`);
    console.error(
      "Pass the path as an argument, or place betzel-dump.sql alongside the app folder."
    );
    process.exit(1);
  }

  // Idempotency guard.
  const existing = await prisma.student.count();
  if (existing > 0) {
    console.log(`DB already has ${existing} students — skipping import.`);
    return;
  }

  console.log(`Reading dump from ${dumpPath}...`);
  const sql = fs.readFileSync(dumpPath, "utf8");
  const parsed = parseDump(sql);
  console.log(`Parsed ${parsed.size} tables.`);

  for (const table of INSERT_ORDER) {
    const t = parsed.get(table);
    if (!t) {
      console.log(`  ${table}: no rows in dump.`);
      continue;
    }
    const records = t.rows.map((r) => rowToObject(table, t.columns, r));
    const n = await insertBatch(table, records);
    console.log(`  ${table}: ${n}/${t.rows.length} inserted.`);
  }

  console.log("\nMigration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
