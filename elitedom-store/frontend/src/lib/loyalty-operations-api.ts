import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

export type LoyaltyRedemption = {
  status: string;
  order_id: number;
  points_used: number;
  discount_applied: string | number;
  remaining_points_balance: number;
  order_total_egp: string | number;
};

export async function redeemPointsForOrder(orderId: number, points: number, session: CustomerSession): Promise<LoyaltyRedemption> {
  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}/loyalty/redeem`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ order_id: orderId, points_to_redeem: points }),
    });
  } catch {
    throw new Error("The Elitedom service is currently unreachable.");
  }
  if (!response.ok) {
    let message = "Loyalty points could not be redeemed.";
    try {
      const payload = await response.json() as { detail?: string | { message?: string }; message?: string };
      message = (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ?? payload.message ?? message;
    } catch {
      // Keep the stable fallback for non-JSON failures.
    }
    throw new Error(message);
  }
  return response.json() as Promise<LoyaltyRedemption>;
}
