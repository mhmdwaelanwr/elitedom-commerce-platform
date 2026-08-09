import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const read = (path) => {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    failures.push(`UI completeness: missing ${path}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
};

const router = read("src/router.tsx");
const main = read("src/main.tsx");
const adminDirectory = read("src/lib/admin-directory.ts");
const adminHub = read("src/pages/admin/AdminDirectoryPage.tsx");
const adminCompleteness = read("src/pages/admin/AdminCompletenessPage.tsx");
const adminSecure = read("src/pages/admin/AdminSecureRoute.tsx");
const accountOrders = read("src/pages/AccountOrdersPage.tsx");
const fulfillment = read("src/lib/fulfillment-api.ts");
const loyalty = read("src/lib/loyalty-operations-api.ts");
const operations = read("src/lib/operations-api.ts");
const styles = read("src/styles/p20-completeness.css");

const requiredRoutes = [
  ["/account", "AccountEntryPage"],
  ["/account/orders", "AccountOrdersPage"],
  ["/account/orders/:orderId", "AccountOrderDetailPage"],
  ["/account/warranty", "WarrantyPage"],
  ["/admin", "AdminEntryPage"],
  ["/admin/payments", "AdminPlatformPage"],
  ["/admin/inventory", "AdminCompletenessPage"],
  ["/admin/suppliers", "AdminCompletenessPage"],
  ["/admin/dropshipping", "AdminCompletenessPage"],
  ["/admin/reports", "AdminCompletenessPage"],
  ["/admin/catalog", "AdminCompletenessPage"],
  ["/admin/integrations", "AdminPlatformPage"],
  ["/admin/launch", "LaunchControlPage"],
];
for (const [path, component] of requiredRoutes) {
  if (!router.includes(`path: \"${path}\"`) || !router.includes(`<${component}`)) {
    failures.push(`UI completeness: ${path} must resolve to ${component}`);
  }
}

for (const [route, permission] of [
  ["/admin/payments", "payments.view"],
  ["/admin/inventory", "inventory.view"],
  ["/admin/suppliers", "suppliers.view"],
  ["/admin/dropshipping", "suppliers.view"],
  ["/admin/reports", "reports.view"],
  ["/admin/catalog", "catalog.view"],
  ["/admin/integrations", "integrations.view"],
]) {
  if (!router.includes(`path: \"${route}\"`) || !router.includes(`permission=\"${permission}\"`)) {
    failures.push(`UI completeness: ${route} must preserve RBAC permission ${permission}`);
  }
}

const directoryRoutes = [
  "/admin/catalog",
  "/admin/payments",
  "/admin/inventory",
  "/admin/dropshipping",
  "/admin/suppliers",
  "/admin/reports",
  "/admin/integrations",
  "/admin/launch",
];
for (const route of directoryRoutes) {
  if (!adminDirectory.includes(`href: \"${route}\"`)) failures.push(`UI completeness: admin directory is missing ${route}`);
}
if (adminDirectory.includes("href?:") || adminHub.includes("aria-disabled=\"true\"")) {
  failures.push("UI completeness: real admin capabilities must not be represented by disabled navigation placeholders");
}
if (router.includes("AdminOperationsPage")) {
  failures.push("UI completeness: stale AdminOperationsPage must not remain the routed admin hub");
}

const accountContracts = [
  [fulfillment, "fetchAccountOrder"],
  [fulfillment, "fetchOrderTracking"],
  [fulfillment, "cancelAccountOrder"],
  [accountOrders, "fetchAccountOrder("],
  [accountOrders, "fetchOrderTracking("],
  [accountOrders, "cancelAccountOrder("],
  [loyalty, "points_to_redeem"],
  [accountOrders, "redeemPointsForOrder("],
  [accountOrders, "247:3"],
];
for (const [source, signature] of accountContracts) {
  if (!source.includes(signature)) failures.push(`UI completeness: account order workflow missing ${signature}`);
}

const operationContracts = [
  "fetchStockLevel(",
  "scanInventoryBarcode(",
  "lookupInventorySerial(",
  "adjustInventoryStock(",
  "createSupplier(",
  "updateSupplier(",
  "createPurchaseOrder(",
  "updatePurchaseOrder(",
  "listProductSupplierLinks(",
  "upsertProductSupplierLink(",
  "updateDropshipShipment(",
  "fetchCatalogContent(",
  "updateCatalogContent(",
  "uploadCatalogMedia(",
  "deleteCatalogMedia(",
  "downloadSalesExport(",
];
for (const signature of operationContracts) {
  if (!operations.includes(`export function ${signature}`) && !operations.includes(`export async function ${signature}`)) {
    failures.push(`UI completeness: missing real API bridge ${signature}`);
  }
  if (!adminCompleteness.includes(signature)) failures.push(`UI completeness: ${signature} is not reachable from an admin UI`);
}

for (const node of ["247:70", "247:135", "247:200", "247:265", "247:329"]) {
  if (!adminCompleteness.includes(node)) failures.push(`UI completeness: missing implementation binding for Figma ${node}`);
}

if (!adminSecure.includes("beginMfaEnrollment") || !adminSecure.includes("confirmMfaEnrollment") || !adminSecure.includes("verifyMfa")) {
  failures.push("UI completeness: direct admin routes must offer the same MFA enrollment/verification boundary as the console");
}

for (const token of ["var(--el-bg-canvas)", "var(--el-surface-1)", "var(--el-text-primary)", "var(--el-input-bg", "var(--el-control-bg", "var(--el-button-primary-bg"]) {
  if (!styles.includes(token)) failures.push(`UI completeness: P20 surfaces must use semantic theme token ${token}`);
}
if (!main.includes('"@/styles/p20-completeness.css"')) failures.push("UI completeness: P20 semantic styles must load globally");

const forbidden = [
  [accountOrders, /payment_method\s*===\s*["']paymob["']/i, "customer payment UI must remain provider-neutral"],
  [accountOrders, /mock|fixture/i, "account fulfilment must not use mock data"],
  [adminCompleteness, /mock|fixture/i, "admin completeness surfaces must not use mock data"],
];
for (const [source, pattern, label] of forbidden) if (pattern.test(source)) failures.push(`UI completeness: ${label}`);

if (failures.length) {
  console.error("UI completeness contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("UI completeness validated: routes, RBAC/MFA, account fulfilment, loyalty, inventory, suppliers, dropship, catalog, reports and semantic theme coverage.");
