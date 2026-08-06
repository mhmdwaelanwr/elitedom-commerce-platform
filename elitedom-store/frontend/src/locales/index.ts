import { account as arAccount } from "@/locales/ar/account";
import { admin as arAdmin } from "@/locales/ar/admin";
import { auth as arAuth } from "@/locales/ar/auth";
import { checkout as arCheckout } from "@/locales/ar/checkout";
import { common as arCommon } from "@/locales/ar/common";
import { errors as arErrors } from "@/locales/ar/errors";
import { storefront as arStorefront } from "@/locales/ar/storefront";
import { validation as arValidation } from "@/locales/ar/validation";
import { account as enAccount } from "@/locales/en/account";
import { admin as enAdmin } from "@/locales/en/admin";
import { auth as enAuth } from "@/locales/en/auth";
import { checkout as enCheckout } from "@/locales/en/checkout";
import { common as enCommon } from "@/locales/en/common";
import { errors as enErrors } from "@/locales/en/errors";
import { storefront as enStorefront } from "@/locales/en/storefront";
import { validation as enValidation } from "@/locales/en/validation";
import type { Locale } from "@/config/preferences";

const englishMessages = {
  common: enCommon,
  storefront: enStorefront,
  auth: enAuth,
  checkout: enCheckout,
  account: enAccount,
  admin: enAdmin,
  validation: enValidation,
  errors: enErrors,
} as const;

type EnglishMessages = typeof englishMessages;
type LocaleMessages = {
  [Domain in keyof EnglishMessages]: {
    [Key in keyof EnglishMessages[Domain]]: string;
  };
};

const arabicMessages: LocaleMessages = {
  common: arCommon,
  storefront: arStorefront,
  auth: arAuth,
  checkout: arCheckout,
  account: arAccount,
  admin: arAdmin,
  validation: arValidation,
  errors: arErrors,
};

export const messages: Record<Locale, LocaleMessages> = {
  en: englishMessages,
  ar: arabicMessages,
};

export type TranslationDomain = keyof EnglishMessages;
export type TranslationKey<Domain extends TranslationDomain> =
  keyof EnglishMessages[Domain] & string;

export function getMessage<Domain extends TranslationDomain>(
  locale: Locale,
  domain: Domain,
  key: TranslationKey<Domain>,
): string {
  return messages[locale][domain][key];
}
