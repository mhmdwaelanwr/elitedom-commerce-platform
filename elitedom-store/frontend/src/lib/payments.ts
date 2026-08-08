import { clientEnv } from "@/lib/env";

const API_BASE_URL = clientEnv.apiUrl;

export type PublicPaymentStatus = {
  order_number: string;
  payment_status: "pending" | "paid" | "failed" | "refund_requested" | "refunded";
  provider: string;
  provider_attempt_status: string;
};

export async function fetchPublicPaymentStatus(
  orderNumber: string,
  signal?: AbortSignal,
): Promise<PublicPaymentStatus> {
  const response = await fetch(
    `${API_BASE_URL}/payments/public/order/${encodeURIComponent(orderNumber)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error("Unable to confirm payment status.");
  }
  return response.json() as Promise<PublicPaymentStatus>;
}
