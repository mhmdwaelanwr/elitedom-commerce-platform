import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;

export class OperationsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OperationsApiError";
    this.status = status;
  }
}

export type StockLevel = {
  sku: string;
  stock_qty: number;
  tracking: string;
  is_available: boolean;
  is_dropship: boolean;
};

export type BarcodeScan = {
  barcode: string;
  sku: string;
  name: string;
  stock_qty: number;
  list_price: number;
  warehouse_location?: string | null;
};

export type SerialLookup = {
  serial_number: string;
  product_name: string;
  sku: string;
  warranty_expiration_date?: string | null;
  is_warranty_active: boolean;
};

export type StockAdjustment = {
  sku: string;
  previous_stock_qty: number;
  quantity_delta: number;
  stock_qty: number;
};

export type Supplier = {
  id: number;
  name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  lead_time_days: number;
  is_active: boolean;
  is_verified: boolean;
  performance_rating?: string | number | null;
  total_orders: number;
  defect_rate_percent: string | number;
  created_at: string;
};

export type SupplierInput = {
  name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  lead_time_days?: number;
  is_verified?: boolean;
  performance_rating?: number | null;
  defect_rate_percent?: number;
};

export type PurchaseOrder = {
  id: number;
  po_number: string;
  supplier_id: number;
  sale_order_id?: number | null;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  items_payload: Record<string, unknown>;
  total_amount: string | number;
  currency: string;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  created_at: string;
};

export type ProductSupplierLink = {
  id: number;
  product_id: number;
  supplier_id: number;
  supplier_sku: string;
  unit_cost_usd: string | number;
  lead_time_days?: number | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
};

export type SupplierPerformance = {
  supplier: Supplier;
  total_purchase_orders: number;
  received_purchase_orders: number;
  open_purchase_orders: number;
  on_time_deliveries: number;
  on_time_delivery_rate_percent?: string | number | null;
  average_delivery_days?: string | number | null;
  defect_rate_percent: string | number;
};

export type CatalogContent = {
  product_id: number;
  slug: string;
  name: string;
  name_ar?: string | null;
  short_description?: string | null;
  short_description_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  seo_title?: string | null;
  seo_title_ar?: string | null;
  seo_description?: string | null;
  seo_description_ar?: string | null;
  publication_status: "draft" | "published" | "archived";
  is_featured: boolean;
  published_at?: string | null;
};

export type CatalogCategoryAdmin = {
  id: number;
  name: string;
  name_ar?: string | null;
  slug: string;
  parent_id?: number | null;
  description?: string | null;
  description_ar?: string | null;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
};

export type CatalogAttributeDefinition = {
  id: number;
  code: string;
  name: string;
  name_ar?: string | null;
  data_type: "text" | "number" | "boolean";
  unit?: string | null;
  unit_ar?: string | null;
  is_filterable: boolean;
  is_active: boolean;
  sort_order: number;
};

export type ShippingTracking = {
  order_id: number;
  order_number: string;
  tracking_number?: string | null;
  status: string;
  fulfillment_status: string;
  carrier?: string | null;
  picking_reference?: string | null;
  picking_state?: string | null;
  scheduled_date?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  shipments: Array<{
    id: number;
    fulfillment_leg: string;
    status: string;
    carrier?: string | null;
    tracking_number?: string | null;
    external_reference?: string | null;
    scheduled_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
  }>;
};

