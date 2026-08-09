import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { fetchLoyaltyBalance, type LoyaltyBalance } from "@/lib/account-api";
import { restoreSession } from "@/lib/auth-session";
import { fetchRichCatalog } from "@/lib/catalog-api";
import {
  cancelAccountOrder,
  fetchAccountOrder,
  fetchAccountOrders,
  fetchOrderTracking,
  type AccountOrder,
  type OrderTracking,
} from "@/lib/fulfillment-api";
import { redeemPointsForOrder } from "@/lib/loyalty-operations-api";
import type { CustomerSession, Product } from "@/types/store";
import { AccountPage } from "@/pages/AccountPage";
import "@/styles/p20-completeness.css";

type RemoteState = "loading" | "ready" | "error";

export function AccountEntryPage() {
  const [params] = useSearchParams();
  return params.get("section") === "orders" ? <AccountOrdersPage /> : <AccountPage />;
}

export function AccountOrdersPage() {
  const [locale, setLocale] = useStoreLocale();
  const navigate = useNavigate();
  const ar = locale === "ar";
  const [state, setState] = useState<RemoteState>("loading");
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (session) => {
      if (!active) return;
      if (!session) {
        navigate(`/auth?next=${encodeURIComponent("/account?section=orders")}`, { replace: true });
        return;
      }
      try {
        const result = await fetchAccountOrders(session, 100);
        if (!active) return;
        setOrders(result.orders);
        setState("ready");
      } catch (reason) {
        if (!active) return;
        setError(message(reason));
        setState("error");
      }
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="el-p20-store" dir={ar ? "rtl" : "ltr"} lang={locale} data-figma-node="247:3">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main className="el-p20-account-main">
          <div className="el-p20-breadcrumb"><Link to="/account">{ar ? "الحساب" : "Account"}</Link><span>/</span><b>{ar ? "الطلبات" : "Orders"}</b></div>
          <header className="el-p20-page-heading">
            <p className="el-p20-eyebrow">ACCOUNT / ORDERS</p>
            <h1>{ar ? "طلباتك وتتبعها" : "Orders & fulfilment"}</h1>
            <p>{ar ? "كل حالة هنا جاية من الطلب والشحن المسجلين فعليًا؛ تفاصيل الشحن تظهر داخل كل طلب." : "Every status comes from persisted order and fulfilment records; open an order for its shipment trail."}</p>
          </header>

          {state === "loading" ? <SurfaceState text={ar ? "بنحمّل طلباتك…" : "Loading your orders…"} /> : null}
          {state === "error" ? <SurfaceState error text={error} /> : null}
          {state === "ready" && !orders.length ? <SurfaceState text={ar ? "مفيش طلبات لسه." : "No orders yet."} action={{ href: "/catalog", label: ar ? "تصفح الكتالوج" : "Browse catalogue" }} /> : null}
          {state === "ready" && orders.length ? (
            <section className="el-p20-order-grid">
              {orders.map((order) => (
                <Link className="el-p20-order-card" key={order.id} to={`/account/orders/${order.id}`}>
                  <div><p>#{order.name}</p><h2>{money(order.amount_total, locale)} {order.currency}</h2></div>
                  <div className="el-p20-order-badges"><Status value={order.state} /><Status value={order.payment_status} /></div>
                  <dl><div><dt>{ar ? "التاريخ" : "Placed"}</dt><dd>{date(order.created_at, locale)}</dd></div><div><dt>{ar ? "التنفيذ" : "Fulfilment"}</dt><dd>{order.is_dropship ? (ar ? "توريد مباشر" : "Dropship") : (ar ? "مخزون محلي" : "Local stock")}</dd></div></dl>
                  <span className="el-p20-open-order">{ar ? "التفاصيل والتتبع" : "Details & tracking"}<StoreIcon name="arrow" size={16} /></span>
                </Link>
              ))}
            </section>
          ) : null}
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

export function AccountOrderDetailPage() {
  const [locale, setLocale] = useStoreLocale();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const ar = locale === "ar";
  const numericId = Number(orderId);
  const invalidOrderId = !Number.isInteger(numericId) || numericId < 1;
  const [state, setState] = useState<RemoteState>(invalidOrderId ? "error" : "loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [order, setOrder] = useState<AccountOrder | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyBalance | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<"cancel" | "redeem" | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (current: CustomerSession) => {
    const [orderResult, trackingResult, loyaltyResult, catalogResult] = await Promise.allSettled([
      fetchAccountOrder(numericId, current),
      fetchOrderTracking(numericId, current),
      fetchLoyaltyBalance(current),
      fetchRichCatalog({ locale, limit: 100 }),
    ] as const);
    if (orderResult.status === "rejected") throw orderResult.reason;
    setOrder(orderResult.value);
    setTracking(trackingResult.status === "fulfilled" ? trackingResult.value : null);
    setLoyalty(loyaltyResult.status === "fulfilled" ? loyaltyResult.value : null);
    setCatalog(catalogResult.status === "fulfilled" ? catalogResult.value : []);
  }, [locale, numericId]);

  useEffect(() => {
    if (invalidOrderId) return;
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active) return;
      if (!current) {
        navigate(`/auth?next=${encodeURIComponent(`/account/orders/${numericId}`)}`, { replace: true });
        return;
      }
      setSession(current);
      try {
        await load(current);
        if (active) setState("ready");
      } catch (reason) {
        if (!active) return;
        setError(message(reason));
        setState("error");
      }
    });
    return () => { active = false; };
  }, [invalidOrderId, load, navigate, numericId]);

  const products = useMemo(() => new Map(catalog.map((product) => [Number(product.id), product])), [catalog]);
  const canCancel = Boolean(order && !["done", "cancel"].includes(order.state) && tracking?.fulfillment_status !== "shipped" && tracking?.fulfillment_status !== "delivered");
  const canRedeem = Boolean(order && order.payment_status !== "paid" && order.state !== "cancel" && (loyalty?.points_balance ?? 0) >= 20);

  async function cancel() {
    if (!session || !order || !canCancel || !window.confirm(ar ? "إلغاء الطلب وإرجاع الحجز؟" : "Cancel this order and release its reservation?")) return;
    setBusy("cancel"); setActionError(""); setNotice("");
    try {
      await cancelAccountOrder(order.id, session);
      await load(session);
      setNotice(ar ? "تم تسجيل إلغاء الطلب." : "Order cancellation was recorded.");
    } catch (reason) { setActionError(message(reason)); }
    finally { setBusy(null); }
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !order || !canRedeem) return;
    const points = Number(new FormData(event.currentTarget).get("points"));
    if (!Number.isInteger(points) || points < 20 || points % 20 !== 0) {
      setActionError(ar ? "النقاط لازم تكون 20 أو أكثر وبمضاعفات 20." : "Points must be at least 20 and redeemed in multiples of 20.");
      return;
    }
    setBusy("redeem"); setActionError(""); setNotice("");
    try {
      const result = await redeemPointsForOrder(order.id, points, session);
      await load(session);
      setNotice(ar ? `تم استخدام ${format(result.points_used, locale)} نقطة وخصم ${money(result.discount_applied, locale)} EGP.` : `${format(result.points_used, locale)} points redeemed for ${money(result.discount_applied, locale)} EGP.`);
      event.currentTarget.reset();
    } catch (reason) { setActionError(message(reason)); }
    finally { setBusy(null); }
  }

  return (
    <div className="el-p20-store" dir={ar ? "rtl" : "ltr"} lang={locale} data-figma-node="247:3">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main className="el-p20-account-main">
          <div className="el-p20-breadcrumb"><Link to="/account?section=orders">{ar ? "الطلبات" : "Orders"}</Link><span>/</span><b>{order ? `#${order.name}` : `#${numericId}`}</b></div>
          {state === "loading" ? <SurfaceState text={ar ? "بنحمّل تفاصيل الطلب…" : "Loading order details…"} /> : null}
          {state === "error" ? <SurfaceState error text={invalidOrderId ? (ar ? "رقم الطلب غير صالح." : "Invalid order reference.") : error} action={{ href: "/account?section=orders", label: ar ? "العودة للطلبات" : "Back to orders" }} /> : null}
          {state === "ready" && order ? <>
            <header className="el-p20-page-heading el-p20-page-heading--order"><div><p className="el-p20-eyebrow">ACCOUNT / ORDER</p><h1>#{order.name}</h1><p>{date(order.created_at, locale)} · {order.shipping_governorate || (ar ? "عنوان الشحن المسجل" : "Saved shipping address")}</p></div><div className="el-p20-order-badges"><Status value={order.state} /><Status value={order.payment_status} /></div></header>
            {notice ? <p className="el-p20-notice" role="status">{notice}</p> : null}
            {actionError ? <p className="el-p20-error" role="alert">{actionError}</p> : null}
            <section className="el-p20-detail-grid">
              <article className="el-p20-panel">
                <div className="el-p20-panel__heading"><div><p className="el-p20-eyebrow">ORDER LINES</p><h2>{ar ? "محتويات الطلب" : "Order lines"}</h2></div><strong>{money(order.amount_total, locale)} {order.currency}</strong></div>
                <div className="el-p20-lines">{order.order_lines.map((line) => { const product = products.get(line.product_id); return <div key={line.id}><span><b dir="auto">{product?.name || `${ar ? "منتج" : "Product"} #${line.product_id}`}</b><small>{format(line.quantity, locale)} × {money(line.unit_price, locale)} {order.currency}</small></span><strong>{money(line.line_total, locale)} {order.currency}</strong></div>; })}</div>
                <dl className="el-p20-order-totals"><div><dt>{ar ? "قبل الشحن والضريبة" : "Subtotal"}</dt><dd>{money(order.amount_subtotal, locale)} {order.currency}</dd></div><div><dt>{ar ? "الشحن" : "Shipping"}</dt><dd>{money(order.amount_shipping, locale)} {order.currency}</dd></div><div><dt>{ar ? "الضريبة" : "Tax"}</dt><dd>{money(order.amount_tax, locale)} {order.currency}</dd></div><div><dt>{ar ? "الإجمالي" : "Total"}</dt><dd>{money(order.amount_total, locale)} {order.currency}</dd></div></dl>
              </article>
              <aside className="el-p20-panel">
                <div className="el-p20-panel__heading"><div><p className="el-p20-eyebrow">FULFILMENT</p><h2>{ar ? "التتبع" : "Tracking"}</h2></div></div>
                <TrackingTimeline tracking={tracking} ar={ar} locale={locale} />
                <div className="el-p20-address"><small>{ar ? "عنوان الشحن" : "Shipping address"}</small><p dir="auto">{order.shipping_address}</p></div>
                {canCancel ? <button className="el-p20-danger" disabled={busy !== null} onClick={() => void cancel()} type="button">{busy === "cancel" ? "…" : ar ? "إلغاء الطلب" : "Cancel order"}</button> : null}
              </aside>
            </section>
            <section className="el-p20-panel el-p20-loyalty-action">
              <div><p className="el-p20-eyebrow">LOYALTY / ORDER BOUND</p><h2>{ar ? "استخدام نقاطك" : "Redeem loyalty points"}</h2><p>{ar ? `رصيدك ${format(loyalty?.points_balance ?? 0, locale)} نقطة. الاستبدال متاح فقط على طلب مملوك لك وغير مدفوع، والباك إند يعيد التحقق قبل الخصم.` : `Balance: ${format(loyalty?.points_balance ?? 0, locale)} points. Redemption is limited to your own unpaid order and is revalidated server-side.`}</p></div>
              {canRedeem ? <form className="el-p20-inline-form" onSubmit={redeem}><input max={loyalty?.points_balance ?? undefined} min={20} name="points" placeholder={ar ? "مثال: 200" : "e.g. 200"} required step={20} type="number" /><button className="el-p20-primary" disabled={busy !== null} type="submit">{busy === "redeem" ? "…" : ar ? "استخدم النقاط" : "Redeem points"}</button></form> : <span className="el-p20-muted">{order.payment_status === "paid" ? (ar ? "الطلب مدفوع بالفعل." : "This order is already paid.") : (ar ? "الرصيد الحالي لا يسمح بالاستبدال." : "Current balance is not redeemable yet.")}</span>}
            </section>
          </> : null}
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function TrackingTimeline({ tracking, ar, locale }: { tracking: OrderTracking | null; ar: boolean; locale: "en" | "ar" }) {
  if (!tracking) return <p className="el-p20-muted">{ar ? "لا يوجد سجل شحن حتى الآن." : "No shipment has been recorded yet."}</p>;
  const rows = tracking.shipments.length ? tracking.shipments : [{ id: 0, fulfillment_leg: "order", status: tracking.status, carrier: tracking.carrier, tracking_number: tracking.tracking_number, external_reference: null, scheduled_at: tracking.scheduled_date, shipped_at: tracking.dispatched_at, delivered_at: tracking.delivered_at }];
  return <div className="el-p20-timeline">{rows.map((item) => <div key={`${item.id}-${item.status}`}><span className="el-p20-timeline__dot" /><div><b>{human(item.status)}</b><small>{item.carrier || human(item.fulfillment_leg)}{item.tracking_number ? ` · ${item.tracking_number}` : ""}</small><small>{item.delivered_at ? date(item.delivered_at, locale) : item.shipped_at ? date(item.shipped_at, locale) : item.scheduled_at ? date(item.scheduled_at, locale) : (ar ? "في انتظار تحديث" : "Awaiting update")}</small></div></div>)}</div>;
}

function SurfaceState({ text, error = false, action }: { text: string; error?: boolean; action?: { href: string; label: string } }) {
  return <section className={`el-p20-state${error ? " is-error" : ""}`}><StoreIcon name={error ? "returns" : "package"} size={34} /><p>{text}</p>{action ? <Link className="el-p20-primary" to={action.href}>{action.label}</Link> : null}</section>;
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = ["paid", "done", "delivered", "completed", "success"].some((item) => normalized.includes(item)) ? "success" : ["cancel", "reject", "fail"].some((item) => normalized.includes(item)) ? "danger" : ["pending", "draft", "sent"].some((item) => normalized.includes(item)) ? "warning" : "accent";
  return <span className={`el-p20-status is-${tone}`}>{human(value)}</span>;
}

function human(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "The requested account data could not be loaded."; }
function money(value: string | number, locale: "en" | "ar") { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 2 }).format(numeric) : String(value); }
function format(value: number, locale: "en" | "ar") { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value); }
function date(value: string, locale: "en" | "ar") { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
