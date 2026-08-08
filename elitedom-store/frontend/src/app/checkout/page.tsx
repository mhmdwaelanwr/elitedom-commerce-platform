"use client";

import Image from "next/image";
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
    email: session?.email ?? "",
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
      shippingAddress: [address.street_address, address.address_line_2, address.city, address.country]
        .filter(Boolean)
        .join(", "),
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
      <div className="site-container grid min-h-[58vh] place-items-center py-14 text-center">
        <div className="max-w-lg">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-success shadow-sm"><CheckIcon /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("checkout", "emptyCartTitle")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("checkout", "emptyCartText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("checkout", "browseProducts")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-7 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted sm:text-sm">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <Chevron />
        <Link className="focus-ring rounded-md hover:text-foreground" href="/cart">{t("storefront", "cart")}</Link>
        <Chevron />
        <span className="text-foreground">{t("checkout", "title")}</span>
      </nav>

      <div className="mt-5 grid gap-5 border-b border-border pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="section-kicker">{t("checkout", "eyebrow")}</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("checkout", "pageTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("checkout", "description")}</p>
        </div>
        <CheckoutSteps />
      </div>

      {!session ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span>{t("checkout", "guestCheckout")}</span>
          <Link className="focus-ring rounded-md font-bold text-primary hover:brightness-110" href="/signin?next=/checkout">{t("checkout", "signIn")}</Link>
        </div>
      ) : null}

      <form className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <CheckoutSection icon={<PersonIcon />} number="01" title={t("checkout", "shippingDetails")}>
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
          </CheckoutSection>

          <CheckoutSection icon={<CardIcon />} number="02" title={t("checkout", "paymentMethod")}>
            <div className="grid gap-3 md:grid-cols-3">
              <PaymentOption checked={form.paymentMethod === "credit_card"} description="Paymob" icon={<CardIcon />} label={t("checkout", "cardPayment")} onChange={() => update("paymentMethod", "credit_card")} />
              <PaymentOption checked={form.paymentMethod === "instapay"} description="Paymob" icon={<PhoneIcon />} label={t("checkout", "walletPayment")} onChange={() => update("paymentMethod", "instapay")} />
              <PaymentOption checked={form.paymentMethod === "cash_on_delivery"} description="COD" icon={<CashIcon />} label={t("checkout", "cashOnDelivery")} onChange={() => update("paymentMethod", "cash_on_delivery")} />
            </div>

            {session ? (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-elevated/55 p-4 text-sm text-muted">
                <input checked={form.useLoyaltyPoints} className="mt-0.5 h-4 w-4 accent-primary" onChange={(event) => update("useLoyaltyPoints", event.target.checked)} type="checkbox" />
                <span><strong className="text-foreground">{t("checkout", "loyaltyTitle")}</strong><br /><span className="text-xs leading-5">{t("checkout", "loyaltyText")}</span></span>
              </label>
            ) : null}
          </CheckoutSection>

          <CheckoutSection icon={<NoteIcon />} number="03" title={t("checkout", "orderNotes")}>
            <textarea className="form-input min-h-24 resize-y" onChange={(event) => update("notes", event.target.value)} placeholder={t("checkout", "notesPlaceholder")} value={form.notes} />
          </CheckoutSection>

          {error ? <p className="rounded-xl border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
        </div>

        <OrderSummary currency={currency} isSubmitting={isSubmitting} locale={locale} totals={totals} />
      </form>
    </div>
  );
}

function CheckoutSteps() {
  const { t } = usePreferences();
  const steps = [t("checkout", "deliveryAddress"), t("checkout", "paymentMethod"), t("checkout", "placeOrder")];
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <li className="flex items-center gap-2 text-[11px] font-bold text-muted" key={step}>
          <span className={`grid h-6 w-6 place-items-center rounded-full border ${index === 0 ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted"}`}>{index + 1}</span>
          <span className="hidden sm:inline">{step}</span>
          {index < steps.length - 1 ? <span aria-hidden="true" className="h-px w-5 bg-border" /> : null}
        </li>
      ))}
    </ol>
  );
}

