import { ApiError } from "@/lib/api";
import { clientEnv } from "@/lib/env";
import type { CheckoutDetails, CheckoutResult, CustomerSession } from "@/types/store";

type CheckoutApiResponse = {
  order: {
    id: number;
    name: string;
  };
  payment_gateway_url?: string | null;
};

function checkoutPath(guestSessionId: string | null | undefined, session?: CustomerSession | null) {
  if (session) return "/orders/checkout";
  const normalized = (guestSessionId ?? "").trim();
  return normalized
    ? `/orders/checkout?session_id=${encodeURIComponent(normalized)}`
    : "/orders/checkout";
}

export async function submitRoutedCheckout(
  details: CheckoutDetails,
  session?: CustomerSession | null,
  guestSessionId?: string | null,
): Promise<CheckoutResult & { orderId: number }> {
  const paymentMethod =
    details.paymentMethod === "cash_on_delivery"
      ? "cod"
      : details.paymentMethod === "instapay"
        ? "mobile_wallet"
        : "credit_card";

  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}${checkoutPath(guestSessionId, session)}`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
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
    });
  } catch {
    throw new ApiError("The Elitedom checkout service is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not place this order.";
    try {
      const payload = await response.json() as {
        detail?: string | { message?: string };
        message?: string;
      };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Keep the stable error for non-JSON gateway failures.
    }
    throw new ApiError(message, response.status);
  }

  const result = await response.json() as CheckoutApiResponse;
  if (!Number.isInteger(result.order?.id) || result.order.id < 1 || !result.order.name) {
    throw new ApiError("Checkout completed without a valid order identity.", 502);
  }

  return {
    orderId: result.order.id,
    orderNumber: result.order.name,
    paymentGatewayUrl: result.payment_gateway_url ?? undefined,
    isOfflineFallback: false,
  };
}
