import { defineConfig, devices } from "@playwright/test";

function localOrigin(name, fallback) {
  const value = process.env[name]?.trim() || fallback;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${name} must be HTTP(S).`);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`${name} must target the isolated local P22 stack.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a credential-free origin.`);
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error(`${name} must not include an application path.`);
  }
  return url.origin;
}

const siteOrigin = localOrigin("E2E_SITE_URL", "http://127.0.0.1:3000");
localOrigin("E2E_API_URL", "http://127.0.0.1:8000");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "integration.spec.mjs",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-integration-report", open: "never" }],
    ["json", { outputFile: "playwright-integration-report/results.json" }],
  ],
  use: {
    baseURL: siteOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium-real-stack",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results-integration",
});
