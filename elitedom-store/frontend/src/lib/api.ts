import { CATALOG, findCatalogProduct } from "@/lib/catalog";
import { clientEnv } from "@/lib/env";
import type {
  CartItem,
  CheckoutDetails,
  CheckoutResult,
  CustomerSession,
  Product,
} from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();
const DEMO_FALLBACK = clientEnv.demoCatalogFallback;
const PRODUCT_PLACEHOLDER = "/images/gpu_card.png";

type ApiCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type ApiProduct = {
  id: number;
  name: string;
  sku: string;
  description?: string | null;
  list_price: string | number;
  stock_qty: number;
  is_dropship_enabled: boolean;
  brand?: string | null;
  category_id?: number | null;
  category?: ApiCategory | null;
  warranty_months?: number;
  images?: Array<{
    id: number;
    url: string;
    alt_text?: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
  socket_type?: string | null;
  ram_type?: string | null;
  form_factor?: string | null;
  power_wattage_draw?: number;
  pcie_gen?: string | null;
};

type ApiProductList = { products: ApiProduct[]; total_count: number };

type ApiCart = {
  id: number;
  session_id?: string | null;
  items: Array<{
    id: number;
    product_id: number;
    quantity: number;
    product_name?: string | null;
    unit_price?: string | number | null;
    sku?: string | null;
  }>;
};

type ApiWishlist = { items: Array<{ product_id: number }> };

export type CustomerProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
  governorate?: string | null;
  street_address?: string | null;
  role: string;
  email_verified: boolean;
};

