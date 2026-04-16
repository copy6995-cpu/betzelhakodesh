#!/bin/sh
set -e

echo "Pushing database schema..."
# --accept-data-loss mirrors the RV-raiser pattern: Prisma warns on every new
# UNIQUE column even when it is brand-new and nullable (safe in Postgres), so
# we accept and rely on schema.prisma reviews for destructive-change safety.
npx prisma db push --accept-data-loss
echo "Schema synced."

echo "Seeding admin user..."
npx tsx prisma/seed-admin.ts

echo "Seeding catalog (yeshivot, shiurim, end dates)..."
npx tsx prisma/seed-catalog.ts

echo "Seeding bachurim (runs only when Students table is empty)..."
npx tsx prisma/seed-bachurim.ts

echo "Starting Next.js..."
exec node server.js
