"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { cancelAccountOrder, fetchAccountOrder, fetchOrderTracking, type AccountOrder, type OrderTracking } from "@/lib/fulfillment-api";
import { formatDate, formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const CANCELLABLE_STATUSES = new Set(["payment_pending", "confirmed", "processing", "ready_to_ship"]);

export default function OrderDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const hasValidOrderId = Number.isInteger(orderId) && orderId > 0;
  const { direction, locale, t } = usePreferences();
  const { currency, notify, session } = useStore();
  const [order, setOrder] = useState<AccountOrder | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [isCancelling, setCancelling] = useState(false);
  const [error, setError] = useState(false);

  const fetchOrderData = useCallback(() => {
    if (!session || !hasValidOrderId) return null;
    return Promise.all([fetchAccountOrder(orderId, session), fetchOrderTracking(orderId, session)]);
  }, [hasValidOrderId, orderId, session]);

  useEffect(() => {
    const request = fetchOrderData();
    if (!request) return;
    let active = true;
    void request
      .then(([nextOrder, nextTracking]) => {
        if (!active) return;
        setOrder(nextOrder);
        setTracking(nextTracking);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchOrderData]);

  const canCancel = useMemo(() => Boolean(tracking && CANCELLABLE_STATUSES.has(tracking.fulfillment_status)), [tracking]);

  async function reloadOrder() {
    const request = fetchOrderData();
    if (!request) return;
    setLoading(true);
    setError(false);
    try {
      const [nextOrder, nextTracking] = await request;
      setOrder(nextOrder);
      setTracking(nextTracking);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!session || !order || !canCancel || isCancelling) return;
    if (!window.confirm(t("account", "cancelOrderConfirm"))) return;
    setCancelling(true);
    try {
      const result = await cancelAccountOrder(order.id, session);
      notify(result.payment_status === "refund_requested" ? t("account", "cancelledRefundPending") : t("account", "orderCancelled"), "success");
      await reloadOrder();
    } catch {
      notify(t("account", "cancelOrderError"), "error");
    } finally {
      setCancelling(false);
    }
  }

  if (!session) {
    return (
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">{t("account", "orderDetails")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-6" href={`/signin?next=/account/orders/${params.orderId}`}>{t("account", "signIn")}</Link>
        </div>
      </main>
    );
  }

  if (isLoading && hasValidOrderId) {
    return (
      <main className="site-container py-10" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-full bg-elevated" />
        <div className="mt-6 h-56 animate-pulse rounded-2xl bg-elevated" />
        <div className="mt-6 h-72 animate-pulse rounded-2xl bg-elevated" />
      </main>
    );
  }

  if (!hasValidOrderId || error || !order || !tracking) {
    return (
      <main className="site-container py-12">
        <section className="rounded-2xl bg-[var(--ds-danger-soft)] p-10 text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("account", "orderLoadError")}</h1>
          <p className="mt-2 text-sm text-muted">{t("account", "orderLoadErrorDescription")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {hasValidOrderId ? <button className="button-primary" onClick={() => void reloadOrder()} type="button">{t("common", "retry")}</button> : null}
            <Link className="button-secondary bg-surface" href="/account/orders">{t("account", "allOrders")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-8">
        <div>
          <Link className="focus-ring inline-flex rounded-full px-2 py-1 text-sm font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href="/account/orders">
            <span className="me-2" aria-hidden="true">{direction === "rtl" ? "→" : "←"}</span>{t("account", "allOrders")}
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-foreground">{order.name}</h1>
          <p className="mt-2 text-sm text-muted">{formatDate(order.created_at, locale)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-[var(--ds-primary-soft)] px-4 py-2 text-sm font-bold text-primary">{statusLabel(tracking.fulfillment_status, t)}</span>
          {canCancel ? <button className="focus-ring rounded-full border border-danger px-4 py-2 text-sm font-bold text-danger hover:bg-[var(--ds-danger-soft)] disabled:opacity-60" disabled={isCancelling} onClick={handleCancel} type="button">{isCancelling ? t("account", "cancellingOrder") : t("account", "cancelOrder")}</button> : null}
        </div>
      </div>

      <section className="mt-9 rounded-2xl bg-elevated p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-primary">{t("account", "orderTracking")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-foreground">{t("account", "fulfillmentProgress")}</h2>
          </div>
          {tracking.tracking_number ? (
            <div className="text-start sm:text-end">
              <p className="text-xs text-muted">{t("account", "trackingNumber")}</p>
              <p className="mt-1 font-bold text-foreground">{tracking.tracking_number}</p>
              {tracking.carrier ? <p className="mt-1 text-xs text-muted">{tracking.carrier}</p> : null}
            </div>
          ) : null}
        </div>

        <FulfillmentTimeline status={tracking.fulfillment_status} t={t} />

        {tracking.shipments.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {tracking.shipments.map((shipment) => (
              <article className="rounded-2xl bg-surface p-5" key={shipment.id}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-foreground">{shipment.fulfillment_leg === "dropship" ? t("account", "supplierShipment") : t("account", "localShipment")}</strong>
                  <span className="text-xs font-bold text-primary">{shipment.status.replaceAll("_", " ")}</span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm">
                  {shipment.carrier ? <ShipmentFact label={t("account", "carrier")} value={shipment.carrier} /> : null}
                  {shipment.tracking_number ? <ShipmentFact label={t("account", "trackingNumber")} value={shipment.tracking_number} /> : null}
                  {shipment.shipped_at ? <ShipmentFact label={t("account", "shippedAt")} value={formatDate(shipment.shipped_at, locale)} /> : null}
                  {shipment.delivered_at ? <ShipmentFact label={t("account", "deliveredAt")} value={formatDate(shipment.delivered_at, locale)} /> : null}
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-surface p-4 text-sm text-muted">{t("account", "trackingPending")}</p>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">{t("account", "orderItems")}</h2>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {order.order_lines.map((line) => (
              <article className="grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={line.id}>
                <div>
                  <p className="font-bold text-foreground">{t("account", "productNumber")} {line.product_id}</p>
                  <p className="mt-1 text-xs text-muted">{t("account", "quantity")}: {line.quantity}</p>
                </div>
                <p className="font-bold text-foreground">{formatPrice(Number(line.line_total), currency, locale)}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-elevated p-6">
          <h2 className="text-xl font-bold text-foreground">{t("account", "orderSummary")}</h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <SummaryRow label={t("account", "subtotal")} value={formatPrice(Number(order.amount_subtotal), currency, locale)} />
            <SummaryRow label={t("account", "shipping")} value={formatPrice(Number(order.amount_shipping), currency, locale)} />
            <SummaryRow label={t("account", "tax")} value={formatPrice(Number(order.amount_tax), currency, locale)} />
            <div className="my-1 border-t border-border" />
            <SummaryRow label={t("account", "total")} value={formatPrice(Number(order.amount_total), currency, locale)} strong />
            <SummaryRow label={t("account", "paymentStatus")} value={order.payment_status.replaceAll("_", " ")} />
          </dl>
          <div className="mt-6 rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted">{t("account", "deliveryAddress")}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{order.shipping_address}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function FulfillmentTimeline({ status, t }: { status: string; t: ReturnType<typeof usePreferences>["t"] }) {
  const stages = ["confirmed", "processing", "ready_to_ship", "shipped", "delivered"];
  const currentIndex = stages.indexOf(status);
  const cancelled = status === "cancelled";
  return (
    <ol className="mt-8 grid gap-4 sm:grid-cols-5">
      {stages.map((stage, index) => {
        const complete = !cancelled && currentIndex >= index;
        return (
          <li className="relative flex gap-3 sm:block" key={stage}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-primary text-primary-contrast" : "bg-surface text-muted"}`}>{index + 1}</span>
            <p className={`mt-1 text-sm font-bold sm:mt-3 ${complete ? "text-foreground" : "text-muted"}`}>{statusLabel(stage, t)}</p>
          </li>
        );
      })}
      {cancelled ? <li className="rounded-2xl bg-[var(--ds-danger-soft)] p-4 text-sm font-bold text-danger sm:col-span-5">{t("account", "cancelled")}</li> : null}
    </ol>
  );
}

function statusLabel(status: string, t: ReturnType<typeof usePreferences>["t"]) {
  const labels = {
    payment_pending: t("account", "statusPaymentPending"),
    confirmed: t("account", "statusConfirmed"),
    processing: t("account", "statusProcessing"),
    ready_to_ship: t("account", "statusReadyToShip"),
    shipped: t("account", "statusShipped"),
    delivered: t("account", "statusDelivered"),
    cancelled: t("account", "cancelled"),
    return_requested: t("account", "statusReturnRequested"),
    returned: t("account", "statusReturned"),
  } as const;
  return labels[status as keyof typeof labels] ?? status.replaceAll("_", " ");
}

function ShipmentFact({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-end font-medium text-foreground">{value}</dd></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className={strong ? "font-bold text-foreground" : "text-muted"}>{label}</dt><dd className={strong ? "font-bold text-foreground" : "font-medium text-foreground"}>{value}</dd></div>;
}