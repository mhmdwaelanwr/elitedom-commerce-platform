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
      ]
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
        if (paymentUrl.protocol !== "https:") {
          throw new ApiError(t("checkout", "orderError"));
        }
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

  if (result) {
    return <CheckoutSuccess hasAccount={Boolean(session)} result={result} />;
  }

  if (cart.length === 0) {
    return (
      <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center">
        <section className="w-full max-w-lg">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <CartCheckIcon />
          </span>
          <p className="section-kicker mt-7">{t("checkout", "eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("checkout", "emptyCartTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted sm:text-base">
            {t("checkout", "emptyCartText")}
          </p>
          <Link className="button-primary mt-7" href="/shop">
            {t("checkout", "browseProducts")}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
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

      <header className="mt-6 max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-primary">
          <LockIcon />
          {t("checkout", "eyebrow")}
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {t("checkout", "pageTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {t("checkout", "description")}
        </p>
      </header>

      <CheckoutSteps />

      {!session && (
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-primary"><UserIcon /></span>
            <p className="max-w-2xl text-sm leading-6 text-muted">{t("checkout", "guestCheckout")}</p>
          </div>
          <Link className="button-secondary shrink-0 px-4 py-2.5" href="/signin?next=/checkout">
            {t("checkout", "signIn")}
          </Link>
        </div>
      )}

      <form className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10" onSubmit={handleSubmit}>
        <div className="grid min-w-0 gap-5">
          <CheckoutPanel
            icon={<LocationIcon />}
            number="01"
            title={t("checkout", "shippingDetails")}
          >
            {session && savedAddresses.length > 0 && (
              <div className="mb-6 rounded-xl border border-border bg-elevated p-4">
                <Field label={t("checkout", "useSavedAddress")} noMargin>
                  <select
                    className="form-input"
                    defaultValue=""
                    onChange={(event) => selectSavedAddress(event.target.value)}
                  >
                    <option disabled value="">
                      {t("checkout", "selectAddress")}
                    </option>
                    {savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}
                        {address.is_default ? ` (${t("checkout", "defaultAddress")})` : ""} · {address.city}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="grid gap-x-4 sm:grid-cols-2">
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
                  {GOVERNORATES.map((governorate) => (
                    <option key={governorate}>{governorate}</option>
                  ))}
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
          </CheckoutPanel>

          <CheckoutPanel icon={<CardIcon />} number="02" title={t("checkout", "paymentMethod")}>
            <fieldset>
              <legend className="sr-only">{t("checkout", "paymentMethod")}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <PaymentOption
                  checked={form.paymentMethod === "credit_card"}
                  icon={<CardIcon />}
                  label={t("checkout", "cardPayment")}
                  meta="Paymob"
                  onChange={() => update("paymentMethod", "credit_card")}
                />
                <PaymentOption
                  checked={form.paymentMethod === "instapay"}
                  icon={<PhoneIcon />}
                  label={t("checkout", "walletPayment")}
                  meta="Paymob"
                  onChange={() => update("paymentMethod", "instapay")}
                />
                <PaymentOption
                  checked={form.paymentMethod === "cash_on_delivery"}
                  icon={<CashIcon />}
                  label={t("checkout", "cashOnDelivery")}
                  meta="Elitedom"
                  onChange={() => update("paymentMethod", "cash_on_delivery")}
                />
              </div>
            </fieldset>

            {session && (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-elevated p-4 text-sm text-muted transition hover:border-primary/35">
                <input
                  checked={form.useLoyaltyPoints}
                  className="mt-1 h-4 w-4 accent-primary"
                  onChange={(event) => update("useLoyaltyPoints", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong className="font-black text-foreground">{t("checkout", "loyaltyTitle")}</strong>
                  <span className="mt-1 block text-xs leading-5">{t("checkout", "loyaltyText")}</span>
                </span>
              </label>
            )}
          </CheckoutPanel>

          <CheckoutPanel icon={<NoteIcon />} number="03" title={t("checkout", "orderNotes")}>
            <textarea
              className="form-input min-h-24 resize-y"
              onChange={(event) => update("notes", event.target.value)}
              placeholder={t("checkout", "notesPlaceholder")}
              value={form.notes}
            />
          </CheckoutPanel>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3.5 text-sm text-danger" role="alert">
              <span className="mt-0.5 shrink-0"><AlertIcon /></span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <OrderSummary
          cart={cart}
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
    { label: t("checkout", "deliveryAddress"), icon: <LocationIcon /> },
    { label: t("checkout", "paymentMethod"), icon: <CardIcon /> },
    { label: t("checkout", "placeOrder"), icon: <CheckIcon /> },
  ];

  return (
    <ol className="mt-7 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-surface">
      {steps.map((step, index) => (
        <li
          className={`relative flex min-h-16 items-center gap-2.5 px-3 py-3 sm:px-5 ${index < steps.length - 1 ? "border-e border-border" : ""}`}
          key={step.label}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${index === 0 ? "bg-primary text-primary-contrast" : "bg-elevated text-muted"}`}>
            {step.icon}
          </span>
          <span className={`hidden text-xs font-black sm:block ${index === 0 ? "text-foreground" : "text-muted"}`}>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CheckoutPanel({
  children,
  icon,
  number,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  number: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary">{icon}</span>
          <h2 className="text-base font-black text-foreground sm:text-lg">{title}</h2>
        </div>
        <span className="font-mono text-xs font-bold text-muted">{number}</span>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function PaymentOption({
  checked,
  icon,
  label,
  meta,
  onChange,
}: {
  checked: boolean;
  icon: ReactNode;
  label: string;
  meta: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`relative cursor-pointer rounded-xl border p-4 transition ${
        checked
          ? "border-primary bg-[var(--ds-soft-primary)] shadow-[inset_0_0_0_1px_var(--ds-primary)]"
          : "border-border bg-background hover:border-primary/45"
      }`}
    >
      <input checked={checked} className="sr-only" name="payment-method" onChange={onChange} type="radio" />
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${checked ? "bg-primary text-primary-contrast" : "bg-elevated text-muted"}`}>
          {icon}
        </span>
        <span className={`mt-1 h-4 w-4 rounded-full border-2 ${checked ? "border-[5px] border-primary" : "border-border"}`} aria-hidden="true" />
      </div>
      <span className="mt-4 block text-sm font-black leading-5 text-foreground">{label}</span>
      <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-muted">{meta}</span>
    </label>
  );
}

function OrderSummary({
  cart,
  currency,
  isSubmitting,
  locale,
  totals,
}: {
  cart: CartItem[];
  currency: Currency;
  isSubmitting: boolean;
  locale: "en" | "ar";
  totals: ReturnType<typeof getCheckoutTotals>;
}) {
  const { t } = usePreferences();

  return (
    <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:sticky lg:top-28">
      <div className="border-b border-border px-6 py-5">
        <p className="section-kicker">{t("checkout", "placeOrder")}</p>
        <h2 className="mt-1 text-xl font-black text-foreground">{t("checkout", "orderSummary")}</h2>
      </div>

      <div className="max-h-64 overflow-y-auto border-b border-border px-5 py-2">
        {cart.map((item) => (
          <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0" key={item.product.id}>
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-elevated">
              <Image alt="" className="object-contain p-1.5" fill sizes="56px" src={item.product.image} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-bold leading-5 text-foreground">{item.product.name}</p>
              <p className="mt-0.5 text-[11px] text-muted">× {item.quantity}</p>
            </div>
            <p className="shrink-0 text-xs font-black text-foreground">
              {formatPrice(item.product.priceEgp * item.quantity, currency, locale)}
            </p>
          </div>
        ))}
      </div>

      <div className="p-6">
        <dl className="grid gap-3 text-sm">
          <SummaryRow label={t("checkout", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
          <SummaryRow label={t("checkout", "delivery")} value={formatPrice(totals.shipping, currency, locale)} />
          <SummaryRow label={t("checkout", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
        </dl>

        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-black text-foreground">{t("checkout", "total")}</span>
            <span className="text-2xl font-black tracking-tight text-foreground">
              {formatPrice(totals.total, currency, locale)}
            </span>
          </div>
        </div>

        <button
          className="button-primary mt-6 flex w-full justify-center disabled:cursor-wait disabled:opacity-65"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? t("checkout", "creatingOrder") : t("checkout", "confirmOrder")}
          {!isSubmitting && <ArrowIcon />}
        </button>

        <div className="mt-5 grid gap-2.5 text-xs leading-5 text-muted">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-success"><ShieldIcon /></span>
            <span>{t("checkout", "securityNote")}</span>
          </div>
        </div>
      </div>
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

function Field({ children, label, noMargin = false }: { children: ReactNode; label: string; noMargin?: boolean }) {
  return (
    <label className={`${noMargin ? "" : "mt-4"} grid gap-2 text-sm font-bold text-foreground`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[66vh] place-items-center py-14">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-[var(--ds-soft-success)] px-7 py-8 text-center sm:px-10 sm:py-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success text-white shadow-sm">
            <CheckIcon large />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-success">{t("checkout", "orderCreated")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("checkout", "thankYou")}</h1>
        </div>
        <div className="px-7 py-7 text-center sm:px-10 sm:py-8">
          <p className="text-sm leading-6 text-muted">
            {t("checkout", "orderReference")} {" "}
            <strong className="rounded-md bg-elevated px-2 py-1 font-mono text-foreground">{result.orderNumber}</strong>. {" "}
            {t("checkout", "orderUpdateText")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className="button-primary" href={hasAccount ? "/account" : "/signup"}>
              {hasAccount ? t("checkout", "viewAccount") : t("checkout", "createAccountHistory")}
            </Link>
            <Link className="button-secondary" href="/shop">
              {t("checkout", "continueShopping")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5" />
      <path d="M2 10h20M6 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="20" rx="3" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="2" />
      <path d="M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 9v6M19 9v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M5 3h10l4 4v14H5V3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M14 3v5h5M8 12h8M8 16h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c.8-3.2 3.3-5.2 7-5.2s6.2 2 7 5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CheckIcon({ large = false }: { large?: boolean }) {
  const size = large ? 28 : 18;
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function CartCheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="34" viewBox="0 0 24 24" width="34">
      <path d="M3 4h2l2 10h10l3-7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m10 10 1.5 1.5L15 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="9" cy="19" r="1.4" fill="currentColor" />
      <circle cx="17" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
