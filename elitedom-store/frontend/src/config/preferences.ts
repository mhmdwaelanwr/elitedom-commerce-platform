export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_THEME: ThemePreference = "system";

export const LOCALE_COOKIE = "elitedom_locale";
export const THEME_COOKIE = "elitedom_theme";
export const LOCALE_STORAGE_KEY = "elitedom.preferences.locale.v1";
export const THEME_STORAGE_KEY = "elitedom.preferences.theme.v1";
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function isThemePreference(
  value: string | undefined | null,
): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark = false,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export const PREFERENCE_BOOTSTRAP_SCRIPT = String.raw`
(() => {
  try {
    const root = document.documentElement;
    const readCookie = (name) => {
      const prefix = name + "=";
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : null;
    };

    const storedLocale =
      window.localStorage.getItem("${LOCALE_STORAGE_KEY}") ||
      readCookie("${LOCALE_COOKIE}") ||
      root.lang ||
      "${DEFAULT_LOCALE}";
    const locale = storedLocale === "ar" ? "ar" : "en";

    const storedTheme =
      window.localStorage.getItem("${THEME_STORAGE_KEY}") ||
      readCookie("${THEME_COOKIE}") ||
      "${DEFAULT_THEME}";
    const preference = ["system", "light", "dark"].includes(storedTheme)
      ? storedTheme
      : "${DEFAULT_THEME}";
    const resolved =
      preference === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : preference;

    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;
