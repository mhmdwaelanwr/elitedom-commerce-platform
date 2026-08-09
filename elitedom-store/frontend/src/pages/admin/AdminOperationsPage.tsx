import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  fetchAdminAccess,
  fetchAdminDashboard,
  fetchAdminOrders,
  type AdminAccess,
  type AdminDashboard,
  type AdminOrder,
  type AdminPermission,
} from "@/lib/admin-api";
import { clientEnv } from "@/lib/env";
import { fetchMfaStatus } from "@/lib/auth-api";
import { restoreSession } from "@/lib/auth-session";
import type { CustomerSession } from "@/types/store";
import { AdminConsolePage } from "@/pages/admin/AdminConsolePage";
import "@/styles/admin-operations.css";

const navItems: Array<{
  label: string;
  labelAr: string;
  icon: StoreIconName;
  href?: string;
  permission?: AdminPermission;
}> = [
  { label: "Dashboard", labelAr: "لوحة المتابعة", icon: "home", href: "/admin", permission: "dashboard.view" },
  { label: "Products", labelAr: "المنتجات", icon: "package", href: "/admin?section=products", permission: "catalog.view" },
  { label: "Catalog Editor", labelAr: "محرر الكتالوج", icon: "edit", href: "/admin?section=products", permission: "catalog.manage" },
  { label: "Orders", labelAr: "الطلبات", icon: "clipboard", href: "/admin?section=orders", permission: "orders.view" },
  { label: "Payments", labelAr: "المدفوعات", icon: "payment", permission: "payments.view" },
  { label: "Customers", labelAr: "العملاء", icon: "users", href: "/admin?section=customers", permission: "customers.view" },
  { label: "Inventory", labelAr: "المخزون", icon: "warehouse", href: "/admin?section=products", permission: "inventory.view" },
  { label: "Shipments", labelAr: "الشحنات", icon: "delivery", href: "/admin?section=shipments", permission: "shipments.view" },
  { label: "Dropshipping", labelAr: "التوريد المباشر", icon: "delivery", href: "/admin?section=shipments", permission: "shipments.view" },
  { label: "B2B / RFQ", labelAr: "الشركات / عروض الأسعار", icon: "briefcase", href: "/admin?section=rfqs", permission: "rfq.view" },
  { label: "RMA / Returns", labelAr: "المرتجعات / RMA", icon: "returns", href: "/admin?section=rma", permission: "support.view" },
  { label: "Suppliers", labelAr: "الموردون", icon: "building", permission: "suppliers.view" },
  { label: "Staff & Roles", labelAr: "الموظفون والصلاحيات", icon: "shield", href: "/admin?section=staff", permission: "staff.view" },
  { label: "Content", labelAr: "المحتوى", icon: "file", permission: "catalog.manage" },
  { label: "Integrations", labelAr: "التكاملات", icon: "plug", href: "/admin/launch", permission: "integrations.view" },
  { label: "Audit Log", labelAr: "سجل التدقيق", icon: "history", href: "/admin?section=audit", permission: "audit.view" },
  { label: "Launch Control", labelAr: "تحكم الإطلاق", icon: "rocket", href: "/admin/launch", permission: "config.manage" },
];

type RuntimeReadiness = {
  status: string;
  ready: boolean;
  dependencies?: Record<string, string>;
};

type PageState = "loading" | "ready" | "delegate" | "denied" | "error";

export function AdminRoutePage() {
  const [params] = useSearchParams();
  if (params.has("section")) return <AdminConsoleWithTheme />;
  return <AdminOperationsPage />;
}

function AdminConsoleWithTheme() {
  const [locale] = useStoreLocale();
  return (
    <div className="el-admin-console-frame">
      <ThemeToggle className="el-admin-console-theme" locale={locale} />
      <AdminConsolePage />
    </div>
  );
}

