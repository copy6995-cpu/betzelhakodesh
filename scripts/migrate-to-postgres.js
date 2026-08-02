/**
 * One-time data migration: betzel.db (SQLite) → Supabase Postgres.
 * Reads each table with better-sqlite3, converts booleans (0/1 → true/false),
 * and bulk-inserts via raw pg (ISO date strings are parsed by Postgres as-is).
 * Idempotent: ON CONFLICT DO NOTHING, so it can be re-run safely.
 */
require("dotenv").config();
const Database = require("better-sqlite3");
const { Client } = require("pg");

// FK-safe order: parents before children (Student→Parent, Payment→Student,
// RoomAllocation→Room); everything else is independent.
const ORDER = [
  "User", "AppSetting", "Yeshiva", "Shiur", "EndDateOption",
  "NedarimFormConfig", "YemotSource", "Room", "CalendarConfig", "CalendarWeek",
  "YemotBedReservation", "YemotCreditCard", "NedarimKeva",
  "NedarimTransaction", "NedarimFormSubmission",
  "Parent", "Student", "Payment", "RoomAllocation",
];

(async () => {
  const sqlite = new Database("betzel.db", { readonly: true });
  const pg = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();
  console.log("connected to Postgres\n");

  let grand = 0;
  for (const table of ORDER) {
    const cols = (
      await pg.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [table]
      )
    ).rows;
    if (cols.length === 0) {
      console.log(`  ${table}: (no such table in Postgres, skipped)`);
      continue;
    }
    const colNames = cols.map((c) => c.column_name);
    const boolCols = new Set(
      cols.filter((c) => c.data_type === "boolean").map((c) => c.column_name)
    );

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) {
      console.log(`  ${table}: 0`);
      continue;
    }

    const quoted = colNames.map((c) => `"${c}"`).join(",");
    const perRow = colNames.length;
    const chunkSize = Math.max(1, Math.floor(60000 / perRow));
    let inserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const params = [];
      const tuples = chunk.map((row) => {
        const ph = colNames.map((col) => {
          let v = row[col];
          if (v === undefined) v = null;
          if (v !== null && boolCols.has(col)) v = v === 1 || v === true || v === "1";
          params.push(v);
          return `$${params.length}`;
        });
        return `(${ph.join(",")})`;
      });
      const sql = `INSERT INTO "${table}" (${quoted}) VALUES ${tuples.join(
        ","
      )} ON CONFLICT DO NOTHING`;
      const r = await pg.query(sql, params);
      inserted += r.rowCount;
    }
    grand += inserted;
    console.log(`  ${table}: ${inserted} / ${rows.length}`);
  }

  console.log(`\n✅ migrated ${grand} rows total`);
  await pg.end();
  sqlite.close();
})().catch((e) => {
  console.error("❌ migration failed:", e.message);
  process.exit(1);
});
