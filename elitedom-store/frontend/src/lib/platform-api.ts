import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;

export class PlatformApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
  }
}

export type SupplierRecord = {
  id: number;
  name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  lead_time_days: number;
  is_active: boolean;
  is_verified: boolean;
  performance_rating?: string | number | null;
  total_orders: number;
  defect_rate_percent: string | number;
  created_at: string;
};

export type PurchaseOrderRecord = {
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

export type ReportingDashboard = {
  generated_at: string;
  total_revenue: string | number;
  total_orders: number;
  paid_orders: number;
  active_customers: number;
  average_order_value: string | number;
  orders_by_state: Record<string, number>;
  revenue_series: Array<{ period: string; order_count: number; revenue: string | number }>;
  best_sellers: Array<{ product_id: number; sku: string; name: string; units_sold: number; revenue: string | number }>;
  low_stock_products: Array<{ product_id: number; sku: string; name: string; stock_qty: number; is_dropship_enabled: boolean }>;
  recent_orders: Array<{ order_id: number; order_number: string; state: string; payment_status: string; amount_total: string | number; created_at: string }>;
};

export type InventoryReport = {
  total_sku_count: number;
  total_units_on_hand: number;
  total_cost_value_usd: string | number;
  total_retail_value_egp: string | number;
  low_stock_products: ReportingDashboard["low_stock_products"];
};

export type SupplierReport = {
  suppliers: Array<{
    supplier_id: number;
    name: string;
    is_active: boolean;
    total_purchase_orders: number;
    received_purchase_orders: number;
    open_purchase_orders: number;
    performance_rating?: string | number | null;
    defect_rate_percent: string | number;
  }>;
};

export type RmaReport = {
  total_claims: number;
  claims_by_status: Record<string, number>;
  recent_claims: number;
};

export type PaymentTrail = {
  order_id: number;
  order_number: string;
  payment_status: string;
  payment_method: string;
  amount_total: string | number;
  currency: string;
  provider?: string | null;
  payment_attempt_id?: number | null;
  provider_attempt_status?: string | null;
  refund_id?: number | null;
  refund_status?: string | null;
  refund_amount_minor?: number | null;
};

export type WarrantyClaim = {
  id: number;
  ticket_number: string;
  partner_id: number;
  order_id: number;
  product_id: number;
  serial_number?: string | null;
  status: string;
  reason: string;
  evidence_media_url?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type WarrantyCheck = {
  serial_number: string;
  product_id: number;
  is_valid: boolean;
  warranty_expiration_date?: string | null;
};

export type RuntimeReadiness = {
  status: string;
  ready: boolean;
  dependencies?: Record<string, string>;
};

export type CatalogAdminCategory = {
  id: number;
  name: string;
  name_ar?: string | null;
  slug: string;
  description?: string | null;
  description_ar?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type CatalogAdminAttribute = {
  id: number;
  name: string;
  name_ar?: string | null;
  code: string;
  value_type?: string;
  unit?: string | null;
  is_filterable?: boolean;
  is_comparable?: boolean;
};

async function apiRequest<T>(path: string, session: CustomerSession, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new PlatformApiError("The platform API is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not complete that platform request.";
    try {
      const payload = await response.json() as { detail?: string | { message?: string }; message?: string };
      message = (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ?? payload.message ?? message;
    } catch {
      // Keep the stable fallback for non-JSON upstream responses.
    }
    throw new PlatformApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchSuppliers(session: CustomerSession) {
  return apiRequest<{ suppliers: SupplierRecord[]; total_count: number; page: number; limit: number }>("/suppliers?page=1&limit=100", session);
}

export function fetchPurchaseOrders(session: CustomerSession) {
  return apiRequest<{ purchase_orders: PurchaseOrderRecord[]; total_count: number; page: number; limit: number }>("/suppliers/purchase-orders?page=1&limit=100", session);
}

export function fetchReportingDashboard(session: CustomerSession, days = 30) {
  return apiRequest<ReportingDashboard>(`/reports/dashboard?days=${days}`, session);
}

export function fetchInventoryReport(session: CustomerSession, threshold = 5) {
  return apiRequest<InventoryReport>(`/reports/inventory?low_stock_threshold=${threshold}`, session);
}

export function fetchSupplierReport(session: CustomerSession) {
  return apiRequest<SupplierReport>("/reports/suppliers", session);
}

export function fetchRmaReport(session: CustomerSession, days = 90) {
  return apiRequest<RmaReport>(`/reports/rma?days=${days}`, session);
}

export function fetchPaymentTrail(orderId: number, session: CustomerSession) {
  return apiRequest<PaymentTrail>(`/payments/${orderId}`, session);
}

export function requestPaymentRefund(orderId: number, reason: string, session: CustomerSession) {
  const params = new URLSearchParams({ reason });
  return apiRequest<{ status: string; refund_status: string; refund_id: number; order_id: number; order_number: string }>(`/payments/${orderId}/refund?${params.toString()}`, session, { method: "POST" });
}

export function fetchWarrantyClaims(session: CustomerSession) {
  return apiRequest<{ claims: WarrantyClaim[]; total_count: number; page: number; limit: number }>("/warranty/claims?page=1&limit=100", session);
}

export function checkWarranty(serialNumber: string, session: CustomerSession) {
  return apiRequest<WarrantyCheck>(`/warranty/check/${encodeURIComponent(serialNumber)}`, session);
}

export function submitWarrantyClaim(input: {
  order_id: number;
  product_id: number;
  serial_number?: string;
  reason: string;
  evidence_media_url: string;
}, session: CustomerSession) {
  return apiRequest<WarrantyClaim>("/warranty/claims", session, { method: "POST", body: JSON.stringify(input) });
}

export function fetchCatalogAdminCategories(session: CustomerSession) {
  return apiRequest<CatalogAdminCategory[]>("/admin/catalog/categories", session);
}

export function fetchCatalogAdminAttributes(session: CustomerSession) {
  return apiRequest<CatalogAdminAttribute[]>("/admin/catalog/attributes", session);
}

export async function fetchRuntimeReadiness(): Promise<RuntimeReadiness | null> {
  const apiRoot = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  try {
    const response = await fetch(`${apiRoot}/health/ready`, { credentials: "omit" });
    if (!response.ok) return null;
    return await response.json() as RuntimeReadiness;
  } catch {
    return null;
  }
}

export function reportingExportUrl(kind: "csv" | "pdf") {
  return `${API_BASE_URL}/reports/sales/export${kind === "pdf" ? ".pdf" : ""}`;
}
