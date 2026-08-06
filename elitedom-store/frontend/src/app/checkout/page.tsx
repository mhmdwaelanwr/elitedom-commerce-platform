"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  ApiError,
  fetchCustomerAddresses,
  submitCheckout,
  type CustomerAddress,
} from "@/lib/api";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { CheckoutDetails, CheckoutResult, Currency } from "@/types/store";

export default function CheckoutPage() {
  const { locale, t } = usePreferences();
  const { cart, clearCart, currency, guestSessionId, notify, session } = useStore();
  const [form, setForm] = useState<CheckoutDetails>({
    fullName: "",
    email: "",
    phone: "+20",
    shippingAddress: "",
    governorate: "Cairo",
    paymentMethod: "cash_on_delivery",
    notes: "",
    useLoyaltyPoints: false,
  });
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const totals = useMemo(() => getCheckoutTotals(cart, form.governorate), [cart, form.governorate]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchCustomerAddresses(session)
      .then((addresses) => {
        if (active) setSavedAddresses(addresses);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session]);

  function update<K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectSavedAddress(addressId: string) {
    const address = savedAddresses.find((item) => item.id === Number(addressId));
    if (!address) return;
    setForm((current) => ({
      ...current,
      fullName: address.recipient_name,
      email: current.email || session?.email || "",
      phone: address.recipient_phone,
      shippingAddress: [
        address.street_address,
        address.address_line_2,
        address.city,
        address.country,
      ].filter(Boolean).join(", "),
      governorate: address.governorate,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (cart.length === 0) {
      setError(t("checkout", "cartEmptyError"));
      return;
    }
    if (!session && !guestSessionId) {
      setError(t("checkout", "guestPreparingError"));
      return;
    }

    setSubmitting(true);
    try {
      const nextResult = await submitCheckout(form, session, guestSessionId);
      clearCart();
      setResult(nextResult);
      notify(`${nextResult.orderNumber}: ${t("checkout", "orderCreatedNotice")}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("checkout", "orderError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <CheckoutSuccess hasAccount={Boolean(session)} result={result} />;
  }

  if (cart.length === 0) {
    return (
      <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-3xl text-primary">✓</div>
          <h1 className="mt-4 text-3xl font-black text-foreground">{t("checkout", "emptyCartTitle")}</h1>
          <p className="mt-3 text-sm text-muted">{t("checkout", "emptyCartText")}</p>
          <Link className="button-primary mt-6" href="/shop">
            {t("checkout", "browseProducts")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">
          {t("storefront", "home")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="focus-ring rounded-md hover:text-foreground" href="/cart">
          {t("storefront", "cart")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("checkout", "title")}</span>
      </nav>

      <div className="mt-6">
        <p className="section-kicker">{t("checkout", "eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{t("checkout", "pageTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("checkout", "description")}</p>
      </div>

      <CheckoutSteps />

      {!session && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
          <span>{t("checkout", "guestCheckout")}</span>
          <Link className="button-secondary px-4 py-2" href="/signin?next=/checkout">
            {t("checkout", "signIn")}
          </Link>
        </div>
      )}

      <form className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
          <h2 className="text-xl font-black text-foreground">{t("checkout", "shippingDetails")}</h2>

          {session && savedAddresses.length > 0 && (
            <Field label={t("checkout", "useSavedAddress")}>
              <select className="form-input" defaultValue="" onChange={(event) => selectSavedAddress(event.target.value)}>
                <option disabled value="">{t("checkout", "selectAddress")}</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label}{address.is_default ? ` (${t("checkout", "defaultAddress")})` : ""} · {address.city}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label={t("checkout", "fullName")}>
              <input
                autoComplete="name"
                className="form-input"
                onChange={(event) => update("fullName", event.target.value)}
                required
                value={form.fullName}
              />
            </Field>
            <Field label={t("checkout", "email")}>
              <input
                autoComplete="email"
                className="form-input"
                onChange={(event) => update("email", event.target.value)}
                required
                type="email"
                value={form.email}
              />
            </Field>
            <Field label={t("checkout", "mobileNumber")}>
              <input
                autoComplete="tel"
                className="form-input"
                onChange={(event) => update("phone", event.target.value)}
                required
                type="tel"
                value={form.phone}
              />
            </Field>
            <Field label={t("checkout", "governorate")}>
              <select
                className="form-input"
                onChange={(event) => update("governorate", event.target.value)}
                value={form.governorate}
              >
                {GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}
              </select>
            </Field>
          </div>

          <Field label={t("checkout", "fullDeliveryAddress")}>
            <textarea
              autoComplete="street-address"
              className="form-input min-h-28 resize-y"
              onChange={(event) => update("shippingAddress", event.target.value)}
              placeholder={t("checkout", "addressPlaceholder")}
              required
              value={form.shippingAddress}
            />
          </Field>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-foreground">{t("checkout", "paymentMethod")}</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <PaymentOption
                checked={form.paymentMethod === "credit_card"}
                label={t("checkout", "cardPayment")}
                onChange={() => update("paymentMethod", "credit_card")}
                value="💳"
              />
              <PaymentOption
                checked={form.paymentMethod === "instapay"}
                label={t("checkout", "walletPayment")}
                onChange={() => update("paymentMethod", "instapay")}
                value="📱"
              />
              <PaymentOption
                checked={form.paymentMethod === "cash_on_delivery"}
                label={t("checkout", "cashOnDelivery")}
                onChange={() => update("paymentMethod", "cash_on_delivery")}
                value="💵"
              />
            </div>
          </fieldset>

          <Field label={t("checkout", "orderNotes")}>
            <textarea
              className="form-input min-h-24 resize-y"
              onChange={(event) => update("notes", event.target.value)}
              placeholder={t("checkout", "notesPlaceholder")}
              value={form.notes}
            />
          </Field>

          {session && (
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-elevated p-4 text-sm text-muted">
              <input
                checked={form.useLoyaltyPoints}
                className="mt-0.5 h-4 w-4 accent-primary"
                onChange={(event) => update("useLoyaltyPoints", event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong className="text-foreground">{t("checkout", "loyaltyTitle")}</strong>
                <br />
                <span className="text-xs leading-5">{t("checkout", "loyaltyText")}</span>
              </span>
            </label>
          )}

          {error && (
            <p className="mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </section>

        <OrderSummary
          currency={currency}
          isSubmitting={isSubmitting}
          locale={locale}
          totals={totals}
        />
      </form>
    </div>
  );
}

function CheckoutSteps() {
  const { t } = usePreferences();
  const steps = [
    t("checkout", "deliveryAddress"),
    t("checkout", "paymentMethod"),
    t("checkout", "placeOrder"),
  ];
  return (
    <ol className="mt-6 grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground" key={step}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-contrast">
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function PaymentOption({
  checked,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <label className={`cursor-pointer rounded-xl border p-4 transition ${checked ? "border-primary bg-primary/10" : "border-border bg-elevated hover:border-primary"}`}>
      <input checked={checked} className="sr-only" name="payment-method" onChange={onChange} type="radio" />
      <span className="text-xl" aria-hidden="true">{value}</span>
      <span className="mt-2 block text-sm font-bold text-foreground">{label}</span>
    </label>
  );
}

function OrderSummary({
  currency,
  isSubmitting,
  locale,
  totals,
}: {
  currency: Currency;
  isSubmitting: boolean;
  locale: "en" | "ar";
  totals: ReturnType<typeof getCheckoutTotals>;
}) {
  const { t } = usePreferences();
  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-28">
      <h2 className="text-lg font-black text-foreground">{t("checkout", "orderSummary")}</h2>
      <dl className="mt-5 grid gap-3 text-sm">
        <SummaryRow label={t("checkout", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
        <SummaryRow label={t("checkout", "delivery")} value={formatPrice(totals.shipping, currency, locale)} />
        <SummaryRow label={t("checkout", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-4">
          <dt className="font-bold text-foreground">{t("checkout", "total")}</dt>
          <dd className="text-xl font-black text-primary">{formatPrice(totals.total, currency, locale)}</dd>
        </div>
      </dl>
      <button
        className="button-primary mt-6 flex w-full disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? t("checkout", "creatingOrder") : t("checkout", "confirmOrder")}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-muted">{t("checkout", "securityNote")}</p>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="mt-5 grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[55vh] place-items-center py-12">
      <section className="w-full max-w-xl rounded-3xl border border-success/25 bg-success/5 p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-3xl font-black text-primary-contrast">✓</div>
        <p className="section-kicker mt-6 text-success">{t("checkout", "orderCreated")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{t("checkout", "thankYou")}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          {t("checkout", "orderReference")} <strong className="font-mono text-foreground">{result.orderNumber}</strong>. {t("checkout", "orderUpdateText")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {result.paymentGatewayUrl && (
            <a className="button-primary" href={result.paymentGatewayUrl} rel="noreferrer" target="_blank">
              {t("checkout", "continuePayment")}
            </a>
          )}
          <Link className="button-secondary" href={hasAccount ? "/account" : "/signup"}>
            {hasAccount ? t("checkout", "viewAccount") : t("checkout", "createAccountHistory")}
          </Link>
        </div>
        <Link className="focus-ring mt-6 block rounded-md text-sm font-bold text-primary hover:brightness-110" href="/shop">
          {t("checkout", "continueShopping")}
        </Link>
      </section>
    </div>
  );
}
