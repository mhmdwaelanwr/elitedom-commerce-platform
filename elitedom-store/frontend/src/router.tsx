import { createBrowserRouter } from "react-router-dom";
import { AccountPage } from "@/pages/AccountPage";
import { AuthPage } from "@/pages/AuthPage";
import { BusinessLandingPage, BusinessRfqPage } from "@/pages/B2BPage";
import { CartPage } from "@/pages/CartPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { RecoverySentPage } from "@/pages/RecoverySentPage";
import { AdminConsolePage } from "@/pages/admin/AdminConsolePage";
import { LaunchControlPage } from "@/pages/admin/LaunchControlPage";

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/catalog", element: <CatalogPage /> },
  { path: "/products/:productId", element: <ProductDetailPage /> },
  { path: "/cart", element: <CartPage /> },
  { path: "/checkout", element: <CheckoutPage /> },
  { path: "/auth", element: <AuthPage mode="sign-in" /> },
  { path: "/auth/create", element: <AuthPage mode="create" /> },
  { path: "/auth/otp", element: <AuthPage mode="otp" /> },
  { path: "/auth/forgot", element: <AuthPage mode="forgot" /> },
  { path: "/auth/reset", element: <AuthPage mode="reset" /> },
  { path: "/auth/recovery-sent", element: <RecoverySentPage /> },
  { path: "/account", element: <AccountPage /> },
  { path: "/business", element: <BusinessLandingPage /> },
  { path: "/business/rfq", element: <BusinessRfqPage /> },
  { path: "/business/rfq/:rfqCode", element: <BusinessRfqPage /> },
  { path: "/admin", element: <AdminConsolePage /> },
  { path: "/admin/launch", element: <LaunchControlPage /> },
  { path: "*", element: <NotFoundPage /> },
]);