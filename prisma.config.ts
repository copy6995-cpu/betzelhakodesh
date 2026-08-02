import "dotenv/config";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { defineConfig } from "prisma/config";

// Migrations (db push / migrate) run over the DIRECT connection (5432), not the
// transaction pooler — pgbouncer transaction mode can't run DDL/prepared
// statements reliably.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

// Prisma 7's TypeScript defs don't publicly declare `adapter` on the config
// yet, but the CLI supports it at runtime. Cast to `any` to keep tsc happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: { url },
  adapter: async () =>
    new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
} as any);
