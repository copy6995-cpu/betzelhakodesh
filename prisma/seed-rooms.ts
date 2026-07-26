/**
 * Seed the Room table from the original room_ranges_new.json used by the
 * Python assignment tool. Each entry maps a room code to a sheet + Excel
 * range; we only need the room code and the sheet name (as "building").
 *
 * Idempotent: upserts by room code, preserves order/active flags on re-runs.
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";

const DEFAULT_JSON = path.resolve(
  __dirname,
  "..",
  "..",
  "תשפו",
  "תוכנה",
  "room_ranges_new.json"
);

async function main() {
  const src = process.env.ROOMS_JSON ?? DEFAULT_JSON;
  if (!fs.existsSync(src)) {
    console.error(`Rooms JSON not found: ${src}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(src, "utf8");
  const data = JSON.parse(raw) as Record<
    string,
    { sheet: string; range: string }
  >;

  let created = 0;
  let updated = 0;
  let order = 0;
  for (const [code, info] of Object.entries(data)) {
    const building = info.sheet;
    const existing = await prisma.room.findUnique({ where: { code } });
    if (existing) {
      await prisma.room.update({
        where: { code },
        data: { building, order: order++ },
      });
      updated++;
    } else {
      await prisma.room.create({
        data: { code, building, order: order++, active: true },
      });
      created++;
    }
  }
  console.log(
    `Rooms seeded: ${created} new, ${updated} updated, from ${Object.keys(data).length} entries.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
