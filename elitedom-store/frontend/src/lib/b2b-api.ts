import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;

export type RfqStatus = "submitted" | "under_review" | "quoted" | "accepted" | "declined";

export type RfqProcurement = {
  title?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  needed_by?: string | null;
  delivery_location?: string | null;
  budget_target?: string | number | null;
  payment_terms?: string | null;
};

export type RfqItem = {
  product_id: number;
  quantity: number;
  product_name?: string | null;
  sku?: string | null;
  list_price?: string | number | null;
  quoted_unit_price?: string | number | null;
  discount_percent?: string | number | null;
  line_total?: string | number | null;
  pricing_source?: string | null;
};

export type B2BRfq = {
  id: number;
  rfq_code: string;
  partner_id: number;
  status: RfqStatus;
  items: RfqItem[];
  procurement?: RfqProcurement | null;
  validity_date?: string | null;
  total_estimated_value?: string | number | null;
  notes?: string | null;
  quote?: {
    terms?: string | null;
    currency: string;
    issued_at?: string | null;
    issued_by?: number | null;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type B2BRfqList = {
  rfqs: B2BRfq[];
  total_count: number;
  page: number;
  limit: number;
};

export type B2BConversion = {
  rfq_code: string;
  status: RfqStatus;
  order_id: number;
  order_number: string;
  idempotent: boolean;
  order: {
    id: number;
    name: string;
    state: string;
    payment_method: string;
    payment_status: string;
    amount_total: string | number;
    shipping_address: string;
    shipping_governorate?: string | null;
  };
};

export class B2BApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "B2BApiError";
    this.status = status;
  }
}

async function b2bRequest<T>(
  path: string,
  session: CustomerSession,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/b2b${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new B2BApiError("The Elitedom business service is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not complete that business request.";
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
      // Keep the stable fallback for non-JSON gateway responses.
    }
    throw new B2BApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function fetchRfqs(
  session: CustomerSession,
  input: { page?: number; status?: RfqStatus } = {},
) {
  return b2bRequest<B2BRfqList>(
    `/rfq${queryString({ page: input.page ?? 1, limit: 50, status: input.status })}`,
    session,
  );
}

export function fetchRfq(rfqCode: string, session: CustomerSession) {
  return b2bRequest<B2BRfq>(`/rfq/${encodeURIComponent(rfqCode)}`, session);
}

export function submitRfq(
  input: {
    items: Array<{ product_id: number; quantity: number }>;
    notes?: string;
    procurement: {
      title: string;
      needed_by?: string;
      delivery_location?: string;
      budget_target?: number;
      payment_terms?: string;
    };
  },
  session: CustomerSession,
) {
  return b2bRequest<B2BRfq>("/rfq", session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function convertRfq(
  rfqCode: string,
  input: {
    shipping_address?: string;
    shipping_governorate?: string;
    payment_method: "credit_card" | "mobile_wallet" | "cod";
    notes?: string;
  },
  idempotencyKey: string,
  session: CustomerSession,
) {
  return b2bRequest<B2BConversion>(`/rfq/${encodeURIComponent(rfqCode)}/convert`, session, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}
