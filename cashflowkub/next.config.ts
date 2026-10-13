import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
