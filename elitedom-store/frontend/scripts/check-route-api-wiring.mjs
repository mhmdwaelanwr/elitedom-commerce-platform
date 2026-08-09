import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(relativePath) {
  const absolute = join(frontendRoot, relativePath);
  if (!existsSync(absolute)) {
    failures.push(`Route/API wiring: missing ${relativePath}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireIncludes(source, signatures, label) {
  for (const signature of signatures) {
    if (!source.includes(signature)) failures.push(`Route/API wiring: ${label} missing ${signature}`);
  }
}

const router = read("src/router.tsx");
const checkoutPage = read("src/pages/CheckoutPage.tsx");
const checkoutApi = read("src/lib/checkout-api.ts");
const accountOrdersPage = read("src/pages/AccountOrdersPage.tsx");
const fulfillmentApi = read("src/lib/fulfillment-api.ts");
const warrantyPage = read("src/pages/WarrantyPage.tsx");
const platformApi = read("src/lib/platform-api.ts");
const b2bPage = read("src/pages/B2BPage.tsx");
const b2bApi = read("src/lib/b2b-api.ts");
const adminPage = read("src/pages/admin/AdminCompletenessPage.tsx");
const operationsApi = read("src/lib/operations-api.ts");
const catalogAdminApi = read("src/lib/catalog-admin-api.ts");
const storePanels = read("src/components/store/StoreExperiencePanels.tsx");
const storeFooter = read("src/components/store/StoreFooter.tsx");

const backendMain = read("../backend/app/main.py");
const ordersRouter = read("../backend/app/modules/orders/router.py");
const shippingRouter = read("../backend/app/modules/shipping/router.py");
const warrantyRouter = read("../backend/app/modules/warranty/router.py");
const b2bRouter = read("../backend/app/modules/b2b/router.py");
const inventoryRouter = read("../backend/app/modules/inventory/router.py");
const suppliersRouter = read("../backend/app/modules/suppliers/router.py");
const reportingRouter = read("../backend/app/modules/reporting/router.py");
const catalogAdminRouter = read("../backend/app/modules/products/catalog_admin_router.py");

const routedPages = [
  ["/catalog", "CatalogPage"],
  ["/products/:productId", "ProductDetailPage"],
  ["/cart", "CartPage"],
  ["/checkout", "CheckoutRoute"],
  ["/account/orders", "AccountOrdersPage"],
  ["/account/orders/:orderId", "AccountOrderDetailPage"],
  ["/account/warranty", "WarrantyPage"],
  ["/business/rfq", "BusinessRfqPage"],
  ["/business/rfq/:rfqCode", "BusinessRfqPage"],
  ["/admin/inventory", "AdminCompletenessPage"],
  ["/admin/suppliers", "AdminCompletenessPage"],
  ["/admin/dropshipping", "AdminCompletenessPage"],
  ["/admin/reports", "AdminCompletenessPage"],
  ["/admin/catalog", "AdminCompletenessPage"],
];
for (const [route, component] of routedPages) {
  if (!router.includes(`path: \"${route}\"`) || !router.includes(`<${component}`)) {
    failures.push(`Route/API wiring: ${route} is not wired to ${component}`);
  }
}

// Checkout must preserve the server-created numeric order identity and route to its detail page.
requireIncludes(checkoutPage, [
  'from "@/lib/checkout-api"',
  "submitRoutedCheckout(",
  "orderId: result.orderId",
  "navigate(`/account/orders/${state.orderId}`)",
], "checkout page");
requireIncludes(checkoutApi, [
  '"/orders/checkout"',
  "result.order.id",
  "Authorization: `Bearer ${session.accessToken}`",
], "checkout API bridge");
requireIncludes(ordersRouter, [
  '@router.post("/checkout"',
  '@router.get("/{order_id}")',
  '@router.post("/{order_id}/cancel")',
], "orders backend router");

// Account order detail is an end-to-end order + shipment + cancellation + loyalty surface.
requireIncludes(accountOrdersPage, [
  "fetchAccountOrders(",
  "fetchAccountOrder(",
  "fetchOrderTracking(",
  "cancelAccountOrder(",
  "redeemPointsForOrder(",
], "account order page");
requireIncludes(fulfillmentApi, [
  "`/orders/${orderId}`",
  "`/shipping/${orderId}/tracking`",
  "`/orders/${orderId}/cancel?reason=",
], "fulfillment API bridge");
requireIncludes(shippingRouter, ['@router.get("/{order_id}/tracking"'], "shipping backend router");

// Warranty/RMA UI must load owned orders and use the real warranty service.
requireIncludes(warrantyPage, [
  "fetchCustomerOrders(",
  "fetchWarrantyClaims(",
  "checkWarranty(",
  "submitWarrantyClaim(",
], "warranty page");
requireIncludes(platformApi, [
  '"/warranty/claims?page=1&limit=100"',
  "`/warranty/check/${encodeURIComponent(serialNumber)}`",
  '"/warranty/claims"',
], "warranty API bridge");
requireIncludes(warrantyRouter, [
  '@router.post("/claims"',
  '@router.get("/claims"',
  '@router.get("/check/{serial_number}"',
], "warranty backend router");

// B2B workspace owns RFQ list/detail/create/convert rather than static display-only states.
requireIncludes(b2bPage, ["fetchRfqs(", "fetchRfq(", "submitRfq(", "convertRfq("], "B2B page");
requireIncludes(b2bApi, [
  '`/rfq${queryString(',
  '`/rfq/${encodeURIComponent(rfqCode)}`',
  'b2bRequest<B2BRfq>("/rfq"',
  '`/rfq/${encodeURIComponent(rfqCode)}/convert`',
], "B2B API bridge");
requireIncludes(b2bRouter, [
  '@router.post("/rfq"',
  '@router.get("/rfq"',
  '@router.get("/rfq/{rfq_code}"',
  '@router.post("/rfq/{rfq_code}/convert"',
], "B2B backend router");

// Dedicated admin routes must invoke their matching operational APIs.
const adminBindings = [
  ["inventory", ["fetchStockLevel(", "scanInventoryBarcode(", "lookupInventorySerial(", "adjustInventoryStock("]],
  ["suppliers", ["listSuppliers(", "createSupplier(", "updateSupplier(", "createPurchaseOrder(", "updatePurchaseOrder("]],
  ["dropshipping", ["listProductSupplierLinks(", "upsertProductSupplierLink(", "updateDropshipShipment("]],
  ["catalog", ["listCatalogProducts(", "getCatalogProduct(", "updateCatalogProduct(", "fetchCatalogContent(", "updateCatalogContent(", "uploadCatalogMedia("]],
  ["reports", ["fetchReportingDashboard(", "fetchInventoryReport(", "fetchRmaReport(", "fetchSupplierReport(", "downloadSalesExport("]],
];
for (const [kind, signatures] of adminBindings) {
  if (!router.includes(`kind=\"${kind}\"`)) failures.push(`Route/API wiring: admin ${kind} route is missing its workspace kind`);
  requireIncludes(adminPage, signatures, `admin ${kind} page`);
}
requireIncludes(operationsApi, [
  '"/inventory/adjust"',
  '"/suppliers"',
  '"/suppliers/purchase-orders"',
  '"/admin/catalog/products/${productId}/content"',
  '"/shipping/${orderId}/dropship"',
  '"/reports/sales/export',
], "operations API bridge");
requireIncludes(catalogAdminApi, [
  'request<CatalogProduct>("/products"',
  '`/products/${productId}`',
], "catalog admin API bridge");
requireIncludes(inventoryRouter, ['@router.post("/adjust"'], "inventory backend router");
requireIncludes(suppliersRouter, ['@router.post(""', '@router.post("/purchase-orders"'], "suppliers backend router");
requireIncludes(reportingRouter, ['@router.get("/dashboard"', '@router.get("/sales/export"'], "reporting backend router");
requireIncludes(catalogAdminRouter, ['@router.get("/products/{product_id}/content"', '@router.put("/products/{product_id}/content"'], "catalog admin backend router");

// FastAPI entrypoint must actually mount every router used by these pages under /api/v1.
for (const mountedRouter of [
  "orders_router",
  "shipping_router",
  "warranty_router",
  "b2b_router",
  "inventory_router",
  "suppliers_router",
  "reporting_router",
  "catalog_admin_router",
]) {
  if (!backendMain.includes(`include_router(${mountedRouter}`) && !backendMain.includes(`include_router(\n        ${mountedRouter}`)) {
    failures.push(`Route/API wiring: FastAPI app does not mount ${mountedRouter}`);
  }
}
if (!backendMain.includes('api_prefix = "/api/v1"')) failures.push("Route/API wiring: expected /api/v1 application prefix is missing");

// User navigation must point at the dedicated routed surfaces, not generic account placeholders.
requireIncludes(storePanels, ['"/account/orders"', '"/account/warranty"'], "store navigation");
requireIncludes(storeFooter, ['href: "/account/orders"', 'href: "/account/warranty"'], "store footer");
for (const stale of [
  '["Warranty & support", "/account"]',
  '["Delivery & tracking", "/account"]',
  '["Track order", "/account"]',
  '["تتبع الطلب", "/account"]',
]) {
  if (storePanels.includes(stale)) failures.push(`Route/API wiring: stale generic account navigation remains: ${stale}`);
}

if (failures.length) {
  console.error("Route/API wiring contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Route/API wiring validated: routed storefront, checkout, fulfilment, warranty, B2B and admin surfaces are bound to real FastAPI endpoints.");
