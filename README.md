# בצל הקודש — Bachurim & Parents Portal

מערכת web לניהול תלמידי ישיבות בעלזא (תשפ"ו ואילך), הורים, ותשלומים.

## Stack
- Next.js 16 (App Router, RSC) · TypeScript
- Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- NextAuth v5 (credentials, admin-only)
- Tailwind v4
- Deploy: Dokploy (auto-deploy on push to `main`)

## Development

```bash
# 1. Install dependencies
npm install

# 2. Start a local Postgres
docker compose up -d postgres

# 3. Create .env from the example and fill in values
cp .env.example .env

# 4. Push the schema, seed catalog + admin, then (optional) import the Excel
npx prisma db push
npm run seed:admin
npm run seed:catalog
# To import the 2,442 bachurim from the Excel, place the file at the path
# configured in IMPORT_XLSX (default: ./prisma/seed-data.xlsx) and run:
npm run seed:bachurim

# 5. Run the dev server
npm run dev
# → http://localhost:3000
```

## Routes
- `/auth/signin` — login (admin only)
- `/` — dashboard, KPIs by yeshiva
- `/bachurim` — list with pill filters (yeshivot), search, pagination
- `/bachurim/[id]` — detail + payments + parent link
- `/bachurim/[id]/edit` — edit student (and linked parent)
- `/bachurim/new` — add new student
- `/bachurim/[id]/payments/new` — log a payment
- `/parents` — list with aggregated family debt
- `/parents/[id]` — parent detail, all children across years, debt per year
- `/payments` — transaction log
- `/settings` — active year + catalog summary
- `/settings/yeshivot` — yeshiva CRUD

## Deploy to Dokploy
1. Push to GitHub (`main` branch).
2. In Dokploy, point the app at this repo; Dokploy will pick up `Dockerfile`.
3. Set environment variables in Dokploy:
   - `DATABASE_URL` — Postgres URL from the Dokploy-managed database
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `ACTIVE_YEAR` (e.g. `תשפ"ו`)
4. First boot: `docker-entrypoint.sh` runs `prisma db push`, seeds the admin + catalog, and imports bachurim if the file is present under `/app/prisma/seed-data.xlsx`.

## Deferred (phase 2)
- Nedarim Plus API integration
- Yemot HaMashiach (IVR) integration
