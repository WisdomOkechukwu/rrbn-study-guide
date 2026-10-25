import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    localPatterns: [
      { pathname: '/images/**', search: '' },
      { pathname: '/images/**', search: '?featured=1' },
      { pathname: '/brand/**', search: '' },
      { pathname: '/lecture-media/**', search: '' },
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