export function AdminOperationsPage() {
  const navigate = useNavigate();
  const [locale, setLocale] = useStoreLocale();
  const [state, setState] = useState<PageState>("loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [orders, setOrders] = useState<{ total: number; paid: number; recent: AdminOrder[] } | null>(null);
  const [readiness, setReadiness] = useState<RuntimeReadiness | null>(null);
  const [error, setError] = useState("");
  const ar = locale === "ar";

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then(async (current) => {
        if (!active) return;
        if (!current) {
          navigate(`/auth?next=${encodeURIComponent("/admin")}`, { replace: true });
          return;
        }
        const [resolvedAccess, mfa] = await Promise.all([
          fetchAdminAccess(current),
          fetchMfaStatus(current),
        ]);
        if (!active) return;
        if (!resolvedAccess.permissions.includes("dashboard.view")) {
          setState("denied");
          return;
        }
        if (mfa.required && !mfa.verified) {
          setState("delegate");
          return;
        }
        setSession(current);
        setAccess(resolvedAccess);
        const [snapshot, allOrders, paidOrders, runtime] = await Promise.all([
          fetchAdminDashboard(current),
          fetchAdminOrders(current, { page: 1 }),
          fetchAdminOrders(current, { page: 1, payment_status: "paid" }),
          fetchRuntimeReadiness(),
        ]);
        if (!active) return;
        setDashboard(snapshot);
        setOrders({ total: allOrders.total_count, paid: paidOrders.total_count, recent: snapshot.recent_orders });
        setReadiness(runtime);
        setState("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Operations dashboard could not be loaded.");
        setState("error");
      });
    return () => { active = false; };
  }, [navigate]);

  const paymentSuccess = useMemo(() => {
    if (!orders?.total) return null;
    return Math.round((orders.paid / orders.total) * 1000) / 10;
  }, [orders]);

  if (state === "delegate") return <AdminConsolePage />;
  if (state !== "ready" || !session || !access || !dashboard || !orders) {
    return <AdminOperationsGate error={error} locale={locale} state={state} />;
  }

  const visibleNav = navItems.filter((item) => !item.permission || access.permissions.includes(item.permission));
  const attention = dashboard.recent_orders.filter((order) => order.payment_status !== "paid" || ["draft", "sent"].includes(order.state)).slice(0, 5);
  const cairoDate = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  return (
    <div className="el-admin-ops" dir={ar ? "rtl" : "ltr"} lang={locale}>
      <aside className="el-admin-ops__sidebar">
        <div className="el-admin-ops__brand">
          <ElitedomBrand compact />
          <span><b>ELITEDOM OPS</b><small>{ar ? "الإدارة / RBAC / MFA" : "ADMIN / RBAC / MFA"}</small></span>
        </div>
        <nav aria-label={ar ? "أقسام الإدارة" : "Admin sections"}>
          {visibleNav.map((item) => item.href ? (
            <Link className={item.href === "/admin" ? "is-active" : ""} key={item.label} to={item.href}>
              <StoreIcon name={item.icon} size={18} />
              <span>{ar ? item.labelAr : item.label}</span>
            </Link>
          ) : (
            <span aria-disabled="true" className="is-disabled" key={item.label} title={ar ? "لا توجد شاشة تشغيل مستقلة لهذا القسم حاليًا" : "No separate operational view is exposed for this capability yet"}>
              <StoreIcon name={item.icon} size={18} />
              <span>{ar ? item.labelAr : item.label}</span>
            </span>
          ))}
        </nav>
      </aside>

      <main className="el-admin-ops__main">
        <header className="el-admin-ops__topbar">
          <div>
            <h1>{ar ? "لوحة العمليات" : "Operations dashboard"}</h1>
            <p>{cairoDate} · {ar ? "عمليات القاهرة" : "Cairo operations"}</p>
          </div>
          <div className="el-admin-ops__top-actions">
            <span className="el-admin-ops__mfa"><StoreIcon name="shield" size={14} />{ar ? "MFA مُتحقق" : "MFA VERIFIED"}</span>
            <ThemeToggle locale={locale} />
            <button aria-label={ar ? "Switch to English" : "التبديل إلى العربية"} onClick={() => setLocale(ar ? "en" : "ar")} type="button">{ar ? "EN" : "AR"}</button>
          </div>
        </header>

        <section className="el-admin-ops__kpis" aria-label={ar ? "مؤشرات العمليات" : "Operations KPIs"}>
          <OpsKpi label={ar ? "إيراد اليوم" : "TODAY REVENUE"} value={`${money(dashboard.metrics.paid_revenue_today, locale)} EGP`} meta={`${number(dashboard.metrics.orders_today, locale)} ${ar ? "طلب اليوم" : "orders today"}`} />
          <OpsKpi label={ar ? "الطلبات" : "ORDERS"} value={number(dashboard.metrics.orders_today, locale)} meta={`${number(dashboard.metrics.pending_orders, locale)} ${ar ? "تحتاج متابعة" : "need action"}`} />
          <OpsKpi label={ar ? "نجاح الدفع" : "PAYMENT SUCCESS"} value={paymentSuccess === null ? "—" : `${paymentSuccess}%`} meta={`${number(orders.paid, locale)} / ${number(orders.total, locale)} ${ar ? "طلبات مدفوعة" : "persisted orders paid"}`} />
          <OpsKpi label={ar ? "مخزون منخفض" : "LOW STOCK"} value={`${number(dashboard.metrics.low_stock_products, locale)} ${ar ? "منتج" : "SKUs"}`} meta={ar ? "من سجلات المخزون الفعلية" : "from persisted inventory"} />
        </section>

        <div className="el-admin-ops__row el-admin-ops__row--primary">
          <section className="el-admin-ops-card el-admin-ops-orders">
            <CardTitle title={ar ? "طلبات تحتاج متابعة" : "Orders requiring attention"} subtitle={ar ? "مشاكل الدفع والمخزون والتنفيذ تظهر الأول." : "Payment, stock and fulfilment exceptions surface first."} />
            <div className="el-admin-ops-orders__list">
              {attention.length ? attention.map((order) => (
                <Link key={order.id} to="/admin?section=orders">
                  <code>#{order.order_number}</code>
                  <span dir="auto">{order.customer_name}</span>
                  <strong>{money(order.amount_total, locale)} EGP</strong>
                  <b className={`is-${order.payment_status === "paid" ? "success" : "warning"}`}>{humanize(order.payment_status)}</b>
                </Link>
              )) : <p className="el-admin-ops__empty">{ar ? "مفيش طلبات حديثة محتاجة تدخل حاليًا." : "No recent orders currently require attention."}</p>}
            </div>
          </section>

          <section className="el-admin-ops-card el-admin-ops-health">
            <CardTitle title={ar ? "حالة التكاملات" : "Integration health"} />
            <HealthRow label="Store API" meta={ar ? "بيانات الإدارة متاحة" : "admin data reachable"} status={ar ? "متاح" : "Healthy"} tone="success" />
            <HealthRow label="PostgreSQL" meta={ar ? "فحص readiness" : "readiness check"} status={readiness?.dependencies?.postgres ?? "not asserted"} tone={readiness?.dependencies?.postgres === "ready" ? "success" : "muted"} />
            <HealthRow label="Redis" meta={ar ? "فحص readiness" : "readiness check"} status={readiness?.dependencies?.redis ?? "not asserted"} tone={readiness?.dependencies?.redis === "ready" ? "success" : "muted"} />
            <HealthRow label={ar ? "الدفع" : "Payments"} meta={`${number(orders.paid, locale)} / ${number(orders.total, locale)}`} status={paymentSuccess === null ? "—" : `${paymentSuccess}%`} tone="accent" />
            <HealthRow label="Odoo 17" meta={ar ? "يتحقق داخل release smoke" : "verified in release smoke"} status={ar ? "دليل إصدار" : "Release evidence"} tone="muted" />
            <HealthRow label={ar ? "الشحن والمزودون" : "Shipping / providers"} meta={ar ? "لا يتم افتراض صحة المزود من المتصفح" : "provider health is not inferred in-browser"} status={ar ? "نطاق الإصدار" : "Release-scoped"} tone="muted" />
          </section>
        </div>

        <div className="el-admin-ops__row el-admin-ops__row--secondary">
          <section className="el-admin-ops-card el-admin-ops-pulse">
            <CardTitle title={ar ? "نبض التنفيذ" : "Fulfilment pulse"} />
            <PulseRow label={ar ? "طلبات معلقة" : "Pending orders"} value={number(dashboard.metrics.pending_orders, locale)} meta={ar ? "من حالات الطلب الفعلية" : "persisted order states"} />
            <PulseRow label={ar ? "تسليم للشحن" : "Courier handoff"} value={number(dashboard.metrics.pending_shipments, locale)} meta={ar ? "شحنات معلقة" : "pending shipments"} />
            <PulseRow label={ar ? "طلبات أسعار الشركات" : "B2B RFQ queue"} value={number(dashboard.metrics.active_rfqs, locale)} meta={ar ? "عروض نشطة" : "active RFQs"} />
            <PulseRow label={ar ? "طابور RMA" : "RMA queue"} value={number(dashboard.metrics.pending_rma_claims, locale)} meta={ar ? "مراجعات معلقة" : "pending reviews"} />
          </section>

          <section className="el-admin-ops-card el-admin-ops-launch">
            <div className="el-admin-ops-launch__head"><CardTitle title={ar ? "تحكم الإطلاق" : "Launch control"} /><Link to="/admin/launch">{ar ? "فتح الأدلة" : "Open evidence"}<StoreIcon name="arrow" size={14} /></Link></div>
            <LaunchRow label={ar ? "نسخ واستعادة قاعدة البيانات" : "Database backup / restore"} />
            <LaunchRow label={ar ? "قبول مزود الدفع" : "Payment provider acceptance"} />
            <LaunchRow label="Google / Apple / OTP" />
            <LaunchRow label="Odoo roundtrip" />
            <LaunchRow label={ar ? "فحص HTTPS الخارجي" : "External HTTPS smoke"} />
          </section>
        </div>

        <p className="el-admin-ops__note">{ar ? "ملخص أولًا ← ثم تفاصيل التشغيل. لا نعرض حالات مزودين غير مؤكدة." : "Summary first → drill down for operational depth. Provider state is never invented by the browser."}</p>
      </main>
    </div>
  );
}

