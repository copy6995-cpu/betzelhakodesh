import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "אדמין";

  if (!email || !password) {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  // Re-assert role=admin on every boot so whoever owns the ENV can never be
  // locked out of the system, matching the RV-raiser pattern.
  await prisma.user.upsert({
    where: { email },
    update: { role: "admin" },
    create: { email, name, passwordHash: hash, role: "admin" },
  });
  console.log(`Admin ensured: ${email}`);
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
