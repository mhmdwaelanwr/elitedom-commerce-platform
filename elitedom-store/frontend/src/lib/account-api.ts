import { ApiError } from "@/lib/api";
import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

export type AccountOrder = {
  id: number;
  name: string;
  state: string;
  payment_status: string;
  amount_subtotal: string | number;
  amount_shipping: string | number;
  amount_tax: string | number;
  amount_total: string | number;
  currency: string;
  shipping_address: string;
  shipping_governorate?: string | null;
  created_at: string;
  order_lines: Array<{
    id: number;
    product_id: number;
    quantity: number;
    unit_price: string | number;
    line_total: string | number;
  }>;
};

export type LoyaltyBalance = {
  points_balance: number;
  redeemable_value_egp: string | number;
};

export type LoyaltyHistoryItem = {
  id: number;
  transaction_type: string;
  points: number;
  balance_after: number;
  reference?: string | null;
  description?: string | null;
  created_at: string;
};

async function authenticatedRequest<T>(path: string, session: CustomerSession): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${session.accessToken}` },
    });
  } catch {
    throw new ApiError("The Elitedom service is currently unreachable.", 0);
  }
  if (!response.ok) {
    let message = "We could not load your account data.";
    try {
      const payload = (await response.json()) as { detail?: string | { message?: string }; message?: string };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Keep the stable message for non-JSON responses.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export async function fetchCustomerOrders(session: CustomerSession, limit = 50) {
  return authenticatedRequest<{ orders: AccountOrder[]; total_count: number; page: number; limit: number }>(
    `/orders?limit=${limit}`,
    session,
  );
}

export async function fetchLoyaltyBalance(session: CustomerSession) {
  return authenticatedRequest<LoyaltyBalance>("/loyalty/balance", session);
}

export async function fetchLoyaltyHistory(session: CustomerSession, limit = 30) {
  return authenticatedRequest<{ transactions: LoyaltyHistoryItem[]; total_count: number; page: number; limit: number }>(
    `/loyalty/history?limit=${limit}`,
    session,
  );
}
