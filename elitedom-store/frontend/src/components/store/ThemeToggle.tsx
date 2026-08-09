import { useEffect, useState } from "react";
import { StoreIcon } from "@/components/store/StoreIcon";
import { readTheme, setTheme, THEME_CHANGED_EVENT, type ElitedomTheme } from "@/lib/theme";

type ThemeToggleProps = {
  locale: "en" | "ar";
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ locale, className, showLabel = false }: ThemeToggleProps) {
  const [theme, setCurrentTheme] = useState<ElitedomTheme>(() => readTheme());
  const ar = locale === "ar";
  const nextTheme: ElitedomTheme = theme === "dark" ? "light" : "dark";
  const actionLabel = nextTheme === "dark"
    ? (ar ? "تفعيل الوضع الليلي" : "Switch to dark mode")
    : (ar ? "تفعيل الوضع الفاتح" : "Switch to light mode");
  const visibleLabel = nextTheme === "dark"
    ? (ar ? "الوضع الليلي" : "Dark mode")
    : (ar ? "الوضع الفاتح" : "Light mode");

  useEffect(() => {
    function onThemeChanged(event: Event) {
      const detail = (event as CustomEvent<ElitedomTheme>).detail;
      if (detail === "dark" || detail === "light") setCurrentTheme(detail);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === "elitedom-theme") setCurrentTheme(readTheme());
    }
    window.addEventListener(THEME_CHANGED_EVENT, onThemeChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, onThemeChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggleTheme() {
    setTheme(nextTheme);
    setCurrentTheme(nextTheme);
  }

  return (
    <button
      aria-label={actionLabel}
      aria-pressed={theme === "dark"}
      className={["el-theme-toggle", showLabel ? "el-theme-toggle--labelled" : "", className ?? ""].filter(Boolean).join(" ")}
      data-theme-current={theme}
      onClick={toggleTheme}
      title={actionLabel}
      type="button"
    >
      <StoreIcon name={theme === "dark" ? "sun" : "moon"} size={19} />
      {showLabel ? <span>{visibleLabel}</span> : null}
    </button>
  );
}
