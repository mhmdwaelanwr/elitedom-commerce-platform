import type { Currency } from "@/types/store";

const EGP_TO_USD = 50;

export function formatPrice(priceEgp: number, currency: Currency = "EGP") {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(priceEgp / EGP_TO_USD);
  }

  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(priceEgp);
}

export function formatShortPrice(priceEgp: number) {
  return new Intl.NumberFormat("en-EG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(priceEgp);
}
