import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function read(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    failures.push(`P19 contract: missing ${path}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

const platform = read("src/pages/admin/AdminPlatformPage.tsx");
const admin = read("src/pages/admin/AdminConsolePage.tsx");
const account = read("src/pages/AccountPage.tsx");
const warranty = read("src/pages/WarrantyPage.tsx");
const notFound = read("src/pages/NotFoundPage.tsx");
const router = read("src/router.tsx");
const api = read("src/lib/platform-api.ts");
const globals = read("src/styles/globals.css");
const hardening = read("src/styles/theme-hardening.css");
const footer = read("src/components/store/StoreFooter.tsx");
const main = read("src/main.tsx");

const figmaContracts = [
  ["244:3", admin, ["OrdersSection", "fetchAdminOrders", "updateAdminOrderState"]],
  ["244:296", platform, ["PAYMENT OPERATIONS", "PaymentsSurface", "fetchPaymentTrail", "requestPaymentRefund"]],
  ["244:589", platform, ["INVENTORY CONTROL", "InventorySurface", "fetchInventoryReport"]],
  ["244:882", platform, ["SUPPLIER & PROCUREMENT", "SuppliersSurface", "fetchSuppliers", "fetchPurchaseOrders"]],
  ["244:1175", platform, ["REPORTING & ANALYTICS", "ReportsSurface", "fetchReportingDashboard"]],
  ["244:1468", `${admin}\n${account}`, ["CustomersSection", "LoyaltySection", "fetchLoyaltyBalance"]],
  ["244:1761", admin, ["RmaSection", "fetchAdminRmas", "reviewAdminRma"]],
  ["244:2054", admin, ["ShipmentsSection", "fetchAdminShipments", "dispatchAdminOrder"]],
  ["244:2347", platform, ["INTEGRATIONS & AUDIT", "IntegrationsSurface", "fetchRuntimeReadiness", "fetchAdminAuditLogs"]],
  ["244:2640", account, ["LoyaltySection", "fetchLoyaltyBalance", "fetchLoyaltyHistory"]],
  ["244:2682", warranty, ["244:2682", "fetchWarrantyClaims", "checkWarranty", "submitWarrantyClaim"]],
  ["245:533", platform, ["CATALOG CONTROL", "CatalogSurface", "fetchCatalogAdminCategories", "fetchCatalogAdminAttributes", "245:533"]],
  ["246:592", notFound, ["246:592", "ROUTE CONTROL", "Back to storefront"]],
];

for (const [node, source, signatures] of figmaContracts) {
  for (const signature of signatures) {
    if (!source.includes(signature)) failures.push(`P19 Figma ${node}: missing ${JSON.stringify(signature)}`);
  }
}

const routeContracts = [
  ["/account/warranty", "WarrantyPage"],
  ["/admin/payments", 'AdminPlatformPage kind="payments"'],
  ["/admin/inventory", 'AdminPlatformPage kind="inventory"'],
  ["/admin/suppliers", 'AdminPlatformPage kind="suppliers"'],
  ["/admin/reports", 'AdminPlatformPage kind="reports"'],
  ["/admin/catalog", 'AdminPlatformPage kind="catalog"'],
  ["/admin/integrations", 'AdminPlatformPage kind="integrations"'],
];
for (const [route, component] of routeContracts) {
  if (!router.includes(`path: \"${route}\"`) || !router.includes(`<${component}`)) failures.push(`P19 route contract: ${route} -> ${component}`);
}

for (const signature of [
  "fetchSuppliers", "fetchPurchaseOrders", "fetchReportingDashboard", "fetchInventoryReport", "fetchSupplierReport", "fetchRmaReport",
  "fetchPaymentTrail", "requestPaymentRefund", "fetchWarrantyClaims", "checkWarranty", "submitWarrantyClaim",
  "fetchCatalogAdminCategories", "fetchCatalogAdminAttributes", "fetchRuntimeReadiness",
]) {
  if (!api.includes(`function ${signature}`)) failures.push(`P19 API bridge: missing ${signature}`);
}

for (const token of ["--el-control-bg", "--el-control-hover", "--el-input-bg", "--el-button-primary-bg", "--el-provider-google-bg", "--el-provider-apple-bg", "--el-accent-on", "--el-overlay"]) {
  const occurrences = globals.split(token).length - 1;
  if (occurrences < 2) failures.push(`P19 theme: ${token} must be defined in both dark and light themes`);
}
for (const selector of [".el-auth-provider.is-google", ".el-auth-provider.is-apple", ".el-auth-primary:hover", ".el-account-primary:hover", ".el-store-layer"]) {
  if (!hardening.includes(selector)) failures.push(`P19 theme hardening: missing ${selector}`);
}
if (!main.includes('import "@/styles/theme-hardening.css"') || !main.includes('import "@/styles/p19-fixes.css"')) failures.push("P19 theme: hardening and integration fixes must load globally");
if (footer.includes('href="#"')) failures.push("P19 navigation: StoreFooter must not contain dead anchors");
if (!footer.includes('/account/warranty') || !footer.includes('/business/rfq')) failures.push("P19 navigation: footer must connect warranty and RFQ routes");
if (!platform.includes("Promise.allSettled") || !platform.includes("limited")) failures.push("P19 RBAC: secondary data must degrade without breaking an authorised primary page");

if (failures.length) {
  console.error("P19 platform parity failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`P19 platform parity validated: ${figmaContracts.length} Figma finals, ${routeContracts.length} new routes, backend API bridge and theme hardening.`);
