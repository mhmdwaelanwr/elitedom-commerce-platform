"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { fetchAccountOrders, type AccountOrder } from "@/lib/fulfillment-api";
import { formatDate, formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function OrdersPage() {
  const { locale, t } = usePreferences();
  const { currency, session } = useStore();
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchAccountOrders(session)
      .then((result) => {
        if (active) setOrders(result.orders);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return (
      <main className="site-container grid min-h-[64vh] place-items-center py-14 text-center">
        <section className="w-full max-w-lg">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <OrdersIcon large />
          </span>
          <p className="section-kicker mt-7">{t("account", "orderTracking")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("account", "orders")}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted sm:text-base">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-7" href="/signin?next=/account/orders">{t("account", "signIn")}</Link>
        </section>
      </main>
    );
  }

  const isLoading = orders === null && !error;

  return (
    <main className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/account">{t("account", "title")}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("account", "orders")}</span>
      </nav>

      <header className="mt-6 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">{t("account", "orderTracking")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("account", "allOrders")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("account", "allOrdersDescription")}</p>
        </div>
        <Link className="button-secondary w-fit px-4 py-2.5" href="/account">
          <span aria-hidden="true" className="rtl:rotate-180">←</span>
          {t("account", "backToAccount")}
        </Link>
      </header>

      {isLoading ? (
        <div className="mt-7 grid gap-3" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" key={item} />
          ))}
        </div>
      ) : error ? (
        <section className="mt-7 rounded-2xl border border-danger/30 bg-danger/10 px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface text-danger"><AlertIcon /></span>
          <h2 className="mt-4 font-black text-foreground">{t("account", "ordersLoadError")}</h2>
          <p className="mt-2 text-sm text-muted">{t("account", "ordersLoadErrorDescription")}</p>
        </section>
      ) : orders?.length === 0 ? (
        <section className="mt-7 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-elevated text-primary"><OrdersIcon /></span>
          <h2 className="mt-4 text-xl font-black text-foreground">{t("account", "noOrders")}</h2>
          <Link className="button-primary mt-6" href="/shop">{t("account", "browseProducts")}</Link>
        </section>
      ) : (
        <div className="mt-7 grid gap-3">
          {orders?.map((order) => <OrderCard currency={currency} key={order.id} locale={locale} order={order} />)}
        </div>
      )}
    </main>
  );
}

function OrderCard({ currency, locale, order }: { currency: "EGP" | "USD"; locale: "en" | "ar"; order: AccountOrder }) {
  const { t } = usePreferences();
  const state = order.state.replaceAll("_", " ");
  const payment = order.payment_status.replaceAll("_", " ");
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/35">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link className="focus-ring rounded-md text-lg font-black text-foreground transition group-hover:text-primary" href={`/account/orders/${order.id}`}>{order.name}</Link>
            <StatusBadge status={order.state} text={state} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarIcon />{formatDate(order.created_at, locale)}</span>
            <span className="inline-flex items-center gap-1.5"><LocationIcon />{order.shipping_governorate ?? t("account", "deliveryAddress")}</span>
            <span className="inline-flex items-center gap-1.5"><PaymentIcon />{t("account", "paymentStatus")}: <strong className="font-bold text-foreground">{payment}</strong></span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-border pt-4 lg:min-w-56 lg:justify-end lg:border-0 lg:pt-0">
          <div className="lg:text-end">
            <p className="text-xs text-muted">{t("account", "total")}</p>
            <strong className="mt-1 block text-xl font-black tracking-tight text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</strong>
          </div>
          <Link aria-label={`${t("account", "viewOrder")} ${order.name}`} className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-border text-primary transition hover:border-primary hover:bg-[var(--ds-soft-primary)]" href={`/account/orders/${order.id}`}><ArrowIcon /></Link>
        </div>
      </div>
      <div className="h-1 bg-elevated"><div className={`h-full ${progressWidth(order.state)} bg-primary transition-all`} /></div>
    </article>
  );
}

function StatusBadge({ status, text }: { status: string; text: string }) {
  const cls = status === "delivered"
    ? "bg-[var(--ds-soft-success)] text-success"
    : status === "cancelled"
      ? "bg-danger/10 text-danger"
      : status === "payment_pending"
        ? "bg-warning/10 text-warning"
        : "bg-[var(--ds-soft-primary)] text-primary";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${cls}`}>{text}</span>;
}

function progressWidth(status: string) {
  const widths: Record<string, string> = {
    payment_pending: "w-[10%]",
    confirmed: "w-1/4",
    processing: "w-2/5",
    ready_to_ship: "w-3/5",
    shipped: "w-4/5",
    delivered: "w-full",
    cancelled: "w-0",
  };
  return widths[status] ?? "w-1/4";
}

function OrdersIcon({ large = false }: { large?: boolean }) {
  const size = large ? 32 : 18;
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}><path d="M5 4h14v16H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;
}
function CalendarIcon() { return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5"/><path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>; }
function LocationIcon() { return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>; }
function PaymentIcon() { return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/></svg>; }
function ArrowIcon() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>; }
function AlertIcon() { return <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>; }
