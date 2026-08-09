import { createHmac } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";

function origin(name, fallback) {
  return new URL(process.env[name]?.trim() || fallback).origin;
}

const apiOrigin = origin("E2E_API_URL", "http://127.0.0.1:8000");
const password = process.env.E2E_PASSWORD || "E2eTest!2026";
const accounts = {
  customer: process.env.E2E_CUSTOMER_EMAIL || "e2e-customer@example.com",
  b2b: process.env.E2E_B2B_EMAIL || "e2e-b2b@example.com",
  admin: process.env.E2E_ADMIN_EMAIL || "e2e-admin@example.com",
};

const publicScenarios = [
  { name: "mobile-360-ar-dark", width: 360, height: 800, locale: "ar", theme: "dark" },
  { name: "mobile-390-ar-light", width: 390, height: 844, locale: "ar", theme: "light" },
  { name: "mobile-430-en-dark", width: 430, height: 932, locale: "en", theme: "dark" },
  { name: "tablet-1024-en-light", width: 1024, height: 768, locale: "en", theme: "light" },
];

let product;

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/u, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error(`Invalid base32 character: ${character}`);
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, at = Date.now()) {
  const counter = BigInt(Math.floor(at / 1000 / 30));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function primePresentation(page, locale, theme) {
  await page.addInitScript(({ locale: selectedLocale, theme: selectedTheme }) => {
    window.localStorage.setItem("elitedom-locale", selectedLocale);
    window.localStorage.setItem("elitedom-theme", selectedTheme);
  }, { locale, theme });
}

function observeBrowser(page) {
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  return () => {
    expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(serverErrors, `Unexpected server errors: ${serverErrors.join(" | ")}`).toEqual([]);
  };
}

async function assertPresentation(page, { locale, theme }) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("body")).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth),
    { message: "The page must not overflow horizontally at the acceptance viewport." },
  ).toBeLessThanOrEqual(2);
}

async function capture(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function visit(page, testInfo, scenario, path, label) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await assertPresentation(page, scenario);
  await capture(page, testInfo, `${scenario.name}-${label}`);
}

async function login(page, email, next, theme = "dark") {
  await primePresentation(page, "en", theme);
  const loginResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/v1/auth/login";
  });
  await page.goto(`/auth?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email or phone").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), `Login failed for ${email}: HTTP ${loginResponse.status()}`).toBeTruthy();
  await expect.poll(() => new URL(page.url()).pathname).toBe(next);
}

async function completeAdminMfa(page) {
  await expect(page.getByRole("heading", { level: 1, name: "Multi-factor verification required" })).toBeVisible();
  await page.getByRole("button", { name: "Begin MFA setup" }).click();
  const secret = (await page.locator(".el-p20-secret code").textContent())?.trim();
  expect(secret, "The isolated UAT admin fixture must expose a fresh enrollment secret.").toBeTruthy();
  await page.getByLabel("Verification code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Save your recovery codes" })).toBeVisible();
  await expect(page.locator(".el-p20-recovery-codes code")).toHaveCount(8);
  await page.getByRole("button", { name: "Saved — continue" }).click();
}

test.describe.serial("P23 production-like UAT and release-candidate gate", () => {
  test.beforeAll(async () => {
    const api = await playwrightRequest.newContext({
      baseURL: apiOrigin,
      extraHTTPHeaders: { Accept: "application/json" },
    });
    try {
      const ready = await api.get("/health/ready");
      expect(ready.ok(), `FastAPI readiness failed: HTTP ${ready.status()}`).toBeTruthy();
      const response = await api.get("/api/v1/catalog/products?locale=en&page=1&limit=100");
      expect(response.ok(), `Catalogue discovery failed: HTTP ${response.status()}`).toBeTruthy();
      const payload = await response.json();
      product = payload.products.find(
        (candidate) => Number(candidate.stock_qty) >= 1 && Number(candidate.list_price) > 0,
      );
      expect(product, "P23 requires at least one in-stock seeded product.").toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  for (const scenario of publicScenarios) {
    test(`${scenario.name} preserves public storefront parity without overflow`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await primePresentation(page, scenario.locale, scenario.theme);
      const assertNoRuntimeErrors = observeBrowser(page);

      await visit(page, testInfo, scenario, "/", "home");
      await visit(page, testInfo, scenario, "/catalog", "catalog");
      await visit(page, testInfo, scenario, `/products/${product.id}`, "pdp");
      await visit(page, testInfo, scenario, "/business", "business");

      assertNoRuntimeErrors();
    });
  }

  test("theme and locale controls persist through a real reload", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await primePresentation(page, "en", "light");
    const assertNoRuntimeErrors = observeBrowser(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await assertPresentation(page, { locale: "en", theme: "light" });

    await page.locator("button.el-theme-toggle:visible").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("elitedom-theme"))).toBe("dark");

    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("elitedom-locale"))).toBe("ar");

    await page.reload({ waitUntil: "domcontentloaded" });
    await assertPresentation(page, { locale: "ar", theme: "dark" });
    await capture(page, testInfo, "control-persistence-ar-dark");
    assertNoRuntimeErrors();
  });

  test("customer account surface is usable at 390px", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const assertNoRuntimeErrors = observeBrowser(page);
    await login(page, accounts.customer, "/account", "light");
    await assertPresentation(page, { locale: "en", theme: "light" });
    await expect(page.locator("main")).toBeVisible();
    await capture(page, testInfo, "role-customer-390-light");
    assertNoRuntimeErrors();
  });

  test("verified B2B surface is usable at 430px", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const assertNoRuntimeErrors = observeBrowser(page);
    await login(page, accounts.b2b, "/business/rfq", "dark");
    await assertPresentation(page, { locale: "en", theme: "dark" });
    await expect(page.getByRole("heading", { level: 1, name: "Create a procurement RFQ" })).toBeVisible();
    await capture(page, testInfo, "role-b2b-430-dark");
    assertNoRuntimeErrors();
  });

  test("system admin passes MFA and renders the protected tablet surface", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const assertNoRuntimeErrors = observeBrowser(page);
    await login(page, accounts.admin, "/admin/inventory", "dark");
    await completeAdminMfa(page);
    await expect(page.getByRole("heading", { level: 1, name: "Inventory tools" })).toBeVisible();
    await expect(page.getByText("MFA VERIFIED", { exact: true })).toBeVisible();
    await assertPresentation(page, { locale: "en", theme: "dark" });
    await capture(page, testInfo, "role-admin-1024-dark");
    assertNoRuntimeErrors();
  });
});