function CheckoutSection({ children, icon, number, title }: { children: ReactNode; icon: ReactNode; number: string; title: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary">{icon}</span>
        <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">{number}</p><h2 className="mt-0.5 text-lg font-black text-foreground">{title}</h2></div>
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}

function PaymentOption({ checked, description, icon, label, onChange }: { checked: boolean; description: string; icon: ReactNode; label: string; onChange: () => void }) {
  return (
    <label className={`relative cursor-pointer rounded-xl border p-4 transition ${checked ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border bg-surface hover:border-primary/40"}`}>
      <input checked={checked} className="sr-only" name="payment-method" onChange={onChange} type="radio" />
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${checked ? "bg-primary text-primary-contrast" : "bg-elevated text-muted"}`}>{icon}</span>
      <span className="mt-3 block text-sm font-bold leading-5 text-foreground">{label}</span>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{description}</span>
      <span aria-hidden="true" className={`absolute end-3 top-3 h-4 w-4 rounded-full border-2 ${checked ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--ds-surface)]" : "border-border"}`} />
    </label>
  );
}

function OrderSummary({ currency, isSubmitting, locale, totals }: { currency: Currency; isSubmitting: boolean; locale: "en" | "ar"; totals: ReturnType<typeof getCheckoutTotals> }) {
  const { t } = usePreferences();
  const { cart } = useStore();
  return (
    <aside className="h-fit xl:sticky xl:top-36">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-foreground">{t("checkout", "orderSummary")}</h2>
        <ul className="mt-4 grid max-h-64 gap-3 overflow-y-auto border-y border-border py-4">
          {cart.map((item) => (
            <li className="flex gap-3" key={item.product.id}>
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated">
                <Image alt="" className="object-contain p-1.5" fill sizes="56px" src={item.product.image} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-bold leading-5 text-foreground">{item.product.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted"><span>× {item.quantity}</span><span className="font-semibold text-foreground">{formatPrice(item.product.priceEgp * item.quantity, currency, locale)}</span></div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-3 text-sm">
          <SummaryRow label={t("checkout", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
          <SummaryRow label={t("checkout", "delivery")} value={formatPrice(totals.shipping, currency, locale)} />
          <SummaryRow label={t("checkout", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
          <div className="mt-1 flex items-end justify-between gap-4 border-t border-border pt-4"><dt className="font-black text-foreground">{t("checkout", "total")}</dt><dd className="text-2xl font-black tracking-tight text-foreground">{formatPrice(totals.total, currency, locale)}</dd></div>
        </dl>
        <button className="button-primary mt-5 flex w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting} type="submit"><LockIcon />{isSubmitting ? t("checkout", "creatingOrder") : t("checkout", "confirmOrder")}</button>
        <p className="mt-3 text-center text-[11px] leading-5 text-muted">{t("checkout", "securityNote")}</p>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-semibold text-foreground">{value}</dd></div>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>; }

function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[62vh] place-items-center py-14">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-surface p-7 text-center shadow-sm sm:p-9">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success text-primary-contrast"><CheckIcon /></span>
        <p className="section-kicker mt-6 text-success">{t("checkout", "orderCreated")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("checkout", "thankYou")}</h1>
        <p className="mt-3 text-sm text-muted">{t("checkout", "orderReference")} <strong className="text-foreground">{result.orderNumber}</strong></p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{t("checkout", "orderUpdateText")}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link className="button-primary" href={hasAccount ? "/account/orders" : "/signin?next=/account/orders"}>{hasAccount ? t("checkout", "viewAccount") : t("checkout", "createAccountHistory")}</Link>
          <Link className="button-secondary" href="/shop">{t("checkout", "continueShopping")}</Link>
        </div>
      </section>
    </div>
  );
}

function Chevron() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function CheckIcon() { return <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 24 24" width="28"><path d="m6 12 4 4 8-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>; }
function PersonIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function CardIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="19" x="2.5" y="5" /><path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function PhoneIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="2.5" /><path d="M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function CashIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function NoteIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M5 3h11l3 3v15H5z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8 10h8M8 14h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function LockIcon() { return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="11" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" /></svg>; }
