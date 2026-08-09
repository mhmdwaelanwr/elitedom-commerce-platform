import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { CheckoutPage } from "@/pages/CheckoutPage";
import "@/styles/checkout-theme-route.css";

export function CheckoutRoute() {
  const [locale] = useStoreLocale();
  return (
    <div className="el-checkout-route-frame">
      <ThemeToggle className="el-checkout-route-theme" locale={locale} />
      <CheckoutPage />
    </div>
  );
}
