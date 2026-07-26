import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL ?? "file:./betzel.db";

// Prisma 7's TypeScript defs don't publicly declare `adapter` on the config
// yet, but the CLI supports it at runtime. Cast to `any` to keep tsc happy
// while still driving prisma db push / migrate via the better-sqlite3 adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: { url },
  adapter: async () => new PrismaBetterSqlite3({ url }),
} as any);
