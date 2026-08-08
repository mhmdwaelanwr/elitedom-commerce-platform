"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  cancelAccountOrder,
  fetchAccountOrder,
  fetchOrderTracking,
  type AccountOrder,
  type OrderTracking,
} from "@/lib/fulfillment-api";
import { formatDate, formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const CANCELLABLE_STATUSES = new Set(["payment_pending", "confirmed", "processing", "ready_to_ship"]);
const STAGES = ["confirmed", "processing", "ready_to_ship", "shipped", "delivered"];

export default function OrderDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const hasValidOrderId = Number.isInteger(orderId) && orderId > 0;
  const { locale, t } = usePreferences();
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
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchOrderData]);

  const canCancel = useMemo(
    () => Boolean(tracking && CANCELLABLE_STATUSES.has(tracking.fulfillment_status)),
    [tracking],
  );

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
      notify(
        result.payment_status === "refund_requested"
          ? t("account", "cancelledRefundPending")
          : t("account", "orderCancelled"),
        "success",
      );
      await reloadOrder();
    } catch {
      notify(t("account", "cancelOrderError"), "error");
    } finally {
      setCancelling(false);
    }
  }

  if (!session) {
    return (
      <main className="site-container grid min-h-[64vh] place-items-center py-14 text-center">
        <section className="w-full max-w-lg">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary"><PackageIcon large /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("account", "orderDetails")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{t("account", "ordersSignInText")}</p>
          <Link className="button-primary mt-6" href={`/signin?next=/account/orders/${params.orderId}`}>{t("account", "signIn")}</Link>
        </section>
      </main>
    );
  }

  if (isLoading && hasValidOrderId) {
    return (
      <main className="site-container py-10" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-elevated" />
        <div className="mt-6 h-72 animate-pulse rounded-3xl border border-border bg-surface" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_22rem]"><div className="h-72 animate-pulse rounded-2xl border border-border bg-surface"/><div className="h-72 animate-pulse rounded-2xl border border-border bg-surface"/></div>
      </main>
    );
  }

  if (!hasValidOrderId || error || !order || !tracking) {
    return (
      <main className="site-container py-12">
        <section className="rounded-3xl border border-danger/30 bg-danger/10 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface text-danger"><AlertIcon /></span>
          <h1 className="mt-4 text-2xl font-black text-foreground">{t("account", "orderLoadError")}</h1>
          <p className="mt-2 text-sm text-muted">{t("account", "orderLoadErrorDescription")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {hasValidOrderId ? <button className="button-primary" onClick={() => void reloadOrder()} type="button">{t("common", "retry")}</button> : null}
            <Link className="button-secondary" href="/account/orders">{t("account", "allOrders")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-container py-7 sm:py-10 lg:py-12">
      <Link className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-black text-primary hover:underline" href="/account/orders">
        <span aria-hidden="true" className="rtl:rotate-180">←</span>{t("account", "allOrders")}
      </Link>

      <header className="mt-5 flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="section-kicker">{t("account", "orderDetails")}</p>
            <StatusPill status={tracking.fulfillment_status} text={statusLabel(tracking.fulfillment_status, t)} />
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{order.name}</h1>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted"><CalendarIcon />{formatDate(order.created_at, locale)}</p>
        </div>
        {canCancel ? (
          <button className="button-secondary w-fit border-danger/35 text-danger disabled:cursor-wait disabled:opacity-60" disabled={isCancelling} onClick={handleCancel} type="button">
            {isCancelling ? t("account", "cancellingOrder") : t("account", "cancelOrder")}
          </button>
        ) : null}
      </header>

      <section className="mt-7 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker">{t("account", "orderTracking")}</p>
            <h2 className="mt-1 text-xl font-black text-foreground">{t("account", "fulfillmentProgress")}</h2>
          </div>
          {tracking.tracking_number ? (
            <div className="rounded-xl bg-elevated px-4 py-3 lg:text-end">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">{t("account", "trackingNumber")}</p>
              <p className="mt-1 font-mono text-sm font-black text-foreground">{tracking.tracking_number}</p>
              {tracking.carrier ? <p className="mt-1 text-xs text-muted">{tracking.carrier}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="p-5 sm:p-7"><FulfillmentTimeline status={tracking.fulfillment_status} t={t} /></div>
      </section>

      {tracking.shipments.length > 0 ? (
        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {tracking.shipments.map((shipment) => (
            <article className="rounded-2xl border border-border bg-surface p-5" key={shipment.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-primary"><TruckIcon /></span>
                <span className="rounded-full bg-[var(--ds-soft-primary)] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-primary">{shipment.status.replaceAll("_", " ")}</span>
              </div>
              <h3 className="mt-4 font-black text-foreground">{shipment.fulfillment_leg === "dropship" ? t("account", "supplierShipment") : t("account", "localShipment")}</h3>
              <dl className="mt-4 grid gap-2.5 text-sm">
                {shipment.carrier ? <ShipmentFact label={t("account", "carrier")} value={shipment.carrier} /> : null}
                {shipment.tracking_number ? <ShipmentFact label={t("account", "trackingNumber")} value={shipment.tracking_number} /> : null}
                {shipment.shipped_at ? <ShipmentFact label={t("account", "shippedAt")} value={formatDate(shipment.shipped_at, locale)} /> : null}
                {shipment.delivered_at ? <ShipmentFact label={t("account", "deliveredAt")} value={formatDate(shipment.delivered_at, locale)} /> : null}
              </dl>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-elevated px-4 py-3.5 text-sm text-muted"><span className="mt-0.5 text-primary"><ClockIcon /></span>{t("account", "trackingPending")}</div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-5 sm:px-6"><h2 className="text-xl font-black text-foreground">{t("account", "orderItems")}</h2></div>
          <div>
            {order.order_lines.map((line) => (
              <article className="grid gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6" key={line.id}>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-primary"><PackageIcon /></span>
                <div><p className="font-black text-foreground">{t("account", "productNumber")} {line.product_id}</p><p className="mt-1 text-xs text-muted">{t("account", "quantity")}: {line.quantity}</p></div>
                <p className="font-black text-foreground">{formatPrice(Number(line.line_total), currency, locale)}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-surface lg:sticky lg:top-28">
          <div className="border-b border-border px-6 py-5"><h2 className="text-lg font-black text-foreground">{t("account", "orderSummary")}</h2></div>
          <div className="p-6">
            <dl className="grid gap-3 text-sm">
              <SummaryRow label={t("account", "subtotal")} value={formatPrice(Number(order.amount_subtotal), currency, locale)} />
              <SummaryRow label={t("account", "shipping")} value={formatPrice(Number(order.amount_shipping), currency, locale)} />
              <SummaryRow label={t("account", "tax")} value={formatPrice(Number(order.amount_tax), currency, locale)} />
              <div className="my-1 border-t border-border" />
              <SummaryRow label={t("account", "total")} value={formatPrice(Number(order.amount_total), currency, locale)} strong />
              <SummaryRow label={t("account", "paymentStatus")} value={order.payment_status.replaceAll("_", " ")} />
            </dl>
            <div className="mt-6 rounded-xl bg-elevated p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted">{t("account", "deliveryAddress")}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{order.shipping_address}</p></div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function FulfillmentTimeline({ status, t }: { status: string; t: ReturnType<typeof usePreferences>["t"] }) {
  const currentIndex = STAGES.indexOf(status);
  const cancelled = status === "cancelled";
  return (
    <div>
      <ol className="grid gap-0 sm:grid-cols-5">
        {STAGES.map((stage, index) => {
          const complete = !cancelled && currentIndex >= index;
          const active = !cancelled && currentIndex === index;
          return (
            <li className="relative flex min-h-16 gap-3 pb-4 sm:block sm:min-h-0 sm:pb-0" key={stage}>
              {index < STAGES.length - 1 && <span className={`absolute start-[15px] top-8 h-[calc(100%-1rem)] w-px sm:start-8 sm:top-[15px] sm:h-px sm:w-[calc(100%-2rem)] ${complete && currentIndex > index ? "bg-primary" : "bg-border"}`} />}
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${complete ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted"}`}>{complete && currentIndex > index ? <CheckIcon /> : index + 1}{active && <span className="absolute inset-[-5px] rounded-full border border-primary/25" />}</span>
              <p className={`pt-1 text-sm font-black sm:mt-3 sm:pt-0 ${complete ? "text-foreground" : "text-muted"}`}>{statusLabel(stage, t)}</p>
            </li>
          );
        })}
      </ol>
      {cancelled ? <div className="mt-5 rounded-xl bg-danger/10 p-4 text-sm font-black text-danger">{t("account", "cancelled")}</div> : null}
    </div>
  );
}

function statusLabel(status: string, t: ReturnType<typeof usePreferences>["t"]) {
  const labels = {
    payment_pending: t("account", "statusPaymentPending"), confirmed: t("account", "statusConfirmed"), processing: t("account", "statusProcessing"), ready_to_ship: t("account", "statusReadyToShip"), shipped: t("account", "statusShipped"), delivered: t("account", "statusDelivered"), cancelled: t("account", "cancelled"), return_requested: t("account", "statusReturnRequested"), returned: t("account", "statusReturned"),
  } as const;
  return labels[status as keyof typeof labels] ?? status.replaceAll("_", " ");
}
function StatusPill({ status, text }: { status: string; text: string }) { const cls = status === "delivered" ? "bg-[var(--ds-soft-success)] text-success" : status === "cancelled" ? "bg-danger/10 text-danger" : status === "payment_pending" ? "bg-warning/10 text-warning" : "bg-[var(--ds-soft-primary)] text-primary"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${cls}`}>{text}</span>; }
function ShipmentFact({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-end font-semibold text-foreground">{value}</dd></div>; }
function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-4"><dt className={strong ? "font-black text-foreground" : "text-muted"}>{label}</dt><dd className={strong ? "text-lg font-black text-foreground" : "font-semibold text-foreground"}>{value}</dd></div>; }
function PackageIcon({ large = false }: { large?: boolean }) { const s = large ? 32 : 18; return <svg aria-hidden="true" fill="none" height={s} viewBox="0 0 24 24" width={s}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="m4 7 8 4 8-4M12 11v10" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/></svg>; }
function TruckIcon() { return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8"/></svg>; }
function CalendarIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5"/><path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>; }
function ClockIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>; }
function CheckIcon() { return <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13"><path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4"/></svg>; }
function AlertIcon() { return <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>; }
