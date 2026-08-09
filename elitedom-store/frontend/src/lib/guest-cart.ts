const GUEST_CART_KEY = "elitedom-guest-cart-session";

export function getGuestCartSessionId() {
  const existing = window.localStorage.getItem(GUEST_CART_KEY);
  if (existing) return existing;

  const sessionId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(GUEST_CART_KEY, sessionId);
  return sessionId;
}
