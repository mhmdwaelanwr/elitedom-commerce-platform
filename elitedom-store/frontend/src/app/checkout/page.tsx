"use client";

import Image from "next/image";
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
import type { CartItem, CheckoutDetails, CheckoutResult, Currency } from "@/types/store";

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
    return () => { active = false; };
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
      <main className="site-container grid min-h-[62vh] place-items-center py-14 text-center">
        <section className="w-full max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-success"><CheckIcon /></span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-foreground">{t("checkout", "emptyCartTitle")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("checkout", "emptyCartText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("checkout", "browseProducts")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link className="hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <span aria-hidden="true"> / </span>
        <Link className="hover:text-foreground" href="/cart">{t("storefront", "cart")}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{t("checkout", "title")}</span>
      </nav>

      <header className="mt-5 border-b border-border pb-6">
        <p className="section-kicker">{t("checkout", "eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{t("checkout", "pageTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("checkout", "description")}</p>
      </header>

      {!session ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
          <span>{t("checkout", "guestCheckout")}</span>
          <Link className="font-black text-foreground hover:text-primary" href="/signin?next=/checkout">{t("checkout", "signIn")}</Link>
        </div>
      ) : null}

      <form className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10" onSubmit={handleSubmit}>
        <div className="min-w-0 space-y-4">
          <CheckoutSection number="01" title={t("checkout", "deliveryAddress")}>
            {session && savedAddresses.length > 0 ? (
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
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("checkout", "fullName")}>
                <input autoComplete="name" className="form-input" onChange={(event) => update("fullName", event.target.value)} required value={form.fullName} />
              </Field>
              <Field label={t("checkout", "mobileNumber")}>
                <input autoComplete="tel" className="form-input" onChange={(event) => update("phone", event.target.value)} required type="tel" value={form.phone} />
              </Field>
              <Field label={t("checkout", "email")}>
                <input autoComplete="email" className="form-input" onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} />
              </Field>
              <Field label={t("checkout", "governorate")}>
                <select className="form-input" onChange={(event) => update("governorate", event.target.value)} value={form.governorate}>
                  {GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}
                </select>
              </Field>
            </div>

            <Field label={t("checkout", "fullDeliveryAddress")}>
              <textarea autoComplete="street-address" className="form-input min-h-24 resize-y" onChange={(event) => update("shippingAddress", event.target.value)} placeholder={t("checkout", "addressPlaceholder")} required value={form.shippingAddress} />
            </Field>
          </CheckoutSection>

          <CheckoutSection number="02" title={t("checkout", "paymentMethod")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <PaymentOption checked={form.paymentMethod === "credit_card"} icon={<CardIcon />} label={t("checkout", "cardPayment")} onChange={() => update("paymentMethod", "credit_card")} />
              <PaymentOption checked={form.paymentMethod === "instapay"} icon={<PhoneIcon />} label={t("checkout", "walletPayment")} onChange={() => update("paymentMethod", "instapay")} />
              <PaymentOption checked={form.paymentMethod === "cash_on_delivery"} icon={<CashIcon />} label={t("checkout", "cashOnDelivery")} onChange={() => update("paymentMethod", "cash_on_delivery")} />
            </div>

            {session ? (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted">
                <input checked={form.useLoyaltyPoints} className="mt-0.5 h-4 w-4 accent-primary" onChange={(event) => update("useLoyaltyPoints", event.target.checked)} type="checkbox" />
                <span><strong className="text-foreground">{t("checkout", "loyaltyTitle")}</strong><span className="mt-1 block text-xs leading-5">{t("checkout", "loyaltyText")}</span></span>
              </label>
            ) : null}
          </CheckoutSection>

          <CheckoutSection number="03" title={t("checkout", "placeOrder")}>
            <details className="group rounded-xl border border-border bg-background p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-foreground">
                <span>{t("checkout", "orderNotes")}</span>
                <span aria-hidden="true" className="text-muted transition group-open:rotate-180">⌄</span>
              </summary>
              <textarea className="form-input mt-4 min-h-20 resize-y" onChange={(event) => update("notes", event.target.value)} placeholder={t("checkout", "notesPlaceholder")} value={form.notes} />
            </details>
            <p className="mt-4 text-xs leading-5 text-muted">{t("checkout", "securityNote")}</p>
            {error ? <p className="mt-4 rounded-xl border border-danger/25 bg-[var(--ds-soft-danger)] px-4 py-3 text-sm font-bold text-danger" role="alert">{error}</p> : null}
          </CheckoutSection>
        </div>

        <OrderSummary cart={cart} currency={currency} isSubmitting={isSubmitting} locale={locale} totals={totals} />
      </form>
    </main>
  );
}