export type CustomerAddress = {
  id: number;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  address_line_2?: string | null;
  city: string;
  governorate: string;
  postal_code?: string | null;
  country: string;
  is_default: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("The Elitedom service is currently unreachable.", 0);
  }
  if (!response.ok) {
    let message = "We could not complete that request.";
    try {
      const payload = (await response.json()) as {
        detail?: string | { message?: string };
        message?: string;
      };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Preserve the generic message for non-JSON gateway errors.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function resolveImageUrl(url: string | undefined): string {
  if (!url) return PRODUCT_PLACEHOLDER;
  if (url.startsWith("/media/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return PRODUCT_PLACEHOLDER;
}

function apiProductToStoreProduct(apiProduct: ApiProduct): Product {
  const orderedImages = [...(apiProduct.images ?? [])].sort(
    (first, second) =>
      Number(second.is_primary) - Number(first.is_primary) ||
      first.sort_order - second.sort_order ||
      first.id - second.id,
  );
  const gallery = orderedImages.map((image) => resolveImageUrl(image.url));
  const image = gallery[0] ?? PRODUCT_PLACEHOLDER;
  const specs = [
    apiProduct.socket_type && { label: "Socket", value: apiProduct.socket_type },
    apiProduct.ram_type && { label: "Memory", value: apiProduct.ram_type },
    apiProduct.form_factor && { label: "Form factor", value: apiProduct.form_factor },
    apiProduct.pcie_gen && { label: "PCIe", value: apiProduct.pcie_gen },
    apiProduct.power_wattage_draw
      ? { label: "Power", value: `${apiProduct.power_wattage_draw} W` }
      : null,
  ].filter(Boolean) as Product["specs"];
  const category = apiProduct.category?.slug ?? "uncategorized";

  return {
    id: String(apiProduct.id),
    sku: apiProduct.sku,
    name: apiProduct.name,
    description: apiProduct.description ?? "Verified technology product from Elitedom.",
    brand: apiProduct.brand ?? "Elitedom",
    category,
    categoryName: apiProduct.category?.name ?? "Technology",
    priceEgp: Number(apiProduct.list_price),
    stockQty: apiProduct.stock_qty,
    dropshipEnabled: apiProduct.is_dropship_enabled,
    image,
    gallery: gallery.length > 0 ? gallery : [image],
    warrantyMonths: apiProduct.warranty_months ?? 12,
    specs,
    rating: 0,
  };
}

export async function fetchCatalog(query?: string): Promise<Product[]> {
  try {
    const path = query?.trim()
      ? `/products/search?q=${encodeURIComponent(query.trim())}&limit=100`
      : "/products?limit=100";
    const payload = await request<ApiProductList>(path);
    return payload.products.map(apiProductToStoreProduct);
  } catch (error) {
    if (!DEMO_FALLBACK || (error instanceof ApiError && error.status !== 0)) throw error;
    const normalizedQuery = query?.trim().toLowerCase();
    return normalizedQuery
      ? CATALOG.filter((product) =>
          [product.name, product.brand, product.sku, product.categoryName]
            .concat(product.specs.flatMap((specification) => [specification.label, specification.value]))
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : CATALOG;
  }
}

export async function fetchProduct(productId: string): Promise<Product | undefined> {
  try {
    return apiProductToStoreProduct(
      await request<ApiProduct>(`/products/${encodeURIComponent(productId)}`),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    if (!DEMO_FALLBACK || (error instanceof ApiError && error.status !== 0)) throw error;
    return findCatalogProduct(productId);
  }
}

function cartPath(path: string, guestSessionId: string | undefined, session?: CustomerSession | null) {
  if (session || !guestSessionId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(guestSessionId)}`;
}

function cartItemToStoreItem(item: ApiCart["items"][number]): CartItem {
  const matchingProduct = findCatalogProduct(item.product_id, item.sku);
  const fallbackProduct: Product = matchingProduct ?? {
    id: String(item.product_id),
    sku: item.sku ?? `PRODUCT-${item.product_id}`,
    name: item.product_name ?? "Elitedom product",
    description: "Product details will refresh from the catalogue service.",
    category: "uncategorized",
    categoryName: "Technology",
    brand: "Elitedom",
    priceEgp: Number(item.unit_price ?? 0),
    stockQty: 0,
    dropshipEnabled: false,
    image: PRODUCT_PLACEHOLDER,
    gallery: [PRODUCT_PLACEHOLDER],
    specs: [],
    warrantyMonths: 12,
    rating: 0,
  };
  return {
    serverItemId: item.id,
    quantity: item.quantity,
    product: {
      ...fallbackProduct,
      id: String(item.product_id),
      sku: item.sku ?? fallbackProduct.sku,
      name: item.product_name ?? fallbackProduct.name,
      priceEgp: Number(item.unit_price ?? fallbackProduct.priceEgp),
    },
  };
}

export function mapRemoteCart(cart: ApiCart): CartItem[] {
  return cart.items.map(cartItemToStoreItem);
}

export async function fetchRemoteCart(
  guestSessionId?: string,
  session?: CustomerSession | null,
) {
  return request<ApiCart>(cartPath("/orders/cart", guestSessionId, session), {}, session?.accessToken);
}

export async function addRemoteCartItem(
  input: { productId: string; quantity: number },
  guestSessionId?: string,
  session?: CustomerSession | null,
) {
  return request<ApiCart>(
    cartPath("/orders/cart/items", guestSessionId, session),
    { method: "POST", body: JSON.stringify({ product_id: Number(input.productId), quantity: input.quantity }) },
    session?.accessToken,
  );
}

export async function updateRemoteCartItem(
  itemId: number,
  quantity: number,
  guestSessionId?: string,
  session?: CustomerSession | null,
) {
  return request<ApiCart>(
    cartPath(`/orders/cart/items/${itemId}`, guestSessionId, session),
    { method: "PUT", body: JSON.stringify({ quantity }) },
    session?.accessToken,
  );
}

export async function removeRemoteCartItem(
  itemId: number,
  guestSessionId?: string,
  session?: CustomerSession | null,
) {
  return request<ApiCart>(
    cartPath(`/orders/cart/items/${itemId}`, guestSessionId, session),
    { method: "DELETE" },
    session?.accessToken,
  );
}

export async function mergeGuestCart(session: CustomerSession, guestSessionId: string) {
  return request<ApiCart>(
    `/orders/cart/sync?session_id=${encodeURIComponent(guestSessionId)}`,
    { method: "POST" },
    session.accessToken,
  );
}

export async function fetchRemoteWishlist(session: CustomerSession): Promise<string[]> {
  const result = await request<ApiWishlist>("/customers/me/wishlist", {}, session.accessToken);
  return result.items.map((item) => String(item.product_id));
}

export async function addRemoteWishlistItem(productId: string, session: CustomerSession) {
  return request<void>(
    "/customers/me/wishlist",
    { method: "POST", body: JSON.stringify({ product_id: Number(productId) }) },
    session.accessToken,
  );
}

export async function removeRemoteWishlistItem(productId: string, session: CustomerSession) {
  return request<void>(
    `/customers/me/wishlist/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
    session.accessToken,
  );
}

export async function login(input: { email: string; password: string }): Promise<CustomerSession> {
  const result = await request<{ access_token: string; user_id: number; role: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify(input) },
  );
  return {
    accessToken: result.access_token,
    userId: result.user_id,
    role: result.role,
    email: input.email,
  };
}

export async function register(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}) {
  return request<{ user_id: number; message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(session: CustomerSession) {
  await request<void>("/auth/logout", { method: "POST" }, session.accessToken);
}

export async function fetchAccountOverview(session: CustomerSession) {
  const [profileResult, ordersResult, loyaltyResult] = await Promise.allSettled([
    request<{ name?: string; email?: string; phone?: string; role?: string }>(
      "/customers/me",
      {},
      session.accessToken,
    ),
    request<{ orders?: Array<{ id: number; name: string; state: string; amount_total: string | number; created_at: string }> }>(
      "/orders?limit=5",
      {},
      session.accessToken,
    ),
    request<{ points_balance: number; redeemable_value_egp: string | number }>(
      "/loyalty/balance",
      {},
      session.accessToken,
    ),
  ]);
  return {
    profile: profileResult.status === "fulfilled" ? profileResult.value : null,
    orders: ordersResult.status === "fulfilled" ? ordersResult.value.orders ?? [] : [],
    loyalty: loyaltyResult.status === "fulfilled" ? loyaltyResult.value : null,
  };
}

export async function fetchCustomerProfile(session: CustomerSession) {
  return request<CustomerProfile>("/customers/me", {}, session.accessToken);
}

export async function updateCustomerProfile(
  input: Partial<Pick<CustomerProfile, "name" | "email" | "phone" | "governorate" | "street_address">>,
  session: CustomerSession,
) {
  return request<CustomerProfile>(
    "/customers/me",
    { method: "PUT", body: JSON.stringify(input) },
    session.accessToken,
  );
}

export async function fetchCustomerAddresses(session: CustomerSession) {
  const result = await request<{ addresses: CustomerAddress[] }>(
    "/customers/me/addresses",
    {},
    session.accessToken,
  );
  return result.addresses;
}

export type NewCustomerAddress = Omit<CustomerAddress, "id" | "is_default"> & {
  is_default?: boolean;
};

export async function createCustomerAddress(input: NewCustomerAddress, session: CustomerSession) {
  return request<CustomerAddress>(
    "/customers/me/addresses",
    { method: "POST", body: JSON.stringify(input) },
    session.accessToken,
  );
}

export async function setDefaultCustomerAddress(addressId: number, session: CustomerSession) {
  return request<CustomerAddress>(
    `/customers/me/addresses/${addressId}/default`,
    { method: "PUT" },
    session.accessToken,
  );
}

export async function deleteCustomerAddress(addressId: number, session: CustomerSession) {
  return request<void>(
    `/customers/me/addresses/${addressId}`,
    { method: "DELETE" },
    session.accessToken,
  );
}

export async function submitCheckout(
  details: CheckoutDetails,
  session?: CustomerSession | null,
  guestSessionId?: string | null,
): Promise<CheckoutResult> {
  const paymentMethod =
    details.paymentMethod === "cash_on_delivery"
      ? "cod"
      : details.paymentMethod === "instapay"
        ? "mobile_wallet"
        : "credit_card";
  const result = await request<{ order: { name: string }; payment_gateway_url?: string | null }>(
    cartPath("/orders/checkout", guestSessionId ?? undefined, session),
    {
      method: "POST",
      body: JSON.stringify({
        customer_name: details.fullName,
        customer_email: details.email,
        customer_mobile: details.phone,
        shipping_address: `${details.fullName}\n${details.phone}\n${details.shippingAddress}`,
        shipping_governorate: details.governorate,
        payment_method: paymentMethod,
        use_loyalty_points: details.useLoyaltyPoints,
        notes: details.notes || null,
      }),
    },
    session?.accessToken,
  );
  return {
    orderNumber: result.order.name,
    paymentGatewayUrl: result.payment_gateway_url ?? undefined,
    isOfflineFallback: false,
  };
}

export async function submitRmaClaim(
  input: {
    orderId: number;
    productId: number;
    serialNumber?: string;
    reason: string;
    evidenceUrl?: string;
  },
  session: CustomerSession,
) {
  return request<{ ticket_number: string; status: string }>(
    "/warranty/claims",
    {
      method: "POST",
      body: JSON.stringify({
        order_id: input.orderId,
        product_id: input.productId,
        serial_number: input.serialNumber || null,
        reason: input.reason,
        evidence_media_url: input.evidenceUrl || null,
      }),
    },
    session.accessToken,
  );
}

export type RmaClaim = {
  ticket_number: string;
  order_id: number;
  product_id: number;
  status: string;
  reason: string;
  created_at: string;
};

export async function fetchRmaClaims(session: CustomerSession) {
  const result = await request<{ claims: RmaClaim[] }>(
    "/warranty/claims?limit=10",
    {},
    session.accessToken,
  );
  return result.claims;
}

export async function checkWarranty(serialNumber: string, session: CustomerSession) {
  return request<{
    serial_number: string;
    is_valid: boolean;
    warranty_expiration_date?: string | null;
    product_name?: string | null;
  }>(`/warranty/check/${encodeURIComponent(serialNumber)}`, {}, session.accessToken);
}

export async function submitRfq(
  input: { items: Array<{ product_id: number; quantity: number }>; notes?: string },
  session: CustomerSession,
) {
  return request<{ rfq_code: string; status: string }>(
    "/b2b/rfq",
    {
      method: "POST",
      body: JSON.stringify({ items: input.items, notes: input.notes || null }),
    },
    session.accessToken,
  );
}
