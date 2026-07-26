import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Real yeshivot first (order 0..N), then the two administrative buckets
// at 98/99 so they sit at the end of every dropdown. Students in these two
// are NOT carried forward to a new year by the "העבר תלמידים" flow — that's
// how the admin retires a bachur.
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
const ADMIN_YESHIVOT = ["ארכיון", "שיעור א' - לא שובץ"];

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
  for (let i = 0; i < ADMIN_YESHIVOT.length; i++) {
    await prisma.yeshiva.upsert({
      where: { name: ADMIN_YESHIVOT[i] },
      update: { displayOrder: 98 + i },
      create: { name: ADMIN_YESHIVOT[i], displayOrder: 98 + i, active: true },
    });
  }
  console.log(`Yeshivot seeded: ${YESHIVOT.length + ADMIN_YESHIVOT.length}`);

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

  // Create-only: the entrypoint runs this on every boot in the cloud, and the
  // admin changes the active year from the UI — never overwrite it here.
  await prisma.appSetting.upsert({
    where: { key: "active_year" },
    update: {},
    create: { key: "active_year", value: activeYear },
  });
  console.log(`Active year (create-only): ${activeYear}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
