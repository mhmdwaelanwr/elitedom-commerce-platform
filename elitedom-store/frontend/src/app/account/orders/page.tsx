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
      <main className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div className="max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-elevated text-primary"><OrdersIcon /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("account", "orders")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-6" href="/signin?next=/account/orders">{t("account", "signIn")}</Link>
        </div>
      </main>
    );
  }

  const isLoading = orders === null && !error;

  return (
    <main className="site-container py-7 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted sm:text-sm">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/account">{t("account", "dashboard")}</Link>
        <Chevron />
        <span className="text-foreground">{t("account", "orders")}</span>
      </nav>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="section-kicker">{t("account", "orderTracking")}</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("account", "allOrders")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("account", "allOrdersDescription")}</p>
        </div>
        <Link className="button-secondary" href="/account">{t("account", "backToAccount")}</Link>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          {[1, 2, 3].map((item) => <div className="h-32 animate-pulse rounded-xl border border-border bg-elevated" key={item} />)}
        </div>
      ) : error ? (
        <section className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-danger/10 text-danger"><AlertIcon /></span>
          <h2 className="mt-4 font-black text-foreground">{t("account", "ordersLoadError")}</h2>
          <p className="mt-2 text-sm text-muted">{t("account", "ordersLoadErrorDescription")}</p>
        </section>
      ) : orders?.length === 0 ? (
        <section className="mt-6 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-elevated text-primary"><OrdersIcon /></span>
          <h2 className="mt-4 text-xl font-black text-foreground">{t("account", "noOrders")}</h2>
          <Link className="button-primary mt-5" href="/shop">{t("account", "browseProducts")}</Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-3">
          {orders?.map((order) => <OrderCard key={order.id} order={order} currency={currency} locale={locale} t={t} />)}
        </div>
      )}
    </main>
  );
}

function OrderCard({
  order,
  currency,
  locale,
  t,
}: {
  order: AccountOrder;
  currency: ReturnType<typeof useStore>["currency"];
  locale: ReturnType<typeof usePreferences>["locale"];
  t: ReturnType<typeof usePreferences>["t"];
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link className="focus-ring rounded-md text-lg font-black text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>{order.name}</Link>
            <StatusBadge value={order.state} />
          </div>
          <p className="mt-2 text-sm text-muted">{formatDate(order.created_at, locale)} · {order.shipping_governorate ?? t("account", "deliveryAddress")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>{t("account", "paymentStatus")}: <strong className="font-semibold text-foreground">{order.payment_status.replaceAll("_", " ")}</strong></span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <strong className="text-xl font-black tracking-tight text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</strong>
          <Link className="button-secondary text-sm" href={`/account/orders/${order.id}`}>{t("account", "viewOrder")}<ArrowIcon /></Link>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-current" />{value.replaceAll("_", " ")}</span>;
}

function Chevron() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function ArrowIcon() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function OrdersIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function AlertIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7v6m0 4h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>; }
