import "dotenv/config";
import * as path from "node:path";
import * as fs from "node:fs";
import { importBachurimFromBuffer } from "../src/lib/import-bachurim";
import { prisma } from "../src/lib/prisma";

async function main() {
  const xlsxPath = process.env.IMPORT_XLSX ?? "./prisma/seed-data.xlsx";
  const absPath = path.resolve(xlsxPath);

  if (!fs.existsSync(absPath)) {
    console.warn(
      `Import file not found at ${absPath} — skipping (set IMPORT_XLSX or use the web /settings/import UI).`
    );
    return;
  }

  const year = process.env.ACTIVE_YEAR ?? 'תשפ"ו';
  console.log(`Reading ${absPath} for year ${year}...`);

  const buffer = fs.readFileSync(absPath);
  // On first boot only — subsequent deploys already have data and should use
  // the /settings/import admin page to re-sync.
  const result = await importBachurimFromBuffer(buffer, year, "skip-if-any-exist");

  if (result.studentsCreated === 0 && result.rowsInSheet > 1) {
    console.log(
      `Skipped: ${result.year} already has students. Use /settings/import to re-sync.`
    );
    return;
  }

  console.log(`
Import complete:
  Parents created:  ${result.parentsCreated}
  Students created: ${result.studentsCreated}
  Payments created: ${result.paymentsCreated}
  Rows skipped:     ${result.rowsSkipped}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
