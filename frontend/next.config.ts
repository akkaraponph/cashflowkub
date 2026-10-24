import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  // The Playwright suite runs its own server from a separate build dir so it never fights a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Every screen is per-request (cookies + live DB), so we use classic dynamic rendering
  // instead of Cache Components' static shell.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
