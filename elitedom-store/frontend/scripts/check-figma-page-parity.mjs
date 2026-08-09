import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

const pages = [
  { node: "33:219", name: "Storefront / Final / EN", file: "src/pages/HomePage.tsx", signatures: ["el-hero", "el-category-rail", "el-curated", "el-outcomes", "el-b2b-editorial", "SocialDock", "StoreFooter"] },
  { node: "83:339", name: "Storefront / Final / AR RTL", file: "src/pages/HomePage.tsx", signatures: ["locale === \"ar\"", "document.documentElement.dir", "mobileTitle", "mobileCuratedTitle"] },
  { node: "37:207", name: "Catalog / Final / EN", file: "src/pages/CatalogPage.tsx", signatures: ["el-catalog-intro", "el-catalog-toolbar", "el-filter-rail", "el-catalog-grid"] },
  { node: "157:259", name: "Catalog / States / Results / EN", file: "src/pages/CatalogPage.tsx", signatures: ["status: \"loading\"", "status: \"error\"", "visibleProducts.length === 0", "resetFilters"] },
  { node: "38:39", name: "PDP / Final / EN", file: "src/pages/ProductDetailPage.tsx", signatures: ["el-pdp-hero", "el-pdp-main-media", "el-pdp-technical", "el-pdp-related"] },
  { node: "41:36", name: "Checkout / Final / EN", file: "src/pages/CheckoutPage.tsx", signatures: ["el-checkout-intro", "el-checkout-layout", "el-checkout-payment", "el-order-summary--checkout"] },
  { node: "90:90", name: "Cart / Final / EN", file: "src/pages/CartPage.tsx", signatures: ["StoreHeader", "StoreFooter", "el-cart"] },
  { node: "157:525", name: "Checkout / Result States / EN", file: "src/pages/CheckoutPage.tsx", signatures: ["success", "pending", "error", "CheckoutResultPanel"] },
  { node: "76:14", name: "Auth / Final / Sign in / EN", file: "src/pages/AuthPage.tsx", signatures: ["mode === \"sign-in\"", "SignIn"] },
  { node: "94:24", name: "Auth / Final / Phone OTP / EN", file: "src/pages/AuthPage.tsx", signatures: ["mode === \"otp\"", "OtpVerification"] },
  { node: "94:111", name: "Auth / Final / Create Account / EN", file: "src/pages/AuthPage.tsx", signatures: ["mode === \"create\"", "CreateAccount"] },
  { node: "156:103", name: "Auth / Final / Forgot Password / EN", file: "src/pages/AuthPage.tsx", signatures: ["mode === \"forgot\"", "ForgotPassword"] },
  { node: "156:186", name: "Auth / Final / Reset Password / EN", file: "src/pages/AuthPage.tsx", signatures: ["mode === \"reset\"", "ResetPassword"] },
  { node: "156:280", name: "Auth / Final / Recovery Sent / EN", file: "src/pages/RecoverySentPage.tsx", signatures: ["AuthShell", "Recovery link sent", "el-auth-recovery-panel"] },
  { node: "91:1263", name: "Account / Final / Overview / EN", file: "src/pages/AccountPage.tsx", signatures: ["StoreHeader", "el-account", "orders", "security", "StoreFooter"] },
  { node: "12:2", name: "B2B / Final / Procurement Landing / EN", file: "src/pages/B2BPage.tsx", signatures: ["BusinessLandingPage", "el-b2b-hero", "el-b2b-feature-grid", "StoreFooter"] },
  { node: "12:44", name: "B2B / Final / RFQ Workspace / EN", file: "src/pages/B2BPage.tsx", signatures: ["BusinessRfqPage", "fetchRfqs", "submitRfq", "convertRfq"] },
  { node: "44:66", name: "Admin / Final / Operations Console", file: "src/pages/admin/AdminOperationsPage.tsx", signatures: ["Operations dashboard", "PAYMENT SUCCESS", "Integration health", "Fulfilment pulse", "Launch control", "ThemeToggle"] },
  { node: "45:114", name: "Mobile / Final / Storefront / AR RTL", file: "src/styles/p14-responsive.css", signatures: ["@media (max-width: 620px)", "el-hero__title--mobile", "el-category-rail--mobile"] },
  { node: "97:155", name: "Mobile / Final / PDP / AR RTL", file: "src/styles/p14-responsive.css", signatures: ["P14.b — Mobile PDP", "el-pdp-main-media", "el-pdp-technical"] },
  { node: "98:212", name: "Mobile / Final / Checkout / AR RTL", file: "src/styles/p14-responsive.css", signatures: ["el-checkout", "el-payment-method"] },
  { node: "100:224", name: "Theme / Light / Store Reference / EN", file: "src/styles/globals.css", signatures: [":root[data-theme=\"light\"]", "--el-bg-canvas: #f6f8fa", "--el-action-primary: #07090c"] },
  { node: "105:301", name: "Tablet / Final / Storefront / EN", file: "src/styles/p14-responsive.css", signatures: ["@media (max-width: 900px)", "el-store-header__mobile-row"] },
  { node: "244:3", name: "P19 Admin / Final / Orders", file: "src/pages/admin/AdminConsolePage.tsx", signatures: ["OrdersSection", "fetchAdminOrders", "updateAdminOrderState"] },
  { node: "244:296", name: "P19 Admin / Final / Payments", file: "src/pages/admin/AdminPlatformPage.tsx", signatures: ["PAYMENT OPERATIONS", "PaymentsSurface", "fetchPaymentTrail", "requestPaymentRefund"] },
  { node: "244:589", name: "P19 Admin / Final / Inventory", file: "src/pages/admin/AdminPlatformPage.tsx", signatures: ["INVENTORY CONTROL", "InventorySurface", "fetchInventoryReport"] },
  { node: "244:882", name: "P19 Admin / Final / Suppliers & Procurement", file: "src/pages/admin/AdminPlatformPage.tsx", signatures: ["SUPPLIER & PROCUREMENT", "SuppliersSurface", "fetchSuppliers", "fetchPurchaseOrders"] },
  { node: "244:1175", name: "P19 Admin / Final / Reporting", file: "src/pages/admin/AdminPlatformPage.tsx", signatures: ["REPORTING & ANALYTICS", "ReportsSurface", "fetchReportingDashboard"] },
  { node: "244:1761", name: "P19 Admin / Final / RMA & Warranty", file: "src/pages/admin/AdminConsolePage.tsx", signatures: ["RmaSection", "fetchAdminRmas", "reviewAdminRma"] },
  { node: "244:2054", name: "P19 Admin / Final / Shipping & Fulfilment", file: "src/pages/admin/AdminConsolePage.tsx", signatures: ["ShipmentsSection", "fetchAdminShipments", "dispatchAdminOrder"] },
  { node: "244:2347", name: "P19 Admin / Final / Integrations & Audit", file: "src/pages/admin/AdminPlatformPage.tsx", signatures: ["INTEGRATIONS & AUDIT", "IntegrationsSurface", "fetchRuntimeReadiness", "fetchAdminAuditLogs"] },
  { node: "244:2640", name: "P19 Account / Final / Loyalty", file: "src/pages/AccountPage.tsx", signatures: ["LoyaltySection", "fetchLoyaltyBalance", "fetchLoyaltyHistory"] },
  { node: "244:2682", name: "P19 Account / Final / Warranty & RMA", file: "src/pages/WarrantyPage.tsx", signatures: ["ACCOUNT / WARRANTY", "fetchWarrantyClaims", "checkWarranty", "submitWarrantyClaim"] },
];

