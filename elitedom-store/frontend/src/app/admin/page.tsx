"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminError, AdminLoading, AdminPageHeader, StatusPill } from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import { canAccessAdminSection, fetchAdminDashboard, type AdminDashboard } from "@/lib/admin-api";
import { formatAdminDate, formatEgp } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminDashboardPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchAdminDashboard(session));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.unexpectedError);
    } finally {
      setLoading(false);
    }
  }, [copy.unexpectedError, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  return (
    <>
      <AdminPageHeader
        actions={<button className="button-secondary px-4 py-2 text-sm" onClick={() => void loadDashboard()} type="button"><RefreshIcon />{copy.refresh}</button>}
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />
      <div className="mt-6">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void loadDashboard()} />
        ) : dashboard ? (
          <DashboardContent copy={copy} dashboard={dashboard} role={session?.role} />
        ) : null}
      </div>
    </>
  );
}

function DashboardContent({
  copy,
  dashboard,
  role,
}: {
  copy: DashboardCopy;
  dashboard: AdminDashboard;
  role?: string;
}) {
  const metrics = dashboard.metrics;
  const cards = [
    { label: copy.paidRevenue, value: formatEgp(metrics.paid_revenue, true), note: `${formatEgp(metrics.paid_revenue_today)} ${copy.today}`, icon: <RevenueIcon /> },
    { label: copy.orders, value: String(metrics.total_orders), note: `${metrics.orders_today} ${copy.placedToday}`, href: "/admin/orders", section: "orders" as const, icon: <OrdersIcon /> },
    { label: copy.awaitingDispatch, value: String(metrics.pending_shipments), note: `${metrics.pending_orders} ${copy.pendingOrders}`, href: "/admin/shipments", section: "shipments" as const, icon: <TruckIcon /> },
    { label: copy.lowStock, value: String(metrics.low_stock_products), note: copy.localSkuNote, href: "/admin/products?low_stock=true", section: "products" as const, icon: <BoxIcon /> },
    { label: copy.rmaReviews, value: String(metrics.pending_rma_claims), note: copy.claimsAwaiting, href: "/admin/rma?status=pending_review", section: "rma" as const, icon: <ShieldIcon /> },
    { label: copy.openRfqs, value: String(metrics.active_rfqs), note: copy.rfqNote, href: "/admin/rfqs", section: "rfqs" as const, icon: <QuoteIcon /> },
    { label: copy.customers, value: String(metrics.total_customers), note: copy.customerNote, href: "/admin/customers", section: "customers" as const, icon: <UsersIcon /> },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const access = !card.section || canAccessAdminSection(role, card.section);
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-muted">{card.label}</p>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-elevated text-primary">{card.icon}</span>
              </div>
              <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{card.value}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{card.note}</p>
            </>
          );
          const className = "rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/35 hover:shadow-md";
          return access && card.href ? (
            <Link className={`focus-ring ${className}`} href={card.href} key={card.label}>{content}</Link>
          ) : (
            <article className={className} key={card.label}>{content}</article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <RevenueTrend copy={copy} trend={dashboard.revenue_trend} />
        <QueueSummary copy={copy} metrics={metrics} role={role} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <RecentOrders copy={copy} orders={dashboard.recent_orders} canOpenOrders={canAccessAdminSection(role, "orders")} />
        <LowStock copy={copy} products={dashboard.low_stock} canOpenProducts={canAccessAdminSection(role, "products")} />
      </section>
    </div>
  );
}

