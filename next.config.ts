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
    "/api/rooms/export": ["./data/**"],
  },
  // Keep puppeteer + the Lambda Chromium build as external so their binary
  // assets are traced into the serverless function instead of bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
