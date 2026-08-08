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
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">{t("account", "orders")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-6" href="/signin?next=/account/orders">{t("account", "signIn")}</Link>
        </div>
      </main>
    );
  }

  const isLoading = orders === null && !error;

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-8">
        <div>
          <p className="text-sm font-bold text-primary">{t("account", "orderTracking")}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("account", "allOrders")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{t("account", "allOrdersDescription")}</p>
        </div>
        <Link className="button-secondary" href="/account">{t("account", "backToAccount")}</Link>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-3" aria-busy="true">
          {[1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-2xl bg-elevated" key={item} />)}
        </div>
      ) : error ? (
        <section className="mt-8 rounded-2xl bg-[var(--ds-danger-soft)] p-8 text-center">
          <h2 className="font-bold text-foreground">{t("account", "ordersLoadError")}</h2>
          <p className="mt-2 text-sm text-muted">{t("account", "ordersLoadErrorDescription")}</p>
        </section>
      ) : orders?.length === 0 ? (
        <section className="mt-8 rounded-2xl bg-elevated p-10 text-center">
          <h2 className="text-xl font-bold text-foreground">{t("account", "noOrders")}</h2>
          <Link className="button-primary mt-5" href="/shop">{t("account", "browseProducts")}</Link>
        </section>
      ) : (
        <div className="mt-8 divide-y divide-border border-y border-border">
          {orders?.map((order) => (
            <article className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={order.id}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link className="focus-ring rounded-lg text-lg font-bold text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>{order.name}</Link>
                  <span className="rounded-full bg-[var(--ds-primary-soft)] px-3 py-1 text-xs font-medium text-primary">{order.state.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{formatDate(order.created_at, locale)} · {order.shipping_governorate ?? t("account", "deliveryAddress")}</p>
                <p className="mt-1 text-xs text-muted">{t("account", "paymentStatus")}: {order.payment_status.replaceAll("_", " ")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <strong className="text-lg text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</strong>
                <Link className="button-secondary" href={`/account/orders/${order.id}`}>{t("account", "viewOrder")}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}