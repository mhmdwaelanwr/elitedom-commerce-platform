"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError, fetchCustomerAddresses, submitCheckout, type CustomerAddress } from "@/lib/api";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { CheckoutDetails, CheckoutResult, Currency } from "@/types/store";

const PAYMENT_ORDER_STORAGE_KEY = "elitedom:last-payment-order";

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
      shippingAddress: [address.street_address, address.address_line_2, address.city, address.country].filter(Boolean).join(", "),
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
      notify(`${nextResult.orderNumber}: ${t("checkout", "orderCreatedNotice")}`);

      if (nextResult.paymentGatewayUrl) {
        const paymentUrl = new URL(nextResult.paymentGatewayUrl);
        if (paymentUrl.protocol !== "https:") throw new ApiError(t("checkout", "orderError"));
        window.sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, nextResult.orderNumber);
        window.location.assign(paymentUrl.toString());
        return;
      }

      setResult(nextResult);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("checkout", "orderError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <CheckoutSuccess hasAccount={Boolean(session)} result={result} />;

  if (cart.length === 0) {
    return (
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--ds-success-soft)] text-success" aria-hidden="true"><CheckIcon /></span>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-foreground">{t("checkout", "emptyCartTitle")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("checkout", "emptyCartText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("checkout", "browseProducts")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted">
        <Link className="focus-ring rounded-full hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <span aria-hidden="true">/</span>
        <Link className="focus-ring rounded-full hover:text-foreground" href="/cart">{t("storefront", "cart")}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("checkout", "title")}</span>
      </nav>

      <div className="mt-6">
        <p className="text-sm font-bold text-primary">{t("checkout", "eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("checkout", "pageTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">{t("checkout", "description")}</p>
      </div>

      <CheckoutSteps />

      {!session ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--ds-primary-soft)] px-5 py-4 text-sm text-foreground">
          <span>{t("checkout", "guestCheckout")}</span>
          <Link className="focus-ring rounded-full px-4 py-2 font-bold text-primary hover:bg-surface" href="/signin?next=/checkout">{t("checkout", "signIn")}</Link>
        </div>
      ) : null}

      <form className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] xl:gap-14" onSubmit={handleSubmit}>
        <div className="min-w-0">
          <section className="border-b border-border pb-10">
            <StepHeading number="01" title={t("checkout", "shippingDetails")} />

            {session && savedAddresses.length > 0 ? (
              <Field label={t("checkout", "useSavedAddress")}>
                <select className="form-input" defaultValue="" onChange={(event) => selectSavedAddress(event.target.value)}>
                  <option disabled value="">{t("checkout", "selectAddress")}</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>{address.label}{address.is_default ? ` (${t("checkout", "defaultAddress")})` : ""} · {address.city}</option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="mt-6 grid gap-x-5 sm:grid-cols-2">
              <Field label={t("checkout", "fullName")}>
                <input autoComplete="name" className="form-input" onChange={(event) => update("fullName", event.target.value)} required value={form.fullName} />
              </Field>
              <Field label={t("checkout", "email")}>
                <input autoComplete="email" className="form-input" onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} />
              </Field>
              <Field label={t("checkout", "mobileNumber")}>
                <input autoComplete="tel" className="form-input" onChange={(event) => update("phone", event.target.value)} required type="tel" value={form.phone} />
              </Field>
              <Field label={t("checkout", "governorate")}>
                <select className="form-input" onChange={(event) => update("governorate", event.target.value)} value={form.governorate}>
                  {GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}
                </select>
              </Field>
            </div>

            <Field label={t("checkout", "fullDeliveryAddress")}>
              <textarea autoComplete="street-address" className="form-input min-h-28 resize-y" onChange={(event) => update("shippingAddress", event.target.value)} placeholder={t("checkout", "addressPlaceholder")} required value={form.shippingAddress} />
            </Field>
          </section>

          <section className="border-b border-border py-10">
            <StepHeading number="02" title={t("checkout", "paymentMethod")} />
            <fieldset className="mt-6">
              <legend className="sr-only">{t("checkout", "paymentMethod")}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <PaymentOption checked={form.paymentMethod === "credit_card"} icon="card" label={t("checkout", "cardPayment")} onChange={() => update("paymentMethod", "credit_card")} />
                <PaymentOption checked={form.paymentMethod === "instapay"} icon="mobile" label={t("checkout", "walletPayment")} onChange={() => update("paymentMethod", "instapay")} />
                <PaymentOption checked={form.paymentMethod === "cash_on_delivery"} icon="cash" label={t("checkout", "cashOnDelivery")} onChange={() => update("paymentMethod", "cash_on_delivery")} />
              </div>
            </fieldset>

            {session ? (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-elevated p-4 text-sm text-muted">
                <input checked={form.useLoyaltyPoints} className="mt-0.5 h-4 w-4 accent-primary" onChange={(event) => update("useLoyaltyPoints", event.target.checked)} type="checkbox" />
                <span><strong className="text-foreground">{t("checkout", "loyaltyTitle")}</strong><br /><span className="text-xs leading-5">{t("checkout", "loyaltyText")}</span></span>
              </label>
            ) : null}
          </section>

          <section className="pt-10">
            <StepHeading number="03" title={t("checkout", "placeOrder")} />
            <details className="mt-5 rounded-2xl bg-elevated px-5 py-4">
              <summary className="focus-ring cursor-pointer list-none text-sm font-bold text-foreground">{t("checkout", "orderNotes")}</summary>
              <textarea className="form-input mt-4 min-h-24 resize-y bg-surface" onChange={(event) => update("notes", event.target.value)} placeholder={t("checkout", "notesPlaceholder")} value={form.notes} />
            </details>

            {error ? <p className="mt-5 rounded-2xl bg-[var(--ds-danger-soft)] px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}
          </section>
        </div>

        <OrderSummary currency={currency} isSubmitting={isSubmitting} locale={locale} totals={totals} />
      </form>
    </main>
  );
}

