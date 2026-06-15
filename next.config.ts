import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Allow overriding the build dir so a manual `next dev` (port 3000, .next) and
  // Playwright's `next dev` (port 3001) can run at the same time without fighting
  // over the same .next cache/lock. Playwright sets NEXT_DIST_DIR=.next-e2e.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
