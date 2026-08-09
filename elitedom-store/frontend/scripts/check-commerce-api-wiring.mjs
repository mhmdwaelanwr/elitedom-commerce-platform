import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(relativePath) {
  const absolute = join(frontendRoot, relativePath);
  if (!existsSync(absolute)) {
    failures.push(`Commerce wiring: missing ${relativePath}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireIncludes(source, signatures, label) {
  for (const signature of signatures) {
    if (!source.includes(signature)) failures.push(`Commerce wiring: ${label} missing ${signature}`);
  }
}

const catalogPage = read("src/pages/CatalogPage.tsx");
const productPage = read("src/pages/ProductDetailPage.tsx");
const cartPage = read("src/pages/CartPage.tsx");
const cartData = read("src/lib/cart-data.ts");
const catalogApi = read("src/lib/catalog-api.ts");
const commerceApi = read("src/lib/api.ts");
const backendMain = read("../backend/app/main.py");
const catalogRouter = read("../backend/app/modules/products/catalog_router.py");
const ordersRouter = read("../backend/app/modules/orders/router.py");

requireIncludes(catalogPage, [
  'from "@/lib/catalog-api"',
  "fetchRichCatalog({",
], "catalog page");
requireIncludes(productPage, [
  "fetchRichProduct(productId, locale)",
  "fetchRichCatalog({",
  "addRemoteCartItem(",
  "getGuestCartSessionId()",
], "product detail page");
requireIncludes(cartPage, [
  "loadGuestCart(locale, currentSession)",
  "updateRemoteCartItem(",
  "removeRemoteCartItem(",
  'to="/checkout"',
], "cart page");
requireIncludes(cartData, [
  "fetchRemoteCart(sessionId, session)",
  "mapRemoteCart(cart)",
  "fetchRichCatalog({ locale, limit: 100 })",
], "cart loader");

requireIncludes(catalogApi, [
  "`/catalog/products?${parameters}`",
  "`/catalog/products/${encodeURIComponent(identifier)}?locale=${locale}`",
  "`/catalog/categories?locale=${locale}`",
], "public catalog API bridge");
requireIncludes(commerceApi, [
  'cartPath("/orders/cart"',
  'cartPath("/orders/cart/items"',
  'cartPath(`/orders/cart/items/${itemId}`',
], "cart API bridge");

requireIncludes(catalogRouter, [
  '@router.get("/products"',
  '@router.get("/products/{identifier}"',
  '@router.get("/categories"',
], "public catalog backend router");
requireIncludes(ordersRouter, [
  '@router.get("/cart")',
  '@router.post("/cart/items")',
  '@router.put("/cart/items/{item_id}")',
  '@router.delete("/cart/items/{item_id}")',
  '@router.post("/checkout"',
], "cart/checkout backend router");

for (const mountedRouter of ["catalog_router", "orders_router"]) {
  if (!backendMain.includes(`include_router(${mountedRouter}`)) {
    failures.push(`Commerce wiring: FastAPI app does not mount ${mountedRouter}`);
  }
}
if (!backendMain.includes('api_prefix = "/api/v1"')) failures.push("Commerce wiring: expected /api/v1 application prefix is missing");

if (failures.length) {
  console.error("Commerce API wiring contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Commerce API wiring validated: catalog, PDP, cart and checkout routes use the real mounted FastAPI services.");