async function request<T>(path: string, session: CustomerSession, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new OperationsApiError("The Elitedom service is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not complete that operation.";
    try {
      const payload = await response.json() as { detail?: string | { message?: string }; message?: string };
      message = (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ?? payload.message ?? message;
    } catch {
      // Preserve the stable message for non-JSON gateway failures.
    }
    throw new OperationsApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchStockLevel(sku: string, session: CustomerSession) {
  return request<StockLevel>(`/inventory/${encodeURIComponent(sku)}`, session);
}

export function scanInventoryBarcode(barcode: string, session: CustomerSession) {
  return request<BarcodeScan>(`/inventory/scan?barcode=${encodeURIComponent(barcode)}`, session);
}

export function lookupInventorySerial(serial: string, session: CustomerSession) {
  return request<SerialLookup>(`/inventory/serial/${encodeURIComponent(serial)}`, session);
}

export function adjustInventoryStock(input: { sku: string; quantity_delta: number; reason: string }, session: CustomerSession) {
  return request<StockAdjustment>("/inventory/adjust", session, { method: "POST", body: JSON.stringify(input) });
}

export function listSuppliers(session: CustomerSession) {
  return request<{ suppliers: Supplier[]; total_count: number; page: number; limit: number }>("/suppliers?page=1&limit=100&include_inactive=true", session);
}

export function createSupplier(input: SupplierInput, session: CustomerSession) {
  return request<Supplier>("/suppliers", session, { method: "POST", body: JSON.stringify(input) });
}

export function updateSupplier(supplierId: number, input: Partial<SupplierInput> & { is_active?: boolean }, session: CustomerSession) {
  return request<Supplier>(`/suppliers/${supplierId}`, session, { method: "PUT", body: JSON.stringify(input) });
}

export function listPurchaseOrders(session: CustomerSession) {
  return request<{ purchase_orders: PurchaseOrder[]; total_count: number; page: number; limit: number }>("/suppliers/purchase-orders?page=1&limit=100", session);
}

export function createPurchaseOrder(input: {
  supplier_id: number;
  items: Array<{ product_id: number; quantity: number; unit_cost?: number | null }>;
  currency?: string;
  expected_delivery_date?: string | null;
  sale_order_id?: number | null;
}, session: CustomerSession) {
  return request<PurchaseOrder>("/suppliers/purchase-orders", session, { method: "POST", body: JSON.stringify(input) });
}

export function updatePurchaseOrder(poNumber: string, input: { status: PurchaseOrder["status"]; actual_delivery_date?: string | null }, session: CustomerSession) {
  return request<PurchaseOrder>(`/suppliers/purchase-orders/${encodeURIComponent(poNumber)}`, session, { method: "PATCH", body: JSON.stringify(input) });
}

export function listProductSupplierLinks(productId: number, session: CustomerSession) {
  return request<{ product_suppliers: ProductSupplierLink[] }>(`/suppliers/products/${productId}/supplier-links`, session);
}

export function upsertProductSupplierLink(supplierId: number, productId: number, input: {
  supplier_sku: string;
  unit_cost_usd: number;
  lead_time_days?: number | null;
  is_primary?: boolean;
  is_active?: boolean;
}, session: CustomerSession) {
  return request<ProductSupplierLink>(`/suppliers/${supplierId}/products/${productId}`, session, { method: "PUT", body: JSON.stringify(input) });
}

export function fetchSupplierPerformance(supplierId: number, session: CustomerSession) {
  return request<SupplierPerformance>(`/suppliers/${supplierId}/performance`, session);
}

export function fetchCatalogContent(productId: number, session: CustomerSession) {
  return request<CatalogContent>(`/admin/catalog/products/${productId}/content`, session);
}

export function updateCatalogContent(productId: number, input: Partial<Omit<CatalogContent, "product_id" | "published_at">>, session: CustomerSession) {
  return request<CatalogContent>(`/admin/catalog/products/${productId}/content`, session, { method: "PUT", body: JSON.stringify(input) });
}

export function listCatalogAdminCategories(session: CustomerSession) {
  return request<CatalogCategoryAdmin[]>("/admin/catalog/categories", session);
}

export function createCatalogAdminCategory(input: Omit<CatalogCategoryAdmin, "id">, session: CustomerSession) {
  return request<CatalogCategoryAdmin>("/admin/catalog/categories", session, { method: "POST", body: JSON.stringify(input) });
}

export function updateCatalogAdminCategory(categoryId: number, input: Omit<CatalogCategoryAdmin, "id">, session: CustomerSession) {
  return request<CatalogCategoryAdmin>(`/admin/catalog/categories/${categoryId}`, session, { method: "PUT", body: JSON.stringify(input) });
}

export function listCatalogAttributeDefinitions(session: CustomerSession) {
  return request<CatalogAttributeDefinition[]>("/admin/catalog/attributes", session);
}

export function createCatalogAttributeDefinition(input: Omit<CatalogAttributeDefinition, "id">, session: CustomerSession) {
  return request<CatalogAttributeDefinition>("/admin/catalog/attributes", session, { method: "POST", body: JSON.stringify(input) });
}

export function updateCatalogAttributeDefinition(attributeId: number, input: Omit<CatalogAttributeDefinition, "id">, session: CustomerSession) {
  return request<CatalogAttributeDefinition>(`/admin/catalog/attributes/${attributeId}`, session, { method: "PUT", body: JSON.stringify(input) });
}

export function uploadCatalogMedia(productId: number, file: File, input: { alt_text?: string; caption?: string; caption_ar?: string; is_primary?: boolean }, session: CustomerSession) {
  const body = new FormData();
  body.set("image", file);
  if (input.alt_text) body.set("alt_text", input.alt_text);
  if (input.caption) body.set("caption", input.caption);
  if (input.caption_ar) body.set("caption_ar", input.caption_ar);
  body.set("is_primary", String(Boolean(input.is_primary)));
  return request<{ id: number; url: string; alt_text?: string | null; sort_order: number; is_primary: boolean }>(`/admin/catalog/products/${productId}/media`, session, { method: "POST", body });
}

export function deleteCatalogMedia(productId: number, imageId: number, session: CustomerSession) {
  return request<void>(`/admin/catalog/products/${productId}/media/${imageId}`, session, { method: "DELETE" });
}

export function updateDropshipShipment(orderId: number, input: {
  purchase_order_number: string;
  status: "shipped" | "delivered" | "exception";
  tracking_number?: string | null;
  carrier?: string | null;
  occurred_at?: string | null;
}, session: CustomerSession) {
  return request<ShippingTracking>(`/shipping/${orderId}/dropship`, session, { method: "POST", body: JSON.stringify(input) });
}

export function markOrderDelivered(orderId: number, session: CustomerSession) {
  return request<ShippingTracking>(`/shipping/${orderId}/deliver`, session, { method: "POST" });
}

export async function downloadSalesExport(kind: "csv" | "pdf", session: CustomerSession) {
  const suffix = kind === "pdf" ? ".pdf" : "";
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/reports/sales/export${suffix}`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: kind === "pdf" ? "application/pdf" : "text/csv" },
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new OperationsApiError("The report export service is unreachable.", 0);
  }
  if (!response.ok) throw new OperationsApiError("The report export could not be generated.", response.status);
  return {
    blob: await response.blob(),
    filename: kind === "pdf" ? "elitedom-sales-report.pdf" : "elitedom-sales-report.csv",
  };
}

export function redeemLoyaltyPoints(input: { order_id: number; points: number }, session: CustomerSession) {
  return request<{
    order_id: number;
    points_redeemed: number;
    discount_egp: string | number;
    remaining_points: number;
  }>("/loyalty/redeem", session, { method: "POST", body: JSON.stringify(input) });
}
