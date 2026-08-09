import { ApiError } from "@/lib/api";
import { clientEnv } from "@/lib/env";
import type { CustomerSession } from "@/types/store";

export async function recoverPassword(newPassword: string, session: CustomerSession) {
  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}/auth/password/recovery`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ new_password: newPassword }),
    });
  } catch {
    throw new ApiError("The Elitedom service is currently unreachable.", 0);
  }

  if (!response.ok) {
    let message = "We could not update your password.";
    try {
      const payload = (await response.json()) as { detail?: string | { message?: string }; message?: string };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Preserve the stable fallback message.
    }
    throw new ApiError(message, response.status);
  }
}
