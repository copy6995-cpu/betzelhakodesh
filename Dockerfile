# Base image
FROM node:22-alpine

# better-sqlite3 compiles its native module when no musl prebuild matches —
# make sure the toolchain is present.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy all files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

# Entrypoint runs prisma db push + seeds, then starts Next.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the port
EXPOSE 3000

# The SQLite file lives on a mounted volume (e.g. /data) — set
# DATABASE_URL="file:/data/betzel.db" in the deployment env.
CMD ["/app/docker-entrypoint.sh"]
