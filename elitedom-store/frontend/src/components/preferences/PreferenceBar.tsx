"use client";

import { Select } from "@/components/ui";
import {
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/config/preferences";
import { cn } from "@/lib/cn";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function PreferenceBar() {
  const { locale, setLocale, setTheme, t, theme } = usePreferences();

  return (
    <div className="border-b border-border bg-elevated text-foreground">
      <div className="site-container flex min-h-10 flex-wrap items-center justify-end gap-2 py-2 text-xs">
        <div
          aria-label={t("common", "language")}
          className="inline-flex rounded-lg border border-border bg-surface p-0.5"
          role="group"
        >
          <button
            aria-pressed={locale === "en"}
            className={cn(
              "focus-ring rounded-md px-2.5 py-1.5 font-bold transition",
              locale === "en"
                ? "bg-primary text-primary-contrast"
                : "text-muted hover:bg-elevated hover:text-foreground",
            )}
            onClick={() => setLocale("en")}
            type="button"
          >
            EN
          </button>
          <button
            aria-pressed={locale === "ar"}
            className={cn(
              "focus-ring rounded-md px-2.5 py-1.5 font-bold transition",
              locale === "ar"
                ? "bg-primary text-primary-contrast"
                : "text-muted hover:bg-elevated hover:text-foreground",
            )}
            onClick={() => setLocale("ar")}
            type="button"
          >
            عربي
          </button>
        </div>

        <Select
          aria-label={t("common", "theme")}
          className="min-h-8 w-auto py-1 text-xs"
          onChange={(event) => setTheme(event.target.value as ThemePreference)}
          value={theme}
        >
          {THEME_PREFERENCES.map((option) => (
            <option key={option} value={option}>
              {t(
                "common",
                option === "system"
                  ? "themeSystem"
                  : option === "light"
                    ? "themeLight"
                    : "themeDark",
              )}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
