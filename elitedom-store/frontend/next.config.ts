import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal Node server and its traced runtime dependencies for the
  // multi-stage production Docker image.
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  turbopack: {
    // This frontend is nested under an architecture workspace that has other lockfiles.
    // Keep filesystem watching and build resolution scoped to this actual Next.js app.
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
