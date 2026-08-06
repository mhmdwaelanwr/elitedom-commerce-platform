"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getDirection,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  PREFERENCE_COOKIE_MAX_AGE,
  resolveTheme,
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  type Locale,
  type ResolvedTheme,
  type ThemePreference,
} from "@/config/preferences";
import {
  getMessage,
  type TranslationDomain,
  type TranslationKey,
} from "@/locales";

type PreferencesContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  t: <Domain extends TranslationDomain>(
    domain: Domain,
    key: TranslationKey<Domain>,
  ) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function subscribeToSystemTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerThemeSnapshot(): ResolvedTheme {
  return "light";
}

function persistPreference(name: string, value: string, storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Storage can be unavailable in privacy-focused browser modes.
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function AppPreferencesProvider({
  children,
  initialLocale,
  initialTheme,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialTheme: ThemePreference;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerThemeSnapshot,
  );
  const resolvedTheme = resolveTheme(theme, systemTheme === "dark");

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getDirection(locale);
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = theme;
    root.style.colorScheme = resolvedTheme;
  }, [locale, resolvedTheme, theme]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistPreference(LOCALE_COOKIE, nextLocale, LOCALE_STORAGE_KEY);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    persistPreference(THEME_COOKIE, nextTheme, THEME_STORAGE_KEY);
  }, []);

  const t = useCallback(
    <Domain extends TranslationDomain,>(
      domain: Domain,
      key: TranslationKey<Domain>,
    ) => getMessage(locale, domain, key),
    [locale],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      locale,
      direction: getDirection(locale),
      theme,
      resolvedTheme,
      setLocale,
      setTheme,
      t,
    }),
    [locale, resolvedTheme, setLocale, setTheme, t, theme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within AppPreferencesProvider.");
  }
  return context;
}