function OpsKpi({ label, value, meta }: { label: string; value: string; meta: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>;
}

function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <header className="el-admin-ops-card__title"><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</header>;
}

function HealthRow({ label, meta, status, tone }: { label: string; meta: string; status: string; tone: "success" | "accent" | "muted" }) {
  return <div className="el-admin-ops-health__row"><span><b>{label}</b><small>{meta}</small></span><strong className={`is-${tone}`}>{status}</strong></div>;
}

function PulseRow({ label, value, meta }: { label: string; value: string; meta: string }) {
  return <div className="el-admin-ops-pulse__row"><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>;
}

function LaunchRow({ label }: { label: string }) {
  return <div className="el-admin-ops-launch__row"><span>{label}</span><strong>Release-scoped</strong></div>;
}

function AdminOperationsGate({ locale, state, error }: { locale: "en" | "ar"; state: PageState; error: string }) {
  const ar = locale === "ar";
  const label = state === "loading"
    ? (ar ? "جارٍ التحقق من صلاحيات لوحة العمليات…" : "Verifying operations access…")
    : state === "denied"
      ? (ar ? "الحساب لا يملك صلاحية لوحة العمليات." : "This account does not have operations-dashboard access.")
      : error || (ar ? "تعذر تحميل لوحة العمليات." : "Operations dashboard could not be loaded.");
  return <main className="el-admin-ops-gate" dir={ar ? "rtl" : "ltr"}><ElitedomBrand /><StoreIcon name={state === "denied" ? "lock" : "shield"} size={34} /><h1>{label}</h1>{state !== "loading" ? <Link to="/">{ar ? "العودة للمتجر" : "Back to store"}</Link> : null}</main>;
}

async function fetchRuntimeReadiness(): Promise<RuntimeReadiness | null> {
  const apiRoot = clientEnv.apiUrl.replace(/\/api\/v1\/?$/, "");
  try {
    const response = await fetch(`${apiRoot}/health/ready`, { credentials: "omit" });
    if (!response.ok) return null;
    return await response.json() as RuntimeReadiness;
  } catch {
    return null;
  }
}

function money(value: string | number, locale: "en" | "ar") {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function number(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