function CheckoutSteps() {
  const { t } = usePreferences();
  const steps = [t("checkout", "deliveryAddress"), t("checkout", "paymentMethod"), t("checkout", "placeOrder")];
  return (
    <ol className="mt-8 flex items-center overflow-x-auto border-y border-border py-4 text-xs font-bold text-muted sm:text-sm">
      {steps.map((step, index) => (
        <li className="flex shrink-0 items-center" key={step}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-elevated text-foreground">{index + 1}</span>
          <span className="ms-2">{step}</span>
          {index < steps.length - 1 ? <span className="mx-4 h-px w-8 bg-border sm:w-14" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function StepHeading({ number, title }: { number: string; title: string }) {
  return <div className="flex items-baseline gap-3"><span className="text-xs font-bold text-primary">{number}</span><h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">{title}</h2></div>;
}

function PaymentOption({ checked, icon, label, onChange }: { checked: boolean; icon: "card" | "mobile" | "cash"; label: string; onChange: () => void }) {
  return (
    <label className={`cursor-pointer rounded-2xl p-5 transition ${checked ? "bg-[var(--ds-primary-soft)] ring-2 ring-primary" : "bg-elevated hover:ring-1 hover:ring-border"}`}>
      <input checked={checked} className="sr-only" name="payment-method" onChange={onChange} type="radio" />
      <span className={`grid h-10 w-10 place-items-center rounded-full ${checked ? "bg-primary text-primary-contrast" : "bg-surface text-muted"}`} aria-hidden="true"><PaymentIcon type={icon} /></span>
      <span className="mt-4 block text-sm font-bold text-foreground">{label}</span>
    </label>
  );
}

function OrderSummary({ currency, isSubmitting, locale, totals }: { currency: Currency; isSubmitting: boolean; locale: "en" | "ar"; totals: ReturnType<typeof getCheckoutTotals> }) {
  const { t } = usePreferences();
  return (
    <aside className="h-fit rounded-2xl bg-elevated p-6 lg:sticky lg:top-24">
      <h2 className="text-xl font-bold text-foreground">{t("checkout", "orderSummary")}</h2>
      <dl className="mt-6 grid gap-3 text-sm">
        <SummaryRow label={t("checkout", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
        <SummaryRow label={t("checkout", "delivery")} value={formatPrice(totals.shipping, currency, locale)} />
        <SummaryRow label={t("checkout", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-4">
          <dt className="font-bold text-foreground">{t("checkout", "total")}</dt>
          <dd className="text-xl font-bold text-foreground">{formatPrice(totals.total, currency, locale)}</dd>
        </div>
      </dl>
      <button className="button-primary mt-6 flex w-full disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} type="submit">{isSubmitting ? t("checkout", "creatingOrder") : t("checkout", "confirmOrder")}</button>
      <p className="mt-4 text-center text-xs leading-5 text-muted">{t("checkout", "securityNote")}</p>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="mt-5 grid gap-2 text-sm font-medium text-foreground"><span>{label}</span>{children}</label>;
}

function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) {
  const { t } = usePreferences();
  return (
    <main className="site-container grid min-h-[60vh] place-items-center py-16">
      <section className="w-full max-w-xl rounded-2xl bg-[var(--ds-success-soft)] p-8 text-center sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-primary-contrast" aria-hidden="true"><CheckIcon /></span>
        <p className="mt-6 text-sm font-bold text-success">{t("checkout", "orderCreated")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-foreground">{t("checkout", "thankYou")}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">{t("checkout", "orderReference")} <strong className="font-mono text-foreground">{result.orderNumber}</strong>. {t("checkout", "orderUpdateText")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="button-secondary bg-surface" href={hasAccount ? "/account" : "/signup"}>{hasAccount ? t("checkout", "viewAccount") : t("checkout", "createAccountHistory")}</Link>
          <Link className="button-primary" href="/shop">{t("checkout", "continueShopping")}</Link>
        </div>
      </section>
    </main>
  );
}

function PaymentIcon({ type }: { type: "card" | "mobile" | "cash" }) {
  if (type === "mobile") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><rect height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="11" x="6.5" y="3" /><path d="M10 6h4M11 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  if (type === "cash") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="M6 8h1M17 16h1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" /><path d="M3 9h18M7 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function CheckIcon() {
  return <svg fill="none" height="25" viewBox="0 0 24 24" width="25"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}