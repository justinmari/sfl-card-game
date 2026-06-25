import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Allow overriding the build dir so a manual `next dev` (port 3000, .next) and
  // Playwright's `next dev` (port 3001) can run at the same time without fighting
  // over the same .next cache/lock. Playwright sets NEXT_DIST_DIR=.next-e2e.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // GIF/WebP uploads are POSTed to a Server Action for sharp conversion; the
  // default Server Action body limit (1MB) is too small for source animations.
  // NOTE: Vercel hard-caps a function request body at 4.5MB (FUNCTION_PAYLOAD_
  // TOO_LARGE) regardless of this value, so raising it past ~4.5MB does nothing
  // in production. The client caps animated uploads below this (see suggest-form
  // MAX_ANIMATED_MB); 5mb leaves room for multipart overhead on a 4MB file.
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
