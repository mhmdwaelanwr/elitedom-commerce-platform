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
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setError(false);
    void fetchAccountOrders(session)
      .then((result) => {
        if (active) setOrders(result.orders);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return (
      <main className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div className="max-w-lg rounded-3xl border border-border bg-surface p-8">
          <h1 className="text-3xl font-black text-foreground">{t("account", "orders")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-6" href="/signin?next=/account/orders">
            {t("account", "signIn")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="site-container py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">{t("account", "orderTracking")}</p>
          <h1 className="mt-2 text-3xl font-black text-foreground">{t("account", "allOrders")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("account", "allOrdersDescription")}</p>
        </div>
        <Link className="button-secondary" href="/account">
          {t("account", "backToAccount")}
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div className="h-32 animate-pulse rounded-2xl border border-border bg-elevated" key={item} />
          ))}
        </div>
      ) : error ? (
        <section className="mt-8 rounded-2xl border border-danger/30 bg-danger/5 p-8 text-center">
          <h2 className="font-black text-foreground">{t("account", "ordersLoadError")}</h2>
          <p className="mt-2 text-sm text-muted">{t("account", "ordersLoadErrorDescription")}</p>
        </section>
      ) : orders.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-10 text-center">
          <h2 className="text-xl font-black text-foreground">{t("account", "noOrders")}</h2>
          <Link className="button-primary mt-5" href="/shop">
            {t("account", "browseProducts")}
          </Link>
        </section>
      ) : (
        <div className="mt-8 grid gap-4">
          {orders.map((order) => (
            <article className="rounded-2xl border border-border bg-surface p-5 sm:p-6" key={order.id}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link className="focus-ring rounded-md text-lg font-black text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>
                      {order.name}
                    </Link>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {order.state.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {formatDate(order.created_at, locale)} · {order.shipping_governorate ?? t("account", "deliveryAddress")}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {t("account", "paymentStatus")}: {order.payment_status.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <strong className="text-lg text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</strong>
                  <Link className="button-secondary text-sm" href={`/account/orders/${order.id}`}>
                    {t("account", "viewOrder")}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
