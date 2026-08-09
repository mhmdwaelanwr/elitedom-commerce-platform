import { createBrowserRouter } from "react-router-dom";
import { AuthPage } from "@/pages/AuthPage";
import { BusinessLandingPage, BusinessRfqPage } from "@/pages/B2BPage";
import { CartPage } from "@/pages/CartPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutRoute } from "@/pages/CheckoutThemeRoute";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { RecoverySentPage } from "@/pages/RecoverySentPage";
import { WarrantyPage } from "@/pages/WarrantyPage";
import { AccountEntryPage, AccountOrderDetailPage, AccountOrdersPage } from "@/pages/AccountOrdersPage";
import { AdminCompletenessPage } from "@/pages/admin/AdminCompletenessPage";
import { AdminEntryPage } from "@/pages/admin/AdminDirectoryPage";
import { AdminPlatformPage } from "@/pages/admin/AdminPlatformPage";
import { AdminSecureRoute } from "@/pages/admin/AdminSecureRoute";
import { AdminThemeRoute } from "@/pages/admin/AdminThemeRoute";
import { LaunchControlPage } from "@/pages/admin/LaunchControlPage";

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/catalog", element: <CatalogPage /> },
  { path: "/products/:productId", element: <ProductDetailPage /> },
  { path: "/cart", element: <CartPage /> },
  { path: "/checkout", element: <CheckoutRoute /> },
  { path: "/auth", element: <AuthPage mode="sign-in" /> },
  { path: "/auth/create", element: <AuthPage mode="create" /> },
  { path: "/auth/otp", element: <AuthPage mode="otp" /> },
  { path: "/auth/forgot", element: <AuthPage mode="forgot" /> },
  { path: "/auth/reset", element: <AuthPage mode="reset" /> },
  { path: "/auth/recovery-sent", element: <RecoverySentPage /> },
  { path: "/account", element: <AccountEntryPage /> },
  { path: "/account/orders", element: <AccountOrdersPage /> },
  { path: "/account/orders/:orderId", element: <AccountOrderDetailPage /> },
  { path: "/account/warranty", element: <WarrantyPage /> },
  { path: "/business", element: <BusinessLandingPage /> },
  { path: "/business/rfq", element: <BusinessRfqPage /> },
  { path: "/business/rfq/:rfqCode", element: <BusinessRfqPage /> },
  { path: "/admin", element: <AdminEntryPage /> },
  { path: "/admin/payments", element: <AdminSecureRoute permission="payments.view"><AdminPlatformPage kind="payments" /></AdminSecureRoute> },
  { path: "/admin/inventory", element: <AdminSecureRoute permission="inventory.view"><AdminCompletenessPage kind="inventory" /></AdminSecureRoute> },
  { path: "/admin/suppliers", element: <AdminSecureRoute permission="suppliers.view"><AdminCompletenessPage kind="suppliers" /></AdminSecureRoute> },
  { path: "/admin/dropshipping", element: <AdminSecureRoute permission="suppliers.view"><AdminCompletenessPage kind="dropshipping" /></AdminSecureRoute> },
  { path: "/admin/reports", element: <AdminSecureRoute permission="reports.view"><AdminCompletenessPage kind="reports" /></AdminSecureRoute> },
  { path: "/admin/catalog", element: <AdminSecureRoute permission="catalog.view"><AdminCompletenessPage kind="catalog" /></AdminSecureRoute> },
  { path: "/admin/integrations", element: <AdminSecureRoute permission="integrations.view"><AdminPlatformPage kind="integrations" /></AdminSecureRoute> },
  {
    path: "/admin/launch",
    element: <AdminThemeRoute><LaunchControlPage /></AdminThemeRoute>,
  },
  { path: "*", element: <NotFoundPage /> },
]);
