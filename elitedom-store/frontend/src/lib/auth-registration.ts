import { ApiError } from "@/lib/api";
import { clientEnv } from "@/lib/env";

export async function registerAccount(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}/auth/register`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("The Elitedom service is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not create your account.";
    try {
      const payload = (await response.json()) as { detail?: string | { message?: string }; message?: string };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Keep a stable message for non-JSON gateway responses.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<{ status: string; message: string; user_id: number }>;
}
