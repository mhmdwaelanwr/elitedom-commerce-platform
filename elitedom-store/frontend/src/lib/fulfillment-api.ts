import type { CustomerSession } from "@/types/store";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export type OrderLine = {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: string | number;
  discount_percent: string | number;
  line_total: string | number;
};

export type AccountOrder = {
  id: number;
  name: string;
  state: string;
  payment_method: string;
  payment_status: string;
  amount_subtotal: string | number;
  amount_shipping: string | number;
  amount_tax: string | number;
  amount_total: string | number;
  currency: string;
  shipping_address: string;
  shipping_governorate?: string | null;
  is_dropship: boolean;
  notes?: string | null;
  created_at: string;
  order_lines: OrderLine[];
};

export type Shipment = {
  id: number;
  fulfillment_leg: string;
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  external_reference?: string | null;
  scheduled_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

export type OrderTracking = {
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
  shipments: Shipment[];
};

export class FulfillmentApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "FulfillmentApiError";
    this.status = status;
  }
}

async function authenticatedRequest<T>(
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
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new FulfillmentApiError("The Elitedom service is currently unreachable.", 0);
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
    throw new FulfillmentApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchAccountOrders(session: CustomerSession, limit = 50) {
  return authenticatedRequest<{
    orders: AccountOrder[];
    total_count: number;
    page: number;
    limit: number;
  }>(`/orders?limit=${limit}`, session);
}

export async function fetchAccountOrder(orderId: number, session: CustomerSession) {
  return authenticatedRequest<AccountOrder>(`/orders/${orderId}`, session);
}

export async function fetchOrderTracking(orderId: number, session: CustomerSession) {
  return authenticatedRequest<OrderTracking>(`/shipping/${orderId}/tracking`, session);
}

export async function cancelAccountOrder(
  orderId: number,
  session: CustomerSession,
  reason = "customer_request",
) {
  return authenticatedRequest<{
    order_id: number;
    order_number: string;
    order_state: string;
    fulfillment_status: string;
    payment_status: string;
    refund_id?: string | null;
    released_quantity: number;
    cancelled: boolean;
  }>(`/orders/${orderId}/cancel?reason=${encodeURIComponent(reason)}`, session, {
    method: "POST",
  });
}
