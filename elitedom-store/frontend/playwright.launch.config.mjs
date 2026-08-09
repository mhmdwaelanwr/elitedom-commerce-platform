import { defineConfig, devices } from "@playwright/test";

function requiredOrigin(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for launch E2E.`);

  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a credential-free HTTPS origin.`);
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error(`${name} must not include an application path.`);
  }
  return url.origin;
}

const siteOrigin = requiredOrigin("ELITEDOM_SITE_URL");
requiredOrigin("ELITEDOM_API_URL");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "launch.spec.mjs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL: siteOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 20_000,
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium-launch",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results",
});
