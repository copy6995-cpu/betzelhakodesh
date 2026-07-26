#!/bin/sh
set -e

echo "[boot] Pushing database schema (SQLite at $DATABASE_URL)..."
# --accept-data-loss mirrors the RV-raiser pattern: Prisma warns on every new
# UNIQUE column even when it is brand-new and nullable, so we accept and rely
# on schema.prisma reviews for destructive-change safety.
npx prisma db push --accept-data-loss
echo "[boot] Schema synced."

echo "[boot] Seeding admin user (idempotent)..."
npx tsx prisma/seed-admin.ts

echo "[boot] Seeding catalog — yeshivot, shiurim, end dates (idempotent)..."
npx tsx prisma/seed-catalog.ts

# seed-bachurim is a no-op unless Students is empty AND IMPORT_XLSX points at a
# readable file. Normal re-syncs happen via /settings/import in the UI.
echo "[boot] Checking bachurim seed..."
npx tsx prisma/seed-bachurim.ts

echo "[boot] Starting Next.js..."
exec npm run start
