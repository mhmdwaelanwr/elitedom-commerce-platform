import type { CustomerSession } from "@/types/store";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export class AdminControlApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminControlApiError";
    this.status = status;
  }
}

export type AdminPaymentAttempt = {
  id: string;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  provider: string;
  payment_method: string;
  status: string;
  amount_minor: number;
  currency: string;
  provider_intention_id?: string | null;
  provider_transaction_id?: string | null;
  failure_code?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type AdminRefund = {
  id: string;
  order_id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  provider: string;
  amount_minor: number;
  currency: string;
  status: string;
  reason: string;
  provider_refund_id?: string | null;
  failure_code?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type AdminSupplier = {
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

export type AdminPurchaseOrder = {
  id: number;
  po_number: string;
  supplier_id: number;
  sale_order_id?: number | null;
  status: string;
  total_amount: string | number;
  currency: string;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  created_at: string;
};

export type AdminIntegrationStatus = {
  key: string;
  label: string;
  enabled: boolean;
  status: "ready" | "disabled" | "incomplete" | "unsupported";
  checks: Array<{ key: string; label: string; configured: boolean }>;
};

export type AdminIntegrationStatusResponse = {
  integrations: AdminIntegrationStatus[];
  runtime: {
    environment: string;
    debug: boolean;
    metrics_enabled: boolean;
    app_version: string;
    allowed_host_count: number;
    cors_origin_count: number;
    trusted_proxy_count: number;
    media_public_path: string;
  };
};

export type LaunchAcceptanceStatus = "pending" | "passed" | "failed" | "waived";
export type LaunchGateResult = "pass" | "warn" | "block";

export type AdminLaunchGate = {
  key: string;
  label: string;
  category: string;
  source: "configuration" | "operator";
  required: boolean;
  status: LaunchAcceptanceStatus | "automatic";
  result: LaunchGateResult;
  detail: string;
  evidence_ref?: string | null;
  notes?: string | null;
  verified_by?: number | null;
  verified_at?: string | null;
};

export type AdminLaunchReadinessResponse = {
  overall_status: "ready" | "conditional" | "blocked";
  blocker_count: number;
  warning_count: number;
  generated_at: string;
  gates: AdminLaunchGate[];
};

type Paginated<T, Key extends string> = {
  total_count: number;
  page: number;
  limit: number;
} & Record<Key, T[]>;

async function request<T>(
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
    throw new AdminControlApiError("The staff control-plane API is unreachable.", 0);
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
      // Keep the generic error for non-JSON upstream responses.
    }
    throw new AdminControlApiError(message, response.status);
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

export function fetchControlPayments(
  session: CustomerSession,
  params: { page?: number; q?: string; status?: string; provider?: string } = {},
) {
  return request<Paginated<AdminPaymentAttempt, "payments">>(
    `/payments${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function fetchControlRefunds(
  session: CustomerSession,
  params: { page?: number; q?: string; status?: string; provider?: string } = {},
) {
  return request<Paginated<AdminRefund, "refunds">>(
    `/refunds${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function requestControlRefund(
  orderId: number,
  reason: string,
  session: CustomerSession,
) {
  return request<{
    refund_id: string;
    order_id: number;
    order_number: string;
    provider: string;
    status: string;
    amount_minor: number;
    currency: string;
    created: boolean;
  }>(`/refunds/${orderId}`, session, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchControlSuppliers(
  session: CustomerSession,
  params: { page?: number; include_inactive?: boolean } = {},
) {
  return request<Paginated<AdminSupplier, "suppliers">>(
    `/suppliers${queryString({ page: 1, limit: 25, include_inactive: true, ...params })}`,
    session,
  );
}

export function fetchControlPurchaseOrders(
  session: CustomerSession,
  params: { page?: number; supplier_id?: number; status?: string } = {},
) {
  return request<Paginated<AdminPurchaseOrder, "purchase_orders">>(
    `/purchase-orders${queryString({ page: 1, limit: 25, ...params })}`,
    session,
  );
}

export function fetchControlIntegrations(session: CustomerSession) {
  return request<AdminIntegrationStatusResponse>("/integrations", session);
}

export function fetchLaunchReadiness(session: CustomerSession) {
  return request<AdminLaunchReadinessResponse>("/launch-readiness", session);
}

export function updateLaunchGate(
  gateKey: string,
  payload: {
    status: LaunchAcceptanceStatus;
    evidence_ref?: string | null;
    notes?: string | null;
  },
  session: CustomerSession,
) {
  return request<AdminLaunchReadinessResponse>(
    `/launch-readiness/${encodeURIComponent(gateKey)}`,
    session,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
