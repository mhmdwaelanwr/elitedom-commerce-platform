import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import "@/styles/admin-theme-route.css";

export function AdminThemeRoute({ children }: { children: ReactNode }) {
  const [locale] = useStoreLocale();
  return (
    <div className="el-admin-launch-frame">
      <ThemeToggle className="el-admin-launch-theme" locale={locale} />
      {children}
    </div>
  );
}
