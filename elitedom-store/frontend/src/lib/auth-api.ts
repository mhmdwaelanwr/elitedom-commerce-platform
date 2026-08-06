import { ApiError } from "@/lib/api";
import type { CustomerSession } from "@/types/store";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

type AuthPayload = {
  access_token: string;
  expires_in: number;
  user_id: number;
  role: string;
  session_id: string;
  email: string;
  name: string;
};

export type OtpChallenge = {
  challengeId: string;
  expiresIn: number;
  resendAfter: number;
  delivery: "sms" | "debug";
  debugCode?: string;
};

export type AuthDeviceSession = {
  id: string;
  auth_method: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
  last_used_at?: string | null;
  current: boolean;
};

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The Elitedom service is currently unreachable.", 0);
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
      // Keep the generic message for non-JSON gateway responses.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function toCustomerSession(payload: AuthPayload): CustomerSession {
  return {
    accessToken: payload.access_token,
    userId: payload.user_id,
    role: payload.role,
    sessionId: payload.session_id,
    expiresAt: Date.now() + payload.expires_in * 1000,
    email: payload.email,
    name: payload.name,
  };
}

export async function passwordLogin(input: {
  email: string;
  password: string;
}): Promise<CustomerSession> {
  const result = await authRequest<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return toCustomerSession(result);
}

export async function requestPhoneOtp(input: {
  mobile: string;
  name?: string;
}): Promise<OtpChallenge> {
  const result = await authRequest<{
    challenge_id: string;
    expires_in: number;
    resend_after: number;
    delivery: "sms" | "debug";
    debug_code?: string | null;
  }>("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    challengeId: result.challenge_id,
    expiresIn: result.expires_in,
    resendAfter: result.resend_after,
    delivery: result.delivery,
    debugCode: result.debug_code ?? undefined,
  };
}

export async function verifyPhoneOtp(input: {
  challengeId: string;
  mobile: string;
  code: string;
}): Promise<CustomerSession> {
  const result = await authRequest<AuthPayload>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      challenge_id: input.challengeId,
      mobile: input.mobile,
      code: input.code,
    }),
  });
  return toCustomerSession(result);
}

export async function oauthLogin(
  provider: "google" | "apple",
  idToken: string,
): Promise<CustomerSession> {
  const result = await authRequest<AuthPayload>("/auth/oauth", {
    method: "POST",
    body: JSON.stringify({ provider, id_token: idToken }),
  });
  return toCustomerSession(result);
}

export async function refreshSession(): Promise<CustomerSession> {
  const result = await authRequest<AuthPayload>("/auth/refresh", { method: "POST" });
  return toCustomerSession(result);
}

export async function logoutSession(session: CustomerSession): Promise<void> {
  await authRequest<void>("/auth/logout", { method: "POST" }, session.accessToken);
}

export async function fetchAuthSessions(
  session: CustomerSession,
): Promise<AuthDeviceSession[]> {
  const result = await authRequest<{ sessions: AuthDeviceSession[] }>(
    "/auth/sessions",
    {},
    session.accessToken,
  );
  return result.sessions;
}

export async function revokeAuthSession(
  sessionId: string,
  session: CustomerSession,
): Promise<void> {
  await authRequest<void>(
    `/auth/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
    session.accessToken,
  );
}

export async function logoutAllSessions(
  session: CustomerSession,
): Promise<number> {
  const result = await authRequest<{ revoked_sessions: number }>(
    "/auth/logout-all",
    { method: "POST" },
    session.accessToken,
  );
  return result.revoked_sessions;
}
