import { useEffect, useState } from "react";
import type { StoreLocale } from "@/components/store/StoreHeader";

const STORAGE_KEY = "elitedom-locale";

export function useStoreLocale() {
  const [locale, setLocale] = useState<StoreLocale>(() =>
    window.localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en",
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return [locale, setLocale] as const;
}
