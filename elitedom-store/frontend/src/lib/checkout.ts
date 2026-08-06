import type { CartItem } from "@/types/store";

export const GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Asyut",
  "Beheira",
  "Beni Suef",
  "Damietta",
  "Qalyubia",
  "Dakahlia",
  "Faiyum",
  "Gharbia",
  "Ismailia",
  "Kafr El Sheikh",
  "Luxor",
  "Matrouh",
  "Minya",
  "Monufia",
  "New Valley",
  "North Sinai",
  "Port Said",
  "Qena",
  "Sharqia",
  "Sohag",
  "South Sinai",
  "Suez",
  "Red Sea",
  "Aswan",
] as const;

const SHIPPING_RATES: Record<string, number> = {
  Cairo: 150,
  Giza: 50,
  Alexandria: 75,
  Qalyubia: 60,
  Dakahlia: 80,
  Sharqia: 80,
  "Red Sea": 150,
  Luxor: 120,
  Aswan: 150,
};

export function getShippingRate(governorate: string) {
  return SHIPPING_RATES[governorate] ?? 100;
}

export function getCartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + item.product.priceEgp * item.quantity, 0);
}

export function getCheckoutTotals(
  items: CartItem[],
  governorate: string,
  loyaltyDiscount = 0,
) {
  const subtotal = getCartSubtotal(items);
  const shipping = getShippingRate(governorate);
  const vat = Math.round((subtotal + shipping) * 0.14);
  const total = Math.max(0, subtotal + shipping + vat - loyaltyDiscount);
  return { subtotal, shipping, vat, loyaltyDiscount, total };
}