function source(relativePath) {
  const absolute = join(frontendRoot, relativePath);
  if (!existsSync(absolute)) {
    failures.push(`Figma parity: missing implementation file ${relativePath}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

for (const page of pages) {
  const text = source(page.file);
  for (const signature of page.signatures) {
    if (!text.includes(signature)) failures.push(`Figma ${page.node} (${page.name}) is missing implementation signature ${JSON.stringify(signature)} in ${page.file}`);
  }
}

const account = source("src/pages/AccountPage.tsx");
const adminConsole = source("src/pages/admin/AdminConsolePage.tsx");
if (!account.includes("LoyaltySection") || !adminConsole.includes("CustomersSection")) failures.push("Figma 244:1468 requires both customer operations and account loyalty implementation.");
if (!adminConsole.includes("AuditSection") || !source("src/pages/admin/AdminPlatformPage.tsx").includes("IntegrationsSurface")) failures.push("Figma 244:2347 requires integrations plus immutable audit visibility.");

const router = source("src/router.tsx");
const routeContracts = [
  ["/", "HomePage"], ["/catalog", "CatalogPage"], ["/products/:productId", "ProductDetailPage"], ["/cart", "CartPage"], ["/checkout", "CheckoutRoute"],
  ["/auth", "AuthPage"], ["/auth/create", "AuthPage"], ["/auth/otp", "AuthPage"], ["/auth/forgot", "AuthPage"], ["/auth/reset", "AuthPage"], ["/auth/recovery-sent", "RecoverySentPage"],
  ["/account", "AccountPage"], ["/account/warranty", "WarrantyPage"], ["/business", "BusinessLandingPage"], ["/business/rfq", "BusinessRfqPage"], ["/business/rfq/:rfqCode", "BusinessRfqPage"],
  ["/admin", "AdminRoutePage"], ["/admin/payments", "AdminPlatformPage"], ["/admin/inventory", "AdminPlatformPage"], ["/admin/suppliers", "AdminPlatformPage"], ["/admin/reports", "AdminPlatformPage"], ["/admin/catalog", "AdminPlatformPage"], ["/admin/integrations", "AdminPlatformPage"], ["/admin/launch", "LaunchControlPage"],
];
for (const [route, component] of routeContracts) {
  if (!router.includes(`path: \"${route}\"`) || !router.includes(`<${component}`)) failures.push(`Figma parity: route ${route} must resolve to ${component}`);
}

const storeHeader = source("src/components/store/StoreHeader.tsx");
const authShell = source("src/components/auth/AuthShell.tsx");
const checkoutThemeRoute = source("src/pages/CheckoutThemeRoute.tsx");
const adminOperations = source("src/pages/admin/AdminOperationsPage.tsx");
const adminThemeRoute = source("src/pages/admin/AdminThemeRoute.tsx");
const theme = source("src/lib/theme.ts");
const globals = source("src/styles/globals.css");
const themeHardening = source("src/styles/theme-hardening.css");

for (const [surface, text] of [["store header", storeHeader], ["authentication shell", authShell], ["checkout and checkout-result shell", checkoutThemeRoute], ["admin operations", adminOperations], ["launch control", adminThemeRoute]]) {
  if (!text.includes("ThemeToggle")) failures.push(`Theme parity: ${surface} must expose ThemeToggle`);
}
if ((storeHeader.match(/<ThemeToggle/g) ?? []).length < 2) failures.push("Theme parity: StoreHeader must expose theme control in desktop and mobile action rows");
if (!theme.includes("THEME_CHANGED_EVENT") || !theme.includes("localStorage")) failures.push("Theme parity: app theme must persist and synchronize changes");
for (const token of ["--el-control-bg", "--el-control-hover", "--el-input-bg", "--el-button-primary-bg", "--el-provider-google-bg", "--el-provider-apple-bg", "--el-accent-on"]) {
  if (!globals.includes(token)) failures.push(`Theme parity: missing semantic token ${token}`);
}
for (const selector of [".el-auth-provider.is-google", ".el-auth-provider.is-apple", ".el-auth-primary:hover", ".el-account-primary:hover", ".el-store-layer"]) {
  if (!themeHardening.includes(selector)) failures.push(`Theme parity: hardening layer must normalize ${selector}`);
}
if (!source("src/main.tsx").includes('import "@/styles/theme-hardening.css"')) failures.push("Theme parity: theme-hardening.css must load globally after shared surfaces");

const forbiddenPreviewRoutes = ["/figma", "/design-preview", "/theme-preview"];
for (const route of forbiddenPreviewRoutes) if (router.includes(`path: \"${route}\"`)) failures.push(`Figma parity: duplicate preview route is forbidden: ${route}`);

if (failures.length) {
  console.error("Figma page parity checks failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Figma page parity validated: ${pages.length} final frames, P19 backend surfaces, theme controls and route contracts.`);
