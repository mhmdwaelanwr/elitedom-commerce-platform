"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { AdminError, AdminLoading, AdminPageHeader, StatusPill } from "@/components/admin/AdminPrimitives";
import {
  canAccessAdminSection,
  fetchAdminDashboard,
  type AdminDashboard,
} from "@/lib/admin-api";
import { formatAdminDate, formatEgp } from "@/lib/admin-ui";

export default function AdminDashboardPage() {
  const { session } = useStore();
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
      setError(requestError instanceof Error ? requestError.message : "Unexpected staff API error.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  return (
    <>
      <AdminPageHeader
        actions={<button className="button-secondary px-4 py-2.5 text-sm" onClick={() => void loadDashboard()} type="button">Refresh</button>}
        description="A live operating view of paid sales, customer demand, fulfilment pressure, and the queues that need a staff decision."
        eyebrow="Staff overview"
        title="Operations at a glance"
      />
      <div className="mt-7">
        {isLoading ? <AdminLoading label="Loading dashboard metrics…" /> : error ? <AdminError error={error} onRetry={() => void loadDashboard()} /> : dashboard ? <DashboardContent dashboard={dashboard} role={session?.role} /> : null}
      </div>
    </>
  );
}

function DashboardContent({ dashboard, role }: { dashboard: AdminDashboard; role?: string }) {
  const metrics = dashboard.metrics;
  const cards = [
    { label: "Paid revenue", value: formatEgp(metrics.paid_revenue, true), note: `${formatEgp(metrics.paid_revenue_today)} today`, href: undefined, tone: "cyan" },
    { label: "Orders", value: String(metrics.total_orders), note: `${metrics.orders_today} placed today`, href: "/admin/orders", section: "orders" as const, tone: "sky" },
    { label: "Awaiting dispatch", value: String(metrics.pending_shipments), note: `${metrics.pending_orders} orders still pending`, href: "/admin/shipments", section: "shipments" as const, tone: "amber" },
    { label: "Low stock", value: String(metrics.low_stock_products), note: "Local, non-dropship SKUs", href: "/admin/products?low_stock=true", section: "products" as const, tone: "rose" },
    { label: "RMA reviews", value: String(metrics.pending_rma_claims), note: "Claims awaiting support", href: "/admin/rma?status=pending_review", section: "rma" as const, tone: "violet" },
    { label: "Open RFQs", value: String(metrics.active_rfqs), note: "New or under review", href: "/admin/rfqs", section: "rfqs" as const, tone: "emerald" },
    { label: "Customers", value: String(metrics.total_customers), note: "B2C and institutional buyers", href: "/admin/customers", section: "customers" as const, tone: "slate" },
  ];

  return <div className="space-y-7">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const content = <><p className="text-sm font-semibold text-slate-400">{card.label}</p><p className="mt-3 text-3xl font-black tracking-tight text-white">{card.value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{card.note}</p></>;
        const access = !card.section || canAccessAdminSection(role, card.section);
        const className = `group rounded-2xl border p-5 transition ${toneClass(card.tone)} ${access && card.href ? "hover:-translate-y-0.5 hover:border-cyan-300/40 focus-ring" : ""}`;
        return access && card.href ? <Link className={className} href={card.href} key={card.label}>{content}</Link> : <article className={className} key={card.label}>{content}</article>;
      })}
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
      <RevenueTrend trend={dashboard.revenue_trend} />
      <QueueSummary metrics={metrics} role={role} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
      <RecentOrders orders={dashboard.recent_orders} canOpenOrders={canAccessAdminSection(role, "orders")} />
      <LowStock products={dashboard.low_stock} canOpenProducts={canAccessAdminSection(role, "products")} />
    </section>
  </div>;
}

