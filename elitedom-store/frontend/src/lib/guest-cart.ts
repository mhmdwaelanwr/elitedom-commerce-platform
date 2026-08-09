const GUEST_CART_KEY = "elitedom-guest-cart-session";

export function readGuestCartSessionId() {
  return window.localStorage.getItem(GUEST_CART_KEY) || undefined;
}

export function getGuestCartSessionId() {
  const existing = readGuestCartSessionId();
  if (existing) return existing;

  const sessionId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(GUEST_CART_KEY, sessionId);
  return sessionId;
}

export function clearGuestCartSessionId() {
  window.localStorage.removeItem(GUEST_CART_KEY);
}
