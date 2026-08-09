import { mergeGuestCart } from "@/lib/api";
import { refreshSession } from "@/lib/auth-api";
import { clearGuestCartSessionId, readGuestCartSessionId } from "@/lib/guest-cart";
import type { CustomerSession } from "@/types/store";

const AUTH_SESSION_KEY = "elitedom-auth-session";
const AUTH_CHANGED_EVENT = "elitedom:auth-changed";

function isSession(value: unknown): value is CustomerSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomerSession>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.userId === "number" &&
    typeof candidate.role === "string"
  );
}

export function readStoredSession(): CustomerSession | null {
  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSession(parsed)) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    if (parsed.expiresAt && parsed.expiresAt <= Date.now() + 15_000) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function saveSession(session: CustomerSession) {
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function clearStoredSession() {
  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export async function restoreSession(): Promise<CustomerSession | null> {
  const stored = readStoredSession();
  if (stored) return stored;
  try {
    const refreshed = await refreshSession();
    saveSession(refreshed);
    return refreshed;
  } catch {
    clearStoredSession();
    return null;
  }
}

export async function completeAuthentication(session: CustomerSession) {
  saveSession(session);
  const guestSessionId = readGuestCartSessionId();
  if (!guestSessionId) return session;

  try {
    await mergeGuestCart(session, guestSessionId);
    clearGuestCartSessionId();
    window.dispatchEvent(new CustomEvent("elitedom:cart-updated"));
  } catch {
    // Authentication stays valid even if a cart sync has to be retried later.
  }
  return session;
}

export function onAuthChanged(listener: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, listener);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, listener);
}
