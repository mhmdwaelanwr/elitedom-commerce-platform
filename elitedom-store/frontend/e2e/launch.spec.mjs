import { expect, request as playwrightRequest, test } from "@playwright/test";

function requiredOrigin(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for launch E2E.`);
  return new URL(value).origin;
}

const siteOrigin = requiredOrigin("ELITEDOM_SITE_URL");
const apiOrigin = requiredOrigin("ELITEDOM_API_URL");
const apiV1 = `${apiOrigin}/api/v1`;
let purchasableProduct;

async function setLocale(page, locale) {
  await page.addInitScript((selectedLocale) => {
    window.localStorage.setItem("elitedom-locale", selectedLocale);
  }, locale);
}

async function expectNoHorizontalOverflow(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `Horizontal overflow: scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function openRoute(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `No document response for ${path}`).not.toBeNull();
  expect(response?.ok(), `Document request failed for ${path}: ${response?.status()}`).toBeTruthy();
  await expect(page.locator("body")).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

test.describe.serial("Elitedom deployed launch gate", () => {
  test.beforeAll(async () => {
    const api = await playwrightRequest.newContext({
      baseURL: apiV1,
      extraHTTPHeaders: { Accept: "application/json" },
    });
    try {
      const response = await api.get("/catalog/products?locale=en&limit=100");
      expect(
        response.ok(),
        `Real catalogue discovery failed: HTTP ${response.status()} ${response.statusText()}`,
      ).toBeTruthy();
      const payload = await response.json();
      expect(Array.isArray(payload.products), "Catalogue response must contain products[].").toBeTruthy();
      purchasableProduct = payload.products.find(
        (product) => Number(product.stock_qty) > 0 || product.is_dropship_enabled === true,
      );
      expect(
        purchasableProduct,
        "Launch requires at least one backend-authoritative product that can be purchased.",
      ).toBeTruthy();
      expect(Number.isFinite(Number(purchasableProduct.id))).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test("390px Arabic RTL reaches real checkout without creating an order or payment", async ({ page }) => {
    const pageErrors = [];
    const financialMutations = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "GET") return;
      const url = new URL(request.url());
      if (
        url.pathname === "/api/v1/orders/checkout" ||
        url.pathname.startsWith("/api/v1/payments/")
      ) {
        financialMutations.push(`${request.method()} ${url.pathname}`);
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await setLocale(page, "ar");

    const productApiResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === `/api/v1/catalog/products/${purchasableProduct.id}`;
    });
    await openRoute(page, `/products/${purchasableProduct.id}`);
    const productApiResponse = await productApiResponsePromise;
    expect(productApiResponse.ok(), "PDP product API request failed.").toBeTruthy();
    expect(new URL(productApiResponse.url()).origin).toBe(apiOrigin);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".el-pdp-price")).toContainText("EGP");

    const addButton = page.getByRole("button", { name: "أضف للسلة" });
    await expect(addButton).toBeEnabled();
    const addResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" && url.pathname === "/api/v1/orders/cart/items";
    });
    await addButton.click();
    const addResponse = await addResponsePromise;
    expect(addResponse.ok(), `Add-to-cart failed with HTTP ${addResponse.status()}.`).toBeTruthy();
    expect(new URL(addResponse.url()).origin).toBe(apiOrigin);
    await expect(page.getByRole("button", { name: "تمت الإضافة للسلة" })).toBeVisible();

    await openRoute(page, "/cart");
    await expect(page.getByRole("heading", { level: 1, name: "سلة التسوق" })).toBeVisible();
    await expect(page.locator(`a[href="/products/${purchasableProduct.id}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "متابعة لإتمام الطلب" }).click();
    await expect(page).toHaveURL(`${siteOrigin}/checkout`);
    await expect(page.getByRole("heading", { level: 1, name: "إتمام الطلب" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ملخص الطلب" })).toBeVisible();
    await expect(page.getByText(purchasableProduct.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("بطاقة ائتمان أو خصم", { exact: true })).toBeVisible();
    await expect(page.getByText("محفظة موبايل", { exact: true })).toBeVisible();
    await expect(page.getByText("InstaPay", { exact: true })).toBeVisible();
    await expect(page.getByText("الدفع عند الاستلام", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /تأكيد الطلب/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(
      financialMutations,
      `Checkout render must not create orders or payments: ${financialMutations.join(" | ")}`,
    ).toEqual([]);

    await openRoute(page, "/cart");
    const removeResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "DELETE" && url.pathname.startsWith("/api/v1/orders/cart/items/");
    });
    await page.getByRole("button", { name: "إزالة" }).first().click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.ok(), `Guest-cart cleanup failed with HTTP ${removeResponse.status()}.`).toBeTruthy();
    expect(new URL(removeResponse.url()).origin).toBe(apiOrigin);
    await expect(page.getByText("السلة جاهزة للهاردوير.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  for (const scenario of [
    { name: "430px English LTR", width: 430, locale: "en", direction: "ltr" },
    { name: "1024px Arabic RTL", width: 1024, locale: "ar", direction: "rtl" },
  ]) {
    test(`${scenario.name} public commerce routes stay within the viewport`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setViewportSize({ width: scenario.width, height: 900 });
      await setLocale(page, scenario.locale);

      for (const path of ["/", "/catalog", `/products/${purchasableProduct.id}`]) {
        await openRoute(page, path);
        await expect(page.locator("html")).toHaveAttribute("lang", scenario.locale);
        await expect(page.locator("html")).toHaveAttribute("dir", scenario.direction);
      }
      expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(" | ")}`).toEqual([]);
    });
  }
});
