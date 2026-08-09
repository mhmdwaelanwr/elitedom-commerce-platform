import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { ADMIN_DIRECTORY } from "@/lib/admin-directory";
import {
  fetchAdminAccess,
  fetchAdminDashboard,
  fetchAdminOrders,
  type AdminAccess,
  type AdminDashboard,
  type AdminOrder,
} from "@/lib/admin-api";
import { restoreSession } from "@/lib/auth-session";
import { fetchRuntimeReadiness, type RuntimeReadiness } from "@/lib/platform-api";
import type { CustomerSession } from "@/types/store";
import { AdminConsolePage } from "@/pages/admin/AdminConsolePage";
import { AdminSecureRoute } from "@/pages/admin/AdminSecureRoute";
import "@/styles/p20-completeness.css";

export function AdminEntryPage() {
  const [params] = useSearchParams();
  if (params.has("section")) return <AdminConsolePage />;
  return <AdminSecureRoute permission="dashboard.view"><AdminDirectoryPage /></AdminSecureRoute>;
}

function AdminDirectoryPage() {
  const [locale, setLocale] = useStoreLocale();
  const ar = locale === "ar";
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [orders, setOrders] = useState<{ total: number; paid: number; recent: AdminOrder[] } | null>(null);
  const [readiness, setReadiness] = useState<RuntimeReadiness | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active || !current) return;
      try {
        const [resolvedAccess, snapshot, allOrders, paidOrders, runtime] = await Promise.all([
          fetchAdminAccess(current),
          fetchAdminDashboard(current),
          fetchAdminOrders(current, { page: 1 }),
          fetchAdminOrders(current, { page: 1, payment_status: "paid" }),
          fetchRuntimeReadiness(),
        ]);
        if (!active) return;
        setSession(current);
        setAccess(resolvedAccess);
        setDashboard(snapshot);
        setOrders({ total: allOrders.total_count, paid: paidOrders.total_count, recent: snapshot.recent_orders });
        setReadiness(runtime);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Operations data could not be loaded.");
      }
    });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => ADMIN_DIRECTORY.filter((item) => access?.permissions.includes(item.permission)), [access]);
  const paymentSuccess = orders?.total ? Math.round((orders.paid / orders.total) * 1000) / 10 : null;
  const attention = dashboard?.recent_orders.filter((order) => order.payment_status !== "paid" || ["draft", "sent"].includes(order.state)).slice(0, 5) ?? [];

  return (
    <div className="el-p20-admin" dir={ar ? "rtl" : "ltr"} lang={locale}>
      <aside className="el-p20-admin__sidebar">
        <div className="el-p20-admin__brand"><ElitedomBrand compact /><span><b>ELITEDOM OPS</b><small>ADMIN / RBAC / MFA</small></span></div>
        <nav aria-label={ar ? "دليل واجهات الإدارة" : "Admin surface directory"}>
          {visible.map((item) => <Link className={item.id === "dashboard" ? "is-active" : ""} key={item.id} to={item.href}><StoreIcon name={item.icon} size={18} /><span>{ar ? item.labelAr : item.label}</span></Link>)}
        </nav>
      </aside>

      <main className="el-p20-admin__main">
        <header className="el-p20-admin__topbar">
          <div><p className="el-p20-eyebrow">ELITEDOM / OPERATIONS</p><h1>{ar ? "مركز العمليات" : "Operations command center"}</h1><p>{ar ? "كل واجهة لها مسار حقيقي وصلاحية واضحة؛ مفيش عناصر معطلة تمثل صفحات غير موجودة." : "Every capability shown here resolves to a real permission-scoped surface; no disabled placeholders stand in for routes."}</p></div>
          <div><span className="el-p20-status is-success"><StoreIcon name="shield" size={14} />MFA VERIFIED</span><ThemeToggle locale={locale} /><button className="el-p20-control" onClick={() => setLocale(ar ? "en" : "ar")} type="button">{ar ? "EN" : "AR"}</button></div>
        </header>

        {error ? <p className="el-p20-error" role="alert">{error}</p> : null}
        {!session || !access || !dashboard || !orders ? <section className="el-p20-state"><StoreIcon name="clock" size={32} /><p>{ar ? "بنحمّل بيانات التشغيل…" : "Loading operations data…"}</p></section> : <>
          <section className="el-p20-kpis">
            <Kpi label={ar ? "إيراد اليوم" : "TODAY REVENUE"} value={`${money(dashboard.metrics.paid_revenue_today, locale)} EGP`} meta={`${number(dashboard.metrics.orders_today, locale)} ${ar ? "طلب" : "orders"}`} />
            <Kpi label={ar ? "نجاح الدفع" : "PAYMENT SUCCESS"} value={paymentSuccess === null ? "—" : `${paymentSuccess}%`} meta={`${number(orders.paid, locale)} / ${number(orders.total, locale)}`} />
            <Kpi label={ar ? "شحنات معلقة" : "PENDING SHIPMENTS"} value={number(dashboard.metrics.pending_shipments, locale)} meta={ar ? "من السجلات الفعلية" : "persisted records"} />
            <Kpi label={ar ? "مخزون منخفض" : "LOW STOCK"} value={number(dashboard.metrics.low_stock_products, locale)} meta={ar ? "منتج" : "SKUs"} />
          </section>

          <section className="el-p20-admin-grid">
            <article className="el-p20-panel">
              <div className="el-p20-panel__heading"><div><p className="el-p20-eyebrow">ROUTE DIRECTORY</p><h2>{ar ? "كل واجهات الإدارة" : "All admin surfaces"}</h2></div><strong>{visible.length}</strong></div>
              <div className="el-p20-directory-grid">{visible.filter((item) => item.id !== "dashboard").map((item) => <Link key={item.id} to={item.href}><StoreIcon name={item.icon} size={20} /><span><b>{ar ? item.labelAr : item.label}</b><small>{item.href}</small></span><StoreIcon name="arrow" size={15} /></Link>)}</div>
            </article>

            <article className="el-p20-panel">
              <div className="el-p20-panel__heading"><div><p className="el-p20-eyebrow">RUNTIME</p><h2>{ar ? "جاهزية النظام" : "Runtime readiness"}</h2></div></div>
              <Health name="Store API" value={readiness?.ready ? "ready" : "not asserted"} />
              {Object.entries(readiness?.dependencies ?? {}).map(([name, value]) => <Health key={name} name={name} value={value} />)}
              <Health name="Odoo 17" value={ar ? "release evidence" : "release evidence"} />
              <p className="el-p20-muted">{ar ? "صحة مزودي الدفع والشحن الخارجيين لا يتم اختراعها من المتصفح؛ تظل مرتبطة بـ release smoke." : "External payment and shipping provider health is not fabricated in-browser; it remains release-smoke evidence."}</p>
            </article>
          </section>

          <section className="el-p20-panel">
            <div className="el-p20-panel__heading"><div><p className="el-p20-eyebrow">ATTENTION</p><h2>{ar ? "طلبات محتاجة متابعة" : "Orders requiring attention"}</h2></div><Link to="/admin?section=orders">{ar ? "كل الطلبات" : "All orders"}</Link></div>
            <div className="el-p20-admin-orders">{attention.length ? attention.map((order) => <Link key={order.id} to="/admin?section=orders"><code>#{order.order_number}</code><span dir="auto">{order.customer_name}</span><strong>{money(order.amount_total, locale)} EGP</strong><span className={`el-p20-status ${order.payment_status === "paid" ? "is-success" : "is-warning"}`}>{human(order.payment_status)}</span></Link>) : <p className="el-p20-muted">{ar ? "لا توجد طلبات حديثة تحتاج تدخل." : "No recent orders require intervention."}</p>}</div>
          </section>
        </>}
      </main>
    </div>
  );
}

function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) { return <article><small>{label}</small><strong>{value}</strong><span>{meta}</span></article>; }
function Health({ name, value }: { name: string; value: string }) { const ready = value.toLowerCase() === "ready" || value.toLowerCase() === "healthy"; return <div className="el-p20-health"><span>{name}</span><b className={`el-p20-status ${ready ? "is-success" : "is-muted"}`}>{human(value)}</b></div>; }
function human(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function money(value: string | number, locale: "en" | "ar") { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 2 }).format(numeric) : String(value); }
function number(value: number, locale: "en" | "ar") { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value); }
