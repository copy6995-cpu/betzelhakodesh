import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const YESHIVOT = [
  "ברכת אהרן",
  "חיפה",
  "ירושלים",
  "קריית הרצוג",
  "דובר שלום",
  "ישמח לב",
  "בני ברק",
  "ביתר",
  "בית שמש",
];

const SHIURIM = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

const END_DATES = ["סוף שנה", "חנוכה", "סוכות", "פסח"];

async function main() {
  const activeYear = process.env.ACTIVE_YEAR ?? 'תשפ"ו';

  for (let i = 0; i < YESHIVOT.length; i++) {
    await prisma.yeshiva.upsert({
      where: { name: YESHIVOT[i] },
      update: { displayOrder: i },
      create: { name: YESHIVOT[i], displayOrder: i, active: true },
    });
  }
  console.log(`Yeshivot seeded: ${YESHIVOT.length}`);

  for (let i = 0; i < SHIURIM.length; i++) {
    await prisma.shiur.upsert({
      where: { name: SHIURIM[i] },
      update: { displayOrder: i },
      create: { name: SHIURIM[i], displayOrder: i },
    });
  }
  console.log(`Shiurim seeded: ${SHIURIM.length}`);

  for (const label of END_DATES) {
    await prisma.endDateOption.upsert({
      where: { year_label: { year: activeYear, label } },
      update: {},
      create: { year: activeYear, label },
    });
  }
  console.log(`EndDate options seeded for ${activeYear}: ${END_DATES.length}`);

  await prisma.appSetting.upsert({
    where: { key: "active_year" },
    update: { value: activeYear },
    create: { key: "active_year", value: activeYear },
  });
  console.log(`Active year: ${activeYear}`);
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
