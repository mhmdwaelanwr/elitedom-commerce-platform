export type Currency = "EGP" | "USD";
export type CategorySlug = string;

export type ProductSpec = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  categoryName: string;
  brand: string;
  priceEgp: number;
  stockQty: number;
  dropshipEnabled: boolean;
  image: string;
  gallery: string[];
  specs: ProductSpec[];
  warrantyMonths: number;
  rating: number;
  featured?: boolean;
};

export type Category = {
  slug: string;
  name: string;
  description: string;
  image: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
  serverItemId?: number;
};

export type CustomerSession = {
  accessToken: string;
  userId: number;
  role: string;
  sessionId?: string;
  expiresAt?: number;
  email?: string;
  name?: string;
};

export type CheckoutDetails = {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  governorate: string;
  paymentMethod: "credit_card" | "cash_on_delivery" | "instapay";
  notes?: string;
  useLoyaltyPoints: boolean;
};

export type CheckoutResult = {
  orderNumber: string;
  paymentGatewayUrl?: string;
  isOfflineFallback: boolean;
};
