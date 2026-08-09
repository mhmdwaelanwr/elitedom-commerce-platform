import { createHmac } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";

function origin(name, fallback) {
  return new URL(process.env[name]?.trim() || fallback).origin;
}

const siteOrigin = origin("E2E_SITE_URL", "http://127.0.0.1:3000");
const apiOrigin = origin("E2E_API_URL", "http://127.0.0.1:8000");
const password = process.env.E2E_PASSWORD || "E2eTest!2026";
const accounts = {
  customer: process.env.E2E_CUSTOMER_EMAIL || "e2e-customer@example.com",
  b2b: process.env.E2E_B2B_EMAIL || "e2e-b2b@example.com",
  admin: process.env.E2E_ADMIN_EMAIL || "e2e-admin@example.com",
};

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

async function setEnglish(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("elitedom-locale", "en");
  });
}

async function login(page, email, next) {
  await setEnglish(page);
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

async function expectHealthyDocument(page) {
  await expect(page.locator("body")).toBeVisible();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return () => expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(" | ")}`).toEqual([]);
}

test.describe.serial("P22 real full-stack browser integration", () => {
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
        (candidate) => Number(candidate.stock_qty) >= 2 && Number(candidate.list_price) > 0,
      );
      expect(product, "P22 requires at least one in-stock seeded product.").toBeTruthy();
      expect(Number.isInteger(Number(product.id))).toBeTruthy();
      expect(String(product.sku || "").length).toBeGreaterThan(0);
    } finally {
      await api.dispose();
    }
  });

  test("customer signs in, buys with COD, opens the persisted order, then cancels it", async ({ page }) => {
    const assertNoPageErrors = await expectHealthyDocument(page);
    const externalPaymentRequests = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname.toLowerCase();
      if (host.includes("paymob") || host.includes("accept.paymob")) externalPaymentRequests.push(request.url());
    });

    await login(page, accounts.customer, `/products/${product.id}`);
    await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();

    const addResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" && url.pathname === "/api/v1/orders/cart/items";
    });
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    const addResponse = await addResponsePromise;
    expect(addResponse.ok(), `Add-to-cart failed: HTTP ${addResponse.status()}`).toBeTruthy();

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    await expect(page.getByText(product.name, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Continue to checkout" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/checkout");

    await page.getByLabel("Full name").fill("P22 Browser Customer");
    await page.getByLabel("Email address").fill(accounts.customer);
    await page.getByLabel("Phone").fill("01000001001");
    await page.getByLabel("Governorate").fill("Cairo");
    await page.getByLabel("Street address").fill("P22 Integration Street, Cairo");
    await page.getByRole("button", { name: /Cash on delivery/ }).click();

    const checkoutResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" && url.pathname === "/api/v1/orders/checkout";
    });
    await page.getByRole("button", { name: /Place order/ }).click();
    const checkoutResponse = await checkoutResponsePromise;
    expect(checkoutResponse.ok(), `COD checkout failed: HTTP ${checkoutResponse.status()}`).toBeTruthy();
    const checkout = await checkoutResponse.json();
    expect(Number.isInteger(Number(checkout.order?.id))).toBeTruthy();
    expect(checkout.order?.name).toBeTruthy();
    expect(checkout.payment_gateway_url ?? null, "COD must not create a hosted payment redirect.").toBeNull();

    await expect(page.getByRole("heading", { level: 1, name: "Order confirmed" })).toBeVisible();
    const orderResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === `/api/v1/orders/${checkout.order.id}`;
    });
    await page.getByRole("button", { name: "Track order" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/account/orders/${checkout.order.id}`);
    expect((await orderResponsePromise).ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: `#${checkout.order.name}` })).toBeVisible();
    await expect(page.getByText(product.name, { exact: true }).first()).toBeVisible();

    const cancelResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" && url.pathname === `/api/v1/orders/${checkout.order.id}/cancel`;
    });
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Cancel order" }).click();
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.ok(), `Order cancellation failed: HTTP ${cancelResponse.status()}`).toBeTruthy();
    await expect(page.getByText("Order cancellation was recorded.")).toBeVisible();

    expect(externalPaymentRequests, "COD integration test must never contact Paymob.").toEqual([]);
    assertNoPageErrors();
  });

  test("verified B2B client creates and opens a real RFQ from the live catalogue", async ({ page }) => {
    const assertNoPageErrors = await expectHealthyDocument(page);
    await login(page, accounts.b2b, "/business/rfq");
    await expect(page.getByRole("heading", { level: 1, name: "Create a procurement RFQ" })).toBeVisible();

    await page.getByPlaceholder("Search live catalogue by SKU or product").fill(product.sku);
    const pickerButton = page.locator(".el-rfq-product-picker button").filter({ hasText: product.name }).first();
    await expect(pickerButton).toBeVisible();
    await pickerButton.click();

    const title = `P22 procurement ${Date.now()}`;
    await page.getByLabel("RFQ title").fill(title);
    await page.getByLabel("Delivery location").fill("New Cairo, Egypt");
    await page.getByLabel("Budget target (EGP)").fill("250000");
    await page.getByLabel("Payment terms").fill("Bank transfer after approved quote");
    await page.getByLabel("Notes").fill("Real browser integration RFQ created by the isolated P22 CI database.");

    const rfqResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" && url.pathname === "/api/v1/b2b/rfq";
    });
    await page.getByRole("button", { name: "Submit RFQ" }).click();
    const rfqResponse = await rfqResponsePromise;
    expect(rfqResponse.ok(), `RFQ creation failed: HTTP ${rfqResponse.status()}`).toBeTruthy();
    const rfq = await rfqResponse.json();
    expect(rfq.rfq_code).toBeTruthy();
    expect(rfq.status).toBe("submitted");

    await expect.poll(() => new URL(page.url()).pathname).toBe(`/business/rfq/${rfq.rfq_code}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Submitted", { exact: true }).last()).toBeVisible();
    assertNoPageErrors();
  });

  test("system admin completes real MFA, passes RBAC, and queries inventory/report APIs", async ({ page }) => {
    const assertNoPageErrors = await expectHealthyDocument(page);
    await login(page, accounts.admin, "/admin/inventory");

    await expect(page.getByRole("heading", { level: 1, name: "Multi-factor verification required" })).toBeVisible();
    await page.getByRole("button", { name: "Begin MFA setup" }).click();
    const secret = (await page.locator(".el-p20-secret code").textContent())?.trim();
    expect(secret).toBeTruthy();

    await page.getByLabel("Verification code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Save your recovery codes" })).toBeVisible();
    await expect(page.locator(".el-p20-recovery-codes code")).toHaveCount(8);
    await page.getByRole("button", { name: "Saved — continue" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Inventory tools" })).toBeVisible();
    await expect(page.getByText("MFA VERIFIED", { exact: true })).toBeVisible();

    const stockForm = page.locator(".el-p20-tool-grid form").first();
    await stockForm.locator('input[name="value"]').fill(product.sku);
    const stockResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === `/api/v1/inventory/${product.sku}`;
    });
    await stockForm.locator('button[type="submit"]').click();
    const stockResponse = await stockResponsePromise;
    expect(stockResponse.ok(), `Inventory lookup failed: HTTP ${stockResponse.status()}`).toBeTruthy();
    await expect(page.getByText(product.sku, { exact: true }).last()).toBeVisible();

    const dashboardPromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === "/api/v1/reports/dashboard";
    });
    await page.goto("/admin/reports", { waitUntil: "domcontentloaded" });
    const dashboardResponse = await dashboardPromise;
    expect(dashboardResponse.ok(), `Admin reporting failed: HTTP ${dashboardResponse.status()}`).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Reporting & exports" })).toBeVisible();
    await expect(page.getByText("MFA VERIFIED", { exact: true })).toBeVisible();
    assertNoPageErrors();
  });
});
