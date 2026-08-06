import type { Locale } from "@/config/preferences";
import {
  getMessage,
  type TranslationKey,
} from "@/locales";

const errorCodeTranslations: Record<string, TranslationKey<"errors">> = {
  NETWORK_ERROR: "network",
  UNAUTHORIZED: "unauthorized",
  AUTH_REQUIRED: "unauthorized",
  FORBIDDEN: "forbidden",
  PERMISSION_DENIED: "forbidden",
  NOT_FOUND: "notFound",
  VALIDATION_ERROR: "validation",
  RATE_LIMITED: "rateLimited",
  TOO_MANY_REQUESTS: "rateLimited",
  SERVER_ERROR: "server",
  PAYMENT_FAILED: "paymentFailed",
  OUT_OF_STOCK: "outOfStock",
};

export function getLocalizedErrorMessage(
  locale: Locale,
  errorCode: string | null | undefined,
): string {
  const normalizedCode = errorCode?.trim().toUpperCase() ?? "";
  const translationKey = errorCodeTranslations[normalizedCode] ?? "unknown";
  return getMessage(locale, "errors", translationKey);
}
