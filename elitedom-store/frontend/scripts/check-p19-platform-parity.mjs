import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const read = (path) => {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    failures.push(`P19 contract: missing ${path}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
};

const platform = read("src/pages/admin/AdminPlatformPage.tsx");
const completeness = read("src/pages/admin/AdminCompletenessPage.tsx");
const admin = read("src/pages/admin/AdminConsolePage.tsx");
const account = read("src/pages/AccountPage.tsx");
const accountOrders = read("src/pages/AccountOrdersPage.tsx");
const warranty = read("src/pages/WarrantyPage.tsx");
const notFound = read("src/pages/NotFoundPage.tsx");
const router = read("src/router.tsx");
const platformApi = read("src/lib/platform-api.ts");
const operationsApi = read("src/lib/operations-api.ts");
const globals = read("src/styles/globals.css");
const hardening = read("src/styles/theme-hardening.css");
const footer = read("src/components/store/StoreFooter.tsx");
const main = read("src/main.tsx");

const preserved = [
  ["244:3", admin, ["OrdersSection", "fetchAdminOrders", "updateAdminOrderState"]],
  ["244:296", platform, ["PAYMENT OPERATIONS", "PaymentsSurface", "fetchPaymentTrail", "requestPaymentRefund"]],
  ["244:1761", admin, ["RmaSection", "fetchAdminRmas", "reviewAdminRma"]],
  ["244:2054", admin, ["ShipmentsSection", "fetchAdminShipments", "dispatchAdminOrder"]],
  ["244:2347", platform, ["INTEGRATIONS & AUDIT", "IntegrationsSurface", "fetchRuntimeReadiness", "fetchAdminAuditLogs"]],
  ["244:2640", account, ["LoyaltySection", "fetchLoyaltyBalance", "fetchLoyaltyHistory"]],
  ["244:2682", warranty, ["244:2682", "fetchWarrantyClaims", "checkWarranty", "submitWarrantyClaim"]],
  ["246:592", notFound, ["246:592", "ROUTE CONTROL", "Back to storefront"]],
];
for (const [node, source, signatures] of preserved) for (const signature of signatures) if (!source.includes(signature)) failures.push(`P19 Figma ${node}: missing ${JSON.stringify(signature)}`);

// P20 intentionally supersedes the P19 read-only inventory/supplier/report/catalog frames.
const superseded = [
  ["244:589", "247:70", ["scanInventoryBarcode", "lookupInventorySerial", "adjustInventoryStock"]],
  ["244:882", "247:265", ["createSupplier", "updateSupplier", "createPurchaseOrder", "updatePurchaseOrder"]],
  ["244:1175", "247:329", ["downloadSalesExport", "fetchReportingDashboard"]],
  ["245:533", "247:200", ["updateCatalogContent", "uploadCatalogMedia", "createCatalogAdminCategory", "createCatalogAttributeDefinition"]],
];
const platformOwnedBridges = new Set(["fetchReportingDashboard"]);
for (const [oldNode, newNode, signatures] of superseded) {
  if (!completeness.includes(newNode)) failures.push(`P19 ${oldNode} must be superseded by bound P20 Figma ${newNode}`);
  for (const signature of signatures) {
    if (!completeness.includes(signature)) failures.push(`P19 ${oldNode} supersession is missing reachable ${signature}`);
    const apiSource = platformOwnedBridges.has(signature) ? platformApi : operationsApi;
    if (!apiSource.includes(`function ${signature}`) && !apiSource.includes(`async function ${signature}`)) failures.push(`P19 ${oldNode} supersession is missing API bridge ${signature}`);
  }
}

if (!admin.includes("CustomersSection")) failures.push("P19 customer operations must remain available in the admin console");
if (!account.includes("LoyaltySection") || !accountOrders.includes("redeemPointsForOrder")) failures.push("P19/P20 loyalty must include balance/history plus order-bound redemption");

const routeContracts = [
  ["/account/warranty", "WarrantyPage"],
  ["/account/orders/:orderId", "AccountOrderDetailPage"],
  ["/admin/payments", 'AdminPlatformPage kind="payments"'],
  ["/admin/inventory", 'AdminCompletenessPage kind="inventory"'],
  ["/admin/suppliers", 'AdminCompletenessPage kind="suppliers"'],
  ["/admin/dropshipping", 'AdminCompletenessPage kind="dropshipping"'],
  ["/admin/reports", 'AdminCompletenessPage kind="reports"'],
  ["/admin/catalog", 'AdminCompletenessPage kind="catalog"'],
  ["/admin/integrations", 'AdminPlatformPage kind="integrations"'],
];
for (const [route, component] of routeContracts) if (!router.includes(`path: \"${route}\"`) || !router.includes(`<${component}`)) failures.push(`P19/P20 route contract: ${route} -> ${component}`);

for (const signature of ["fetchPaymentTrail", "requestPaymentRefund", "fetchWarrantyClaims", "checkWarranty", "submitWarrantyClaim", "fetchRuntimeReadiness"]) {
  if (!platformApi.includes(`function ${signature}`) && !platformApi.includes(`async function ${signature}`)) failures.push(`P19 API bridge: missing ${signature}`);
}

for (const token of ["--el-control-bg", "--el-control-hover", "--el-input-bg", "--el-button-primary-bg", "--el-provider-google-bg", "--el-provider-apple-bg", "--el-accent-on", "--el-overlay"]) {
  const occurrences = globals.split(token).length - 1;
  if (occurrences < 2) failures.push(`P19 theme: ${token} must be defined in both dark and light themes`);
}
for (const selector of [".el-auth-provider.is-google", ".el-auth-provider.is-apple", ".el-auth-primary:hover", ".el-account-primary:hover", ".el-store-layer"]) if (!hardening.includes(selector)) failures.push(`P19 theme hardening: missing ${selector}`);
if (!main.includes('"@/styles/theme-hardening.css"') || !main.includes('"@/styles/p19-fixes.css"') || !main.includes('"@/styles/p20-completeness.css"')) failures.push("P19/P20 theme layers must load globally");
if (footer.includes('href="#"')) failures.push("P19 navigation: StoreFooter must not contain dead anchors");
if (!footer.includes('/account/warranty') || !footer.includes('/business/rfq')) failures.push("P19 navigation: footer must connect warranty and RFQ routes");
if (!platform.includes("Promise.allSettled") || !platform.includes("limited")) failures.push("P19 RBAC: secondary platform data must degrade without breaking an authorised primary page");

if (failures.length) {
  console.error("P19/P20 platform parity failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`P19 platform parity preserved with P20 operational supersession: ${preserved.length} preserved finals + ${superseded.length} repaired capability groups.`);