function RevenueTrend({ copy, trend }: { copy: DashboardCopy; trend: AdminDashboard["revenue_trend"] }) {
  const highest = useMemo(() => Math.max(1, ...trend.map((point) => Number(point.paid_revenue))), [trend]);
  const total = trend.reduce((sum, point) => sum + Number(point.paid_revenue), 0);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-foreground">{copy.revenueSevenDays}</h2>
          <p className="mt-1 text-sm text-muted">{copy.verifiedPaidOnly}</p>
        </div>
        <div className="text-end">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{copy.periodTotal}</p>
          <p className="mt-1 text-lg font-black text-foreground">{formatEgp(total)}</p>
        </div>
      </div>

      <div className="mt-7 grid h-48 grid-cols-7 items-end gap-2 sm:gap-3">
        {trend.map((point) => {
          const amount = Number(point.paid_revenue);
          const height = amount > 0 ? Math.max(7, Math.round((amount / highest) * 100)) : 2;
          return (
            <div className="group flex h-full min-w-0 flex-col justify-end" key={point.date}>
              <div className="relative w-full rounded-t-md bg-primary/80 transition group-hover:bg-primary" style={{ height: `${height}%` }} title={`${formatAdminDate(point.date)}: ${formatEgp(amount)}`}>
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-bold text-foreground shadow-lg group-hover:block">
                  {formatEgp(amount, true)}
                </span>
              </div>
              <p className="mt-2 truncate text-center text-[10px] font-bold text-muted">{formatAdminDate(point.date, { weekday: "short" })}</p>
              <p className="truncate text-center text-[9px] text-muted">{point.orders}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QueueSummary({
  copy,
  metrics,
  role,
}: {
  copy: DashboardCopy;
  metrics: AdminDashboard["metrics"];
  role?: string;
}) {
  const queues = [
    { label: copy.dispatchQueue, value: metrics.pending_shipments, href: "/admin/shipments", section: "shipments" as const, description: copy.dispatchDescription },
    { label: copy.warrantyReviews, value: metrics.pending_rma_claims, href: "/admin/rma?status=pending_review", section: "rma" as const, description: copy.warrantyDescription },
    { label: copy.b2bOpportunities, value: metrics.active_rfqs, href: "/admin/rfqs", section: "rfqs" as const, description: copy.b2bDescription },
  ].filter((item) => canAccessAdminSection(role, item.section));

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="font-black text-foreground">{copy.actionQueues}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{copy.actionQueuesDescription}</p>
      <div className="mt-4 divide-y divide-border">
        {queues.length ? queues.map((queue) => (
          <Link className="group flex items-center justify-between gap-3 py-4 first:pt-0 focus-ring" href={queue.href} key={queue.label}>
            <div className="min-w-0">
              <p className="font-bold text-foreground group-hover:text-primary">{queue.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{queue.description}</p>
            </div>
            <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-elevated px-2 text-sm font-black text-primary">{queue.value}</span>
          </Link>
        )) : <p className="py-7 text-sm text-muted">{copy.noQueues}</p>}
      </div>
    </section>
  );
}

function RecentOrders({
  canOpenOrders,
  copy,
  orders,
}: {
  canOpenOrders: boolean;
  copy: DashboardCopy;
  orders: AdminDashboard["recent_orders"];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div><h2 className="font-black text-foreground">{copy.latestOrders}</h2><p className="mt-1 text-xs text-muted">{copy.latestOrdersDescription}</p></div>
        {canOpenOrders ? <Link className="focus-ring inline-flex items-center gap-1 text-xs font-bold text-primary" href="/admin/orders">{copy.allOrders}<ArrowIcon /></Link> : null}
      </div>
      {orders.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-start text-sm">
            <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
              <tr><th className="px-5 py-3 text-start font-black">{copy.order}</th><th className="px-4 py-3 text-start font-black">{copy.customer}</th><th className="px-4 py-3 text-start font-black">{copy.status}</th><th className="px-5 py-3 text-end font-black">{copy.total}</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr className="hover:bg-elevated/40" key={order.id}>
                  <td className="px-5 py-4"><p className="font-bold text-foreground">{order.order_number}</p><p className="mt-1 text-xs text-muted">{formatAdminDate(order.created_at)}</p></td>
                  <td className="px-4 py-4"><p className="font-semibold text-foreground">{order.customer_name}</p><p className="mt-1 text-xs text-muted">{order.shipping_governorate ?? "Egypt"}</p></td>
                  <td className="px-4 py-4"><StatusPill value={order.state} /></td>
                  <td className="px-5 py-4 text-end font-black text-foreground">{formatEgp(order.amount_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="p-8 text-center text-sm text-muted">{copy.noOrders}</p>}
    </section>
  );
}

function LowStock({
  canOpenProducts,
  copy,
  products,
}: {
  canOpenProducts: boolean;
  copy: DashboardCopy;
  products: AdminDashboard["low_stock"];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-black text-foreground">{copy.lowLocalStock}</h2><p className="mt-1 text-xs text-muted">{copy.stockThreshold}</p></div>
        {canOpenProducts ? <Link className="focus-ring inline-flex items-center gap-1 text-xs font-bold text-primary" href="/admin/products?low_stock=true">{copy.review}<ArrowIcon /></Link> : null}
      </div>
      <div className="mt-4 space-y-2.5">
        {products.length ? products.map((product) => (
          <div className="rounded-lg border border-border bg-elevated/45 p-3.5" key={product.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-bold text-foreground">{product.name}</p><p className="mt-1 font-mono text-[10px] text-muted">{product.sku}</p></div>
              <span className="rounded-md bg-danger/10 px-2 py-1 text-xs font-black text-danger">{product.stock_qty}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs"><StatusPill value={product.stock_health} /><span className="font-bold text-foreground">{formatEgp(product.list_price)}</span></div>
          </div>
        )) : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted">{copy.noLowStock}</p>}
      </div>
    </section>
  );
}

type DashboardCopy = typeof EN_COPY;

const EN_COPY = {
  eyebrow: "Staff overview",
  title: "Operations at a glance",
  description: "A live operating view of paid sales, customer demand, fulfilment pressure, and the queues that need a staff decision.",
  refresh: "Refresh",
  loading: "Loading dashboard metrics…",
  unexpectedError: "Unexpected staff API error.",
  paidRevenue: "Paid revenue",
  today: "today",
  orders: "Orders",
  placedToday: "placed today",
  awaitingDispatch: "Awaiting dispatch",
  pendingOrders: "orders still pending",
  lowStock: "Low stock",
  localSkuNote: "Local, non-dropship SKUs",
  rmaReviews: "RMA reviews",
  claimsAwaiting: "Claims awaiting support",
  openRfqs: "Open RFQs",
  rfqNote: "New or under review",
  customers: "Customers",
  customerNote: "B2C and institutional buyers",
  revenueSevenDays: "Paid revenue · last 7 days",
  verifiedPaidOnly: "Only verified paid transactions are counted here.",
  periodTotal: "Period total",
  actionQueues: "Your action queues",
  actionQueuesDescription: "Open the relevant queue to work from persisted operational records.",
  dispatchQueue: "Dispatch queue",
  dispatchDescription: "Confirmed or COD orders",
  warrantyReviews: "Warranty reviews",
  warrantyDescription: "Customer evidence ready",
  b2bOpportunities: "B2B opportunities",
  b2bDescription: "Awaiting a commercial action",
  noQueues: "This staff role has no assigned operational queues.",
  latestOrders: "Latest orders",
  latestOrdersDescription: "Fresh customer orders from the operational database.",
  allOrders: "All orders",
  order: "Order",
  customer: "Customer",
  status: "Status",
  total: "Total",
  noOrders: "No operational orders have been recorded yet.",
  lowLocalStock: "Low local stock",
  stockThreshold: "Threshold: five units or fewer.",
  review: "Review",
  noLowStock: "No low-stock local SKUs right now.",
} as const;

const AR_COPY: DashboardCopy = {
  eyebrow: "نظرة فريق التشغيل",
  title: "العمليات في لمحة واحدة",
  description: "عرض تشغيلي مباشر للمبيعات المدفوعة وطلب العملاء وضغط التنفيذ وقوائم العمل التي تحتاج قرارًا من الفريق.",
  refresh: "تحديث",
  loading: "جارٍ تحميل مؤشرات لوحة التحكم…",
  unexpectedError: "حدث خطأ غير متوقع في واجهة الإدارة.",
  paidRevenue: "الإيراد المدفوع",
  today: "اليوم",
  orders: "الطلبات",
  placedToday: "طلبات اليوم",
  awaitingDispatch: "بانتظار الشحن",
  pendingOrders: "طلبات ما زالت معلقة",
  lowStock: "مخزون منخفض",
  localSkuNote: "منتجات محلية غير Dropship",
  rmaReviews: "مراجعات RMA",
  claimsAwaiting: "طلبات بانتظار الدعم",
  openRfqs: "عروض أسعار مفتوحة",
  rfqNote: "جديدة أو قيد المراجعة",
  customers: "العملاء",
  customerNote: "عملاء أفراد ومؤسسات",
  revenueSevenDays: "الإيراد المدفوع · آخر 7 أيام",
  verifiedPaidOnly: "يتم احتساب المعاملات المدفوعة والمتحقق منها فقط.",
  periodTotal: "إجمالي الفترة",
  actionQueues: "قوائم العمل المطلوبة",
  actionQueuesDescription: "افتح قائمة العمل المناسبة للتعامل مع السجلات التشغيلية المحفوظة.",
  dispatchQueue: "قائمة الشحن",
  dispatchDescription: "طلبات مؤكدة أو دفع عند الاستلام",
  warrantyReviews: "مراجعات الضمان",
  warrantyDescription: "أدلة العميل جاهزة للمراجعة",
  b2bOpportunities: "فرص B2B",
  b2bDescription: "بانتظار إجراء تجاري",
  noQueues: "لا توجد قوائم تشغيل مخصصة لهذا الدور.",
  latestOrders: "أحدث الطلبات",
  latestOrdersDescription: "أحدث طلبات العملاء من قاعدة البيانات التشغيلية.",
  allOrders: "كل الطلبات",
  order: "الطلب",
  customer: "العميل",
  status: "الحالة",
  total: "الإجمالي",
  noOrders: "لا توجد طلبات تشغيلية مسجلة حتى الآن.",
  lowLocalStock: "المخزون المحلي المنخفض",
  stockThreshold: "الحد: خمس وحدات أو أقل.",
  review: "مراجعة",
  noLowStock: "لا توجد منتجات محلية منخفضة المخزون حاليًا.",
};

function RefreshIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M20 6v5h-5M4 18v-5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><path d="M18.2 9a7 7 0 0 0-12-2M5.8 15a7 7 0 0 0 12 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function ArrowIcon() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function MetricIcon({ children }: { children: ReactNode }) { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{children}</svg>; }
function RevenueIcon() { return <MetricIcon><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /></MetricIcon>; }
function OrdersIcon() { return <MetricIcon><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></MetricIcon>; }
function TruckIcon() { return <MetricIcon><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></MetricIcon>; }
function BoxIcon() { return <MetricIcon><path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" /></MetricIcon>; }
function ShieldIcon() { return <MetricIcon><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" /></MetricIcon>; }
function QuoteIcon() { return <MetricIcon><path d="M5 5h14v10H9l-4 4V5ZM9 9h.01M15 9h.01" /></MetricIcon>; }
function UsersIcon() { return <MetricIcon><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="3.2" /><path d="M17 10a3 3 0 0 0 0-6M21 20v-1.3a4.2 4.2 0 0 0-2.5-3.9" /></MetricIcon>; }
