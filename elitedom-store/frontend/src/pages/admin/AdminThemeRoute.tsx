import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { LaunchControlPage } from "@/pages/admin/LaunchControlPage";
import "@/styles/admin-theme-route.css";

export function LaunchControlRoute() {
  const [locale] = useStoreLocale();
  return (
    <div className="el-admin-launch-frame">
      <ThemeToggle className="el-admin-launch-theme" locale={locale} />
      <LaunchControlPage />
    </div>
  );
}