function RevenueTrend({ trend }: { trend: AdminDashboard["revenue_trend"] }) {
  const highest = useMemo(() => Math.max(1, ...trend.map((point) => Number(point.paid_revenue))), [trend]);
  return <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-white">Paid revenue · last 7 days</h2><p className="mt-1 text-sm text-slate-500">Only verified paid transactions are counted here.</p></div><p className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-cyan-200">{formatEgp(trend.reduce((sum, point) => sum + Number(point.paid_revenue), 0))}</p></div><div className="mt-8 grid h-44 grid-cols-7 items-end gap-2 sm:gap-3">{trend.map((point) => { const amount = Number(point.paid_revenue); const height = amount > 0 ? Math.max(8, Math.round((amount / highest) * 100)) : 3; return <div className="group flex h-full min-w-0 flex-col justify-end" key={point.date}><div className="relative rounded-t-md bg-gradient-to-t from-sky-700 to-cyan-300/90 transition group-hover:from-sky-500 group-hover:to-cyan-100" style={{ height: `${height}%` }} title={`${formatAdminDate(point.date)}: ${formatEgp(amount)}`}><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-[10px] font-bold text-cyan-100 shadow-lg group-hover:block">{formatEgp(amount, true)}</span></div><p className="mt-2 truncate text-center text-[10px] font-bold text-slate-500">{formatAdminDate(point.date, { weekday: "short" })}</p><p className="truncate text-center text-[10px] text-slate-600">{point.orders} order{point.orders === 1 ? "" : "s"}</p></div>; })}</div></section>;
}

function QueueSummary({ metrics, role }: { metrics: AdminDashboard["metrics"]; role?: string }) {
  const queues = [
    { label: "Dispatch queue", value: metrics.pending_shipments, href: "/admin/shipments", section: "shipments" as const, description: "confirmed or COD orders" },
    { label: "Warranty reviews", value: metrics.pending_rma_claims, href: "/admin/rma?status=pending_review", section: "rma" as const, description: "customer evidence ready" },
    { label: "B2B opportunities", value: metrics.active_rfqs, href: "/admin/rfqs", section: "rfqs" as const, description: "awaiting a commercial action" },
  ].filter((item) => canAccessAdminSection(role, item.section));
  return <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-5 sm:p-6"><h2 className="font-black text-white">Your action queues</h2><p className="mt-1 text-sm text-slate-500">Open the relevant queue to work from the persisted record.</p><div className="mt-5 divide-y divide-slate-800">{queues.length ? queues.map((queue) => <Link className="group flex items-center justify-between gap-3 py-4 first:pt-0 focus-ring" href={queue.href} key={queue.label}><div><p className="font-bold text-slate-200 group-hover:text-cyan-200">{queue.label}</p><p className="mt-1 text-xs text-slate-500">{queue.description}</p></div><span className="grid h-9 min-w-9 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-sm font-black text-white group-hover:border-cyan-400/40">{queue.value}</span></Link>) : <p className="py-7 text-sm text-slate-500">This staff role has no assigned operational queues.</p>}</div></section>;
}

function RecentOrders({ canOpenOrders, orders }: { canOpenOrders: boolean; orders: AdminDashboard["recent_orders"] }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-6"><div><h2 className="font-black text-white">Latest orders</h2><p className="mt-1 text-sm text-slate-500">Fresh customer orders from the operational database.</p></div>{canOpenOrders ? <Link className="text-xs font-bold text-sky-300 hover:text-white focus-ring" href="/admin/orders">All orders →</Link> : null}</div>{orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Total</th></tr></thead><tbody className="divide-y divide-slate-800/80">{orders.map((order) => <tr className="hover:bg-slate-900/35" key={order.id}><td className="px-5 py-4"><p className="font-bold text-slate-100">{order.order_number}</p><p className="mt-1 text-xs text-slate-500">{formatAdminDate(order.created_at)}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{order.customer_name}</p><p className="mt-1 text-xs text-slate-500">{order.shipping_governorate ?? "Egypt"}</p></td><td className="px-4 py-4"><StatusPill value={order.state} /></td><td className="px-5 py-4 text-right font-black text-white">{formatEgp(order.amount_total)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">No operational orders have been recorded yet.</p>}</section>;
}

function LowStock({ canOpenProducts, products }: { canOpenProducts: boolean; products: AdminDashboard["low_stock"] }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">Low local stock</h2><p className="mt-1 text-sm text-slate-500">Threshold: five units or fewer.</p></div>{canOpenProducts ? <Link className="text-xs font-bold text-sky-300 hover:text-white focus-ring" href="/admin/products?low_stock=true">Review →</Link> : null}</div><div className="mt-5 space-y-3">{products.length ? products.map((product) => <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5" key={product.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-slate-100">{product.name}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{product.sku}</p></div><span className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-xs font-black text-rose-200">{product.stock_qty}</span></div><div className="mt-3 flex items-center justify-between text-xs"><StatusPill value={product.stock_health} /><span className="font-bold text-slate-400">{formatEgp(product.list_price)}</span></div></div>) : <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No low-stock local SKUs right now.</p>}</div></section>;
}

function toneClass(tone: string) {
  return {
    cyan: "border-cyan-400/20 bg-cyan-400/[0.04]",
    sky: "border-sky-400/20 bg-sky-400/[0.04]",
    amber: "border-amber-400/20 bg-amber-400/[0.04]",
    rose: "border-rose-400/20 bg-rose-400/[0.04]",
    violet: "border-violet-400/20 bg-violet-400/[0.04]",
    emerald: "border-emerald-400/20 bg-emerald-400/[0.04]",
    slate: "border-slate-700 bg-slate-900/35",
  }[tone] ?? "border-slate-700 bg-slate-900/35";
}
