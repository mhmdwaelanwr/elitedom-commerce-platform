import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

export type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
  children?: CatalogCategory[];
};

export type CatalogImage = {
  id: number;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type CatalogProduct = {
  id: number;
  name: string;
  sku: string;
  description?: string | null;
  tracking: "serial" | "barcode";
  base_cost_usd: string | number;
  target_margin_percent: string | number;
  list_price: string | number;
  category_id?: number | null;
  category?: CatalogCategory | null;
  brand?: string | null;
  is_dropship_enabled: boolean;
  is_active: boolean;
  stock_qty: number;
  weight_kg?: string | number | null;
  warranty_months: number;
  socket_type?: string | null;
  ram_type?: string | null;
  form_factor?: string | null;
  power_wattage_draw: number;
  pcie_gen?: string | null;
  images: CatalogImage[];
  created_at: string;
  updated_at?: string | null;
};

export type CatalogProductListItem = {
  id: number;
  name: string;
  sku: string;
  brand?: string | null;
  category_name?: string | null;
  list_price: string | number;
  stock_qty: number;
  tracking: string;
  is_active: boolean;
  is_dropship_enabled: boolean;
  stock_health: string;
  updated_at?: string | null;
};

export type CatalogProductInput = {
  name: string;
  sku?: string;
  description?: string | null;
  tracking?: "serial" | "barcode";
  base_cost_usd?: number;
  target_margin_percent?: number;
  list_price?: number;
  category_id?: number | null;
  brand?: string | null;
  is_dropship_enabled?: boolean;
  is_active?: boolean;
  stock_qty?: number;
  weight_kg?: number | null;
  warranty_months?: number;
  socket_type?: string | null;
  ram_type?: string | null;
  form_factor?: string | null;
  power_wattage_draw?: number;
  pcie_gen?: string | null;
};

export class CatalogAdminError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CatalogAdminError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  session: CustomerSession,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/admin${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new CatalogAdminError("The catalogue service is unreachable.", 0);
  }
  if (!response.ok) {
    let message = "The catalogue operation failed.";
    try {
      const payload = (await response.json()) as { detail?: string | { message?: string }; message?: string };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Keep the stable message for proxy errors.
    }
    throw new CatalogAdminError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function resolveCatalogImage(url: string): string {
  return url.startsWith("/media/") ? `${API_ORIGIN}${url}` : url;
}

export function listCatalogProducts(
  session: CustomerSession,
  params: { page?: number; q?: string; active?: boolean } = {},
) {
  const query = new URLSearchParams({ page: String(params.page ?? 1), limit: "100" });
  if (params.q) query.set("q", params.q);
  if (params.active !== undefined) query.set("active", String(params.active));
  return request<{
    products: CatalogProductListItem[];
    total_count: number;
    page: number;
    limit: number;
  }>(`/products?${query}`, session);
}

export function getCatalogProduct(productId: number, session: CustomerSession) {
  return request<CatalogProduct>(`/products/${productId}`, session);
}

export function listCatalogCategories(session: CustomerSession) {
  return request<CatalogCategory[]>("/products/categories", session);
}

export function createCatalogProduct(input: CatalogProductInput, session: CustomerSession) {
  return request<CatalogProduct>("/products", session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCatalogProduct(
  productId: number,
  input: CatalogProductInput,
  session: CustomerSession,
) {
  return request<CatalogProduct>(`/products/${productId}`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function archiveCatalogProduct(productId: number, session: CustomerSession) {
  return request<void>(`/products/${productId}`, session, { method: "DELETE" });
}

export function uploadCatalogImage(
  productId: number,
  file: File,
  input: { altText?: string; isPrimary?: boolean },
  session: CustomerSession,
) {
  const body = new FormData();
  body.set("image", file);
  if (input.altText) body.set("alt_text", input.altText);
  body.set("is_primary", String(Boolean(input.isPrimary)));
  return request<CatalogImage>(`/products/${productId}/images`, session, {
    method: "POST",
    body,
  });
}

export function deleteCatalogImage(
  productId: number,
  imageId: number,
  session: CustomerSession,
) {
  return request<void>(`/products/${productId}/images/${imageId}`, session, {
    method: "DELETE",
  });
}

export function adjustCatalogStock(
  productId: number,
  input: { quantityDelta: number; reason: string },
  session: CustomerSession,
) {
  return request<{ stock_qty: number }>(`/products/${productId}/stock-adjustments`, session, {
    method: "POST",
    body: JSON.stringify({ quantity_delta: input.quantityDelta, reason: input.reason }),
  });
}