function CheckoutSection({ children, number, title }: { children: ReactNode; number: string; title: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="font-mono text-xs font-black text-primary">{number}</span>
        <h2 className="text-lg font-black tracking-[-0.02em] text-foreground">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-bold text-foreground"><span>{label}</span>{children}</label>;
}

function PaymentOption({ checked, icon, label, onChange }: { checked: boolean; icon: ReactNode; label: string; onChange: () => void }) {
  return (
    <label className={`cursor-pointer rounded-xl border p-4 transition ${checked ? "border-foreground bg-elevated" : "border-border bg-background hover:border-foreground/25"}`}>
      <input checked={checked} className="sr-only" name="payment-method" onChange={onChange} type="radio" />
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${checked ? "bg-foreground text-background" : "bg-elevated text-muted"}`} aria-hidden="true">{icon}</span>
      <span className="mt-3 block text-xs font-black leading-5 text-foreground">{label}</span>
    </label>
  );
}

function OrderSummary({ cart, currency, isSubmitting, locale, totals }: {
  cart: CartItem[];
  currency: Currency;
  isSubmitting: boolean;
  locale: "en" | "ar";
  totals: ReturnType<typeof getCheckoutTotals>;
}) {
  const { t } = usePreferences();
  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:sticky lg:top-32">
      <h2 className="text-lg font-black tracking-[-0.02em] text-foreground">{t("checkout", "orderSummary")}</h2>

      <div className="mt-5 grid gap-3">
        {cart.slice(0, 3).map((item) => (
          <div className="flex items-center gap-3" key={item.product.id}>
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--ds-product-canvas)]">
              <Image alt="" className="object-contain p-1.5" fill sizes="48px" src={item.product.image} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-foreground">{item.product.name}</p>
              <p className="mt-1 text-[10px] text-muted">× {item.quantity}</p>
            </div>
            <span className="text-xs font-black text-foreground">{formatPrice(item.product.priceEgp * item.quantity, currency, locale)}</span>
          </div>
        ))}
        {cart.length > 3 ? <p className="text-[11px] font-bold text-muted">+ {cart.length - 3} {t("checkout", "products")}</p> : null}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-y border-border py-5">
        <span className="text-sm font-bold text-muted">{t("checkout", "total")}</span>
        <span className="text-2xl font-black tracking-[-0.035em] text-foreground">{formatPrice(totals.total, currency, locale)}</span>
      </div>

      <details className="group border-b border-border py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-black text-foreground">
          <span>{t("checkout", "orderSummary")}</span><span aria-hidden="true" className="text-muted transition group-open:rotate-180">⌄</span>
        </summary>
        <dl className="mt-4 grid gap-3 text-xs">
          <SummaryRow label={t("checkout", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
          <SummaryRow label={t("checkout", "delivery")} value={formatPrice(totals.shipping, currency, locale)} />
          <SummaryRow label={t("checkout", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
        </dl>
      </details>

      <button className="button-primary mt-5 flex w-full disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">
        {isSubmitting ? t("checkout", "creatingOrder") : t("checkout", "confirmOrder")}
        {!isSubmitting ? <span aria-hidden="true" className="rtl:rotate-180">→</span> : null}
      </button>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-black text-foreground">{value}</dd></div>;
}

function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) {
  const { t } = usePreferences();
  return (
    <main className="site-container grid min-h-[65vh] place-items-center py-14 text-center">
      <section className="w-full max-w-lg">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-success/20 bg-[var(--ds-soft-success)] text-success"><CheckIcon /></span>
        <p className="section-kicker mt-6">{t("checkout", "orderCreated")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground">{t("checkout", "thankYou")}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          {t("checkout", "orderReference")} <strong className="font-mono text-foreground">{result.orderNumber}</strong>. {t("checkout", "orderUpdateText")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="button-primary" href={hasAccount ? "/account" : "/signup"}>{hasAccount ? t("checkout", "viewAccount") : t("checkout", "createAccountHistory")}</Link>
          <Link className="button-secondary" href="/shop">{t("checkout", "continueShopping")}</Link>
        </div>
      </section>
    </main>
  );
}

function CheckIcon() { return <svg aria-hidden="true" fill="none" height="25" viewBox="0 0 24 24" width="25"><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></svg>; }
function CardIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.7" width="20" x="2" y="5" /><path d="M2 9h20M6 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>; }
function PhoneIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="20" rx="3" stroke="currentColor" strokeWidth="1.7" width="12" x="6" y="2" /><path d="M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>; }
function CashIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.7" width="20" x="2" y="5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M5 8.5h1M18 15.5h1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>; }
