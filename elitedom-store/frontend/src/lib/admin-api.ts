import type { CustomerSession } from "@/types/store";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export type AdminRole =
  | "system_admin"
  | "finance_officer"
  | "inventory_manager"
  | "warehouse_operator"
  | "customer_support";

export type AdminSection =
  | "dashboard"
  | "orders"
  | "products"
  | "customers"
  | "rma"
  | "rfqs"
  | "shipments";

export const ADMIN_SECTION_ROLES: Record<AdminSection, AdminRole[]> = {
  dashboard: [
    "system_admin",
    "finance_officer",
    "inventory_manager",
    "warehouse_operator",
    "customer_support",
  ],
  orders: ["system_admin", "finance_officer", "warehouse_operator", "customer_support"],
  products: ["system_admin", "inventory_manager", "warehouse_operator"],
  customers: ["system_admin", "finance_officer", "customer_support"],
  rma: ["system_admin", "customer_support"],
  rfqs: ["system_admin", "finance_officer"],
  shipments: ["system_admin", "warehouse_operator"],
};

export function isStaffRole(role: string | undefined | null): role is AdminRole {
  return Object.values(ADMIN_SECTION_ROLES).some((roles) =>
    roles.includes(role as AdminRole),
  );
}

export function canAccessAdminSection(
  role: string | undefined | null,
  section: AdminSection,
) {
  return Boolean(role && ADMIN_SECTION_ROLES[section].includes(role as AdminRole));
}

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export type AdminOrder = {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  state: string;
  payment_method: string;
  payment_status: string;
  amount_total: string | number;
  shipping_governorate?: string | null;
  is_dropship: boolean;
  created_at: string;
};

export type AdminOrderDetail = AdminOrder & {
  amount_subtotal: string | number;
  amount_shipping: string | number;
  amount_tax: string | number;
  shipping_address: string;
  notes?: string | null;
  odoo_order_id?: number | null;
  order_lines: Array<{
    id: number;
    product_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: string | number;
    discount_percent: string | number;
    line_total: string | number;
  }>;
};

export type AdminProduct = {
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

export type AdminCustomer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  governorate?: string | null;
  created_at: string;
  order_count: number;
  lifetime_value: string | number;
};

export type AdminCustomerDetail = AdminCustomer & {
  street_address?: string | null;
  last_order_at?: string | null;
};

export type AdminRma = {
  ticket_number: string;
  status: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  order_id: number;
  order_number: string;
  product_id: number;
  product_name: string;
  sku: string;
  serial_number?: string | null;
  reason: string;
  evidence_media_url?: string | null;
  resolution_notes?: string | null;
  resolved_by?: number | null;
  created_at: string;
  updated_at?: string | null;
};

export type AdminRfq = {
  id: number;
  rfq_code: string;
  status: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  item_count: number;
  total_estimated_value?: string | number | null;
  validity_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AdminShipment = {
  id: number;
  picking_reference: string;
  picking_type: string;
  state: string;
  order_id?: number | null;
  order_number?: string | null;
  order_state?: string | null;
  customer_name?: string | null;
  tracking_number?: string | null;
  supplier_po_ref?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  created_at: string;
};

export type AdminDispatchResult = {
  order_id: number;
  order_number: string;
  order_state: string;
  picking_id: number;
  picking_reference: string;
  picking_type: string;
  picking_state: string;
  tracking_number: string;
  dispatched_at: string;
};

export type AdminRfqQuoteResult = {
  rfq_code: string;
  status: string;
  validity_date?: string | null;
  total_estimated_value?: string | number | null;
};

export type AdminDashboard = {
  metrics: {
    total_customers: number;
    total_orders: number;
    orders_today: number;
    paid_revenue: string | number;
    paid_revenue_today: string | number;
    pending_orders: number;
    pending_shipments: number;
    low_stock_products: number;
    pending_rma_claims: number;
    active_rfqs: number;
  };
  revenue_trend: Array<{ date: string; orders: number; paid_revenue: string | number }>;
  recent_orders: AdminOrder[];
  low_stock: AdminProduct[];
};

type Paginated<T, Key extends string> = {
  total_count: number;
  page: number;
  limit: number;
} & Record<Key, T[]>;

async function adminRequest<T>(
  path: string,
  session: CustomerSession,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/admin${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new AdminApiError("The staff API is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not complete that administrative request.";
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
      // Preserve a consistent UI error for non-JSON upstream responses.
    }
    throw new AdminApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function fetchAdminDashboard(session: CustomerSession) {
  return adminRequest<AdminDashboard>("/dashboard", session);
}

export function fetchAdminOrders(
  session: CustomerSession,
  params: { page?: number; q?: string; state?: string; payment_status?: string } = {},
) {
  return adminRequest<Paginated<AdminOrder, "orders">>(
    `/orders${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function fetchAdminOrder(orderId: number, session: CustomerSession) {
  return adminRequest<AdminOrderDetail>(`/orders/${orderId}`, session);
}

export function updateAdminOrderState(
  orderId: number,
  state: string,
  session: CustomerSession,
) {
  return adminRequest<AdminOrderDetail>(`/orders/${orderId}/state`, session, {
    method: "PUT",
    body: JSON.stringify({ state }),
  });
}

export function fetchAdminProducts(
  session: CustomerSession,
  params: { page?: number; q?: string; low_stock?: boolean; active?: boolean } = {},
) {
  return adminRequest<Paginated<AdminProduct, "products">>(
    `/products${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function adjustAdminProductStock(
  productId: number,
  input: { quantity_delta: number; reason: string },
  session: CustomerSession,
) {
  return adminRequest<{
    product_id: number;
    sku: string;
    previous_stock_qty: number;
    quantity_delta: number;
    stock_qty: number;
  }>(`/products/${productId}/stock-adjustments`, session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAdminCustomers(
  session: CustomerSession,
  params: { page?: number; q?: string; active?: boolean } = {},
) {
  return adminRequest<Paginated<AdminCustomer, "customers">>(
    `/customers${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function fetchAdminCustomer(customerId: number, session: CustomerSession) {
  return adminRequest<AdminCustomerDetail>(`/customers/${customerId}`, session);
}

export function fetchAdminRmas(
  session: CustomerSession,
  params: { page?: number; q?: string; status?: string } = {},
) {
  return adminRequest<Paginated<AdminRma, "claims">>(
    `/rma${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function reviewAdminRma(
  ticketNumber: string,
  input: { status: "approved" | "rejected" | "completed"; resolution_notes?: string },
  session: CustomerSession,
) {
  return adminRequest<AdminRma>(`/rma/${encodeURIComponent(ticketNumber)}/review`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchAdminRfqs(
  session: CustomerSession,
  params: { page?: number; q?: string; status?: string } = {},
) {
  return adminRequest<Paginated<AdminRfq, "rfqs">>(
    `/rfqs${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function issueAdminRfqQuote(
  rfqCode: string,
  input: { validity_date: string; terms?: string },
  session: CustomerSession,
) {
  return adminRequest<AdminRfqQuoteResult>(`/rfqs/${encodeURIComponent(rfqCode)}/quote`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchAdminShipments(
  session: CustomerSession,
  params: { page?: number; q?: string; state?: string } = {},
) {
  return adminRequest<Paginated<AdminShipment, "shipments">>(
    `/shipments${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function dispatchAdminOrder(
  orderId: number,
  input: { tracking_number: string; reference?: string; scheduled_date?: string },
  session: CustomerSession,
) {
  return adminRequest<AdminDispatchResult>(`/shipments/${orderId}/dispatch`, session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
