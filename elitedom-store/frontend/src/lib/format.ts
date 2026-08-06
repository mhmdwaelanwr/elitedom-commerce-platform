import type { Locale } from "@/config/preferences";
import type { Currency } from "@/types/store";

const EGP_TO_USD = 50;

function intlLocale(locale: Locale) {
  return locale === "ar" ? "ar-EG" : "en-EG";
}

export function formatPrice(
  priceEgp: number,
  currency: Currency = "EGP",
  locale: Locale = "en",
) {
  const value = currency === "USD" ? priceEgp / EGP_TO_USD : priceEgp;
  return new Intl.NumberFormat(
    currency === "USD" && locale === "en" ? "en-US" : intlLocale(locale),
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function formatShortPrice(
  priceEgp: number,
  locale: Locale = "en",
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(priceEgp);
}

export function formatNumber(
  value: number,
  locale: Locale = "en",
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatDate(
  value: string | number | Date,
  locale: Locale = "en",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(
    new Date(value),
  );
}
