import type { NextConfig } from "next";

// The Dockerfile uses `npm run start` (next start) rather than the standalone
// bundle, so we don't emit the standalone output. Switch back to
// `output: "standalone"` if you adopt a multi-stage Dockerfile that copies
// only `.next/standalone/`.
const nextConfig: NextConfig = {
  // Bundle the data files the room exports read from disk into the serverless
  // functions (Vercel traces only what it statically sees imported, not
  // fs.readFileSync targets).
  outputFileTracingIncludes: {
    // ./data — files the export reads from disk. The chromium binary
    // (bin/*.br) is referenced by a computed path nft can't follow, so trace
    // it explicitly or the serverless PDF launch fails with "not found".
    "/api/rooms/export": [
      "./data/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  // Keep puppeteer + the Lambda Chromium build as external so their binary
  // assets are traced into the serverless function instead of bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  experimental: {
    // Reuse already-fetched page data when navigating, instead of hitting the
    // server again every click. Our pages are force-dynamic, so by default the
    // client router cache treats them as always-stale (staleTimes.dynamic = 0)
    // and refetches on every navigation — that's the lag between בחורים → הורים
    // → מיטות. Caching dynamic pages for 30s makes moving between sections
    // instant; a mutation still clears it (server actions call revalidatePath /
    // router.refresh), so data never shows more than ~30s stale.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
