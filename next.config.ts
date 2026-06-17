import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Allow overriding the build dir so a manual `next dev` (port 3000, .next) and
  // Playwright's `next dev` (port 3001) can run at the same time without fighting
  // over the same .next cache/lock. Playwright sets NEXT_DIST_DIR=.next-e2e.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // GIF/WebP uploads are POSTed to a Server Action for sharp conversion; the
  // default Server Action body limit (1MB) is too small for source animations.
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
