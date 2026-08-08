import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, frontendRoot, "");
  const apiUrl = environment.VITE_API_URL || "http://localhost:8000/api/v1";
  const siteUrl = environment.VITE_SITE_URL || "http://localhost:3000";
  const mediaUrl = environment.VITE_MEDIA_URL || "";
  const demoFallback = environment.VITE_DEMO_CATALOG_FALLBACK || "false";
  const googleClientId = environment.VITE_GOOGLE_CLIENT_ID || "";
  const appleClientId = environment.VITE_APPLE_CLIENT_ID || "";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(frontendRoot, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
    // Transitional aliases keep the API layer buildable while NEXT_PUBLIC_* references
    // are migrated to src/lib/env.ts in the next migration step.
    define: {
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(apiUrl),
      "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(siteUrl),
      "process.env.NEXT_PUBLIC_MEDIA_URL": JSON.stringify(mediaUrl),
      "process.env.NEXT_PUBLIC_DEMO_CATALOG_FALLBACK": JSON.stringify(demoFallback),
      "process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID": JSON.stringify(googleClientId),
      "process.env.NEXT_PUBLIC_APPLE_CLIENT_ID": JSON.stringify(appleClientId),
    },
  };
});
