import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  fetchAdminAccess,
  fetchAdminAuditLogs,
  fetchAdminOrders,
  fetchAdminProducts,
  type AdminAccess,
  type AdminAuditLog,
  type AdminOrder,
  type AdminPermission,
  type AdminProduct,
} from "@/lib/admin-api";
import { fetchMfaStatus } from "@/lib/auth-api";
import { restoreSession } from "@/lib/auth-session";
import {
  fetchCatalogAdminAttributes,
  fetchCatalogAdminCategories,
  fetchInventoryReport,
  fetchPaymentTrail,
  fetchPurchaseOrders,
  fetchReportingDashboard,
  fetchRmaReport,
  fetchRuntimeReadiness,
  fetchSupplierReport,
  fetchSuppliers,
  requestPaymentRefund,
  type CatalogAdminAttribute,
  type CatalogAdminCategory,
  type InventoryReport,
  type PaymentTrail,
  type PurchaseOrderRecord,
  type ReportingDashboard,
  type RmaReport,
  type RuntimeReadiness,
  type SupplierRecord,
  type SupplierReport,
} from "@/lib/platform-api";
import type { CustomerSession } from "@/types/store";
import "@/styles/platform-surfaces.css";

export type AdminPlatformKind = "payments" | "inventory" | "suppliers" | "reports" | "catalog" | "integrations";
type State = "loading" | "ready" | "denied" | "error";
type PlatformData = {
  orders?: AdminOrder[];
  paymentTrails?: PaymentTrail[];
  products?: AdminProduct[];
  inventory?: InventoryReport;
  suppliers?: SupplierRecord[];
  purchaseOrders?: PurchaseOrderRecord[];
  supplierReport?: SupplierReport;
  reporting?: ReportingDashboard;
  rmaReport?: RmaReport;
  categories?: CatalogAdminCategory[];
  attributes?: CatalogAdminAttribute[];
  readiness?: RuntimeReadiness | null;
  audit?: AdminAuditLog[];
  limited?: string[];
};

type PageConfig = {
  icon: StoreIconName;
  permission: AdminPermission;
  eyebrow: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  figmaNode: string;
};

const config: Record<AdminPlatformKind, PageConfig> = {
  payments: { icon: "payment", permission: "payments.view", eyebrow: "PAYMENT OPERATIONS", title: "Payments", titleAr: "المدفوعات", description: "Provider-neutral settlement, attempts and audited refund requests.", descriptionAr: "التسويات ومحاولات الدفع وطلبات الاسترداد المراجعة بدون كشف اسم البوابة للعميل.", figmaNode: "244:296" },
  inventory: { icon: "warehouse", permission: "inventory.view", eyebrow: "INVENTORY CONTROL", title: "Inventory", titleAr: "المخزون", description: "Persisted stock health, low-stock exceptions and catalogue coverage.", descriptionAr: "حالة المخزون الفعلية وتنبيهات النقص وتغطية الكتالوج من السجلات الحقيقية.", figmaNode: "244:589" },
  suppliers: { icon: "building", permission: "suppliers.view", eyebrow: "SUPPLIER & PROCUREMENT", title: "Suppliers & procurement", titleAr: "الموردون والمشتريات", description: "Verified suppliers, purchase orders and delivery performance.", descriptionAr: "الموردون الموثقون وأوامر الشراء وأداء التسليم.", figmaNode: "244:882" },
  reports: { icon: "file", permission: "reports.view", eyebrow: "REPORTING & ANALYTICS", title: "Reporting", titleAr: "التقارير والتحليلات", description: "Operational sales, inventory and RMA reporting from persisted records.", descriptionAr: "تقارير المبيعات والمخزون وRMA من السجلات المحفوظة فعليًا.", figmaNode: "244:1175" },
  catalog: { icon: "edit", permission: "catalog.view", eyebrow: "CATALOG CONTROL", title: "Catalog editor", titleAr: "محرر الكتالوج", description: "Category and technical-attribute definitions powering the public catalogue.", descriptionAr: "تعريفات الأقسام والخصائص التقنية التي تغذي الكتالوج العام.", figmaNode: "245:533" },
  integrations: { icon: "plug", permission: "integrations.view", eyebrow: "INTEGRATIONS & AUDIT", title: "Integrations", titleAr: "التكاملات", description: "Runtime readiness plus immutable audit evidence. External provider health stays release-scoped.", descriptionAr: "جاهزية التشغيل مع سجل تدقيق ثابت؛ صحة المزود الخارجي تظل مرتبطة بأدلة الإصدار.", figmaNode: "244:2347" },
};

const navigation: Array<{ kind?: AdminPlatformKind; label: string; labelAr: string; icon: StoreIconName; href: string; permission: AdminPermission }> = [
  { label: "Dashboard", labelAr: "لوحة المتابعة", icon: "home", href: "/admin", permission: "dashboard.view" },
  { label: "Orders", labelAr: "الطلبات", icon: "clipboard", href: "/admin?section=orders", permission: "orders.view" },
  { kind: "catalog", label: "Catalog", labelAr: "الكتالوج", icon: "edit", href: "/admin/catalog", permission: "catalog.view" },
  { kind: "inventory", label: "Inventory", labelAr: "المخزون", icon: "warehouse", href: "/admin/inventory", permission: "inventory.view" },
  { kind: "payments", label: "Payments", labelAr: "المدفوعات", icon: "payment", href: "/admin/payments", permission: "payments.view" },
  { label: "Customers", labelAr: "العملاء", icon: "users", href: "/admin?section=customers", permission: "customers.view" },
  { label: "Shipments", labelAr: "الشحنات", icon: "delivery", href: "/admin?section=shipments", permission: "shipments.view" },
  { kind: "suppliers", label: "Suppliers", labelAr: "الموردون", icon: "building", href: "/admin/suppliers", permission: "suppliers.view" },
  { label: "B2B / RFQ", labelAr: "الشركات / RFQ", icon: "briefcase", href: "/admin?section=rfqs", permission: "rfq.view" },
  { label: "RMA / Returns", labelAr: "المرتجعات / RMA", icon: "returns", href: "/admin?section=rma", permission: "support.view" },
  { kind: "reports", label: "Reports", labelAr: "التقارير", icon: "file", href: "/admin/reports", permission: "reports.view" },
  { label: "Staff & roles", labelAr: "الموظفون والصلاحيات", icon: "shield", href: "/admin?section=staff", permission: "staff.view" },
  { label: "Audit log", labelAr: "سجل التدقيق", icon: "history", href: "/admin?section=audit", permission: "audit.view" },
  { kind: "integrations", label: "Integrations", labelAr: "التكاملات", icon: "plug", href: "/admin/integrations", permission: "integrations.view" },
];

export function AdminPlatformPage({ kind }: { kind: AdminPlatformKind }) {
  const navigate = useNavigate();
  const [locale, setLocale] = useStoreLocale();
  const ar = locale === "ar";
  const [state, setState] = useState<State>("loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [data, setData] = useState<PlatformData>({});
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const page = config[kind];

  const loadData = useCallback(async (current: CustomerSession, currentAccess: AdminAccess) => {
    if (kind === "payments") {
      const orderResult = await Promise.allSettled([fetchAdminOrders(current, { page: 1 })]);
      if (orderResult[0].status === "rejected") {
        setData({ orders: [], paymentTrails: [], limited: ["orders.view"] });
        return;
      }
      const visible = orderResult[0].value.orders.slice(0, 16);
      const trails = await Promise.allSettled(visible.map((order) => fetchPaymentTrail(order.id, current)));
      setData({ orders: visible, paymentTrails: trails.flatMap((result) => result.status === "fulfilled" ? [result.value] : []) });
      return;
    }

    if (kind === "inventory") {
      const [inventoryResult, productsResult] = await Promise.allSettled([fetchInventoryReport(current), fetchAdminProducts(current, { page: 1 })]);
      if (inventoryResult.status === "rejected") throw inventoryResult.reason;
      setData({ inventory: inventoryResult.value, products: productsResult.status === "fulfilled" ? productsResult.value.products : [], limited: productsResult.status === "rejected" ? ["catalog.view"] : [] });
      return;
    }

    if (kind === "suppliers") {
      const [suppliers, purchaseOrders, supplierReport] = await Promise.all([fetchSuppliers(current), fetchPurchaseOrders(current), fetchSupplierReport(current)]);
      setData({ suppliers: suppliers.suppliers, purchaseOrders: purchaseOrders.purchase_orders, supplierReport });
      return;
    }

    if (kind === "reports") {
      const [reportingResult, inventoryResult, rmaResult] = await Promise.allSettled([fetchReportingDashboard(current), fetchInventoryReport(current), fetchRmaReport(current)]);
      if (reportingResult.status === "rejected") throw reportingResult.reason;
      setData({ reporting: reportingResult.value, inventory: inventoryResult.status === "fulfilled" ? inventoryResult.value : undefined, rmaReport: rmaResult.status === "fulfilled" ? rmaResult.value : undefined, limited: inventoryResult.status === "rejected" ? ["inventory.view"] : [] });
      return;
    }

    if (kind === "catalog") {
      const [categories, attributes, products] = await Promise.all([fetchCatalogAdminCategories(current), fetchCatalogAdminAttributes(current), fetchAdminProducts(current, { page: 1 })]);
      setData({ categories, attributes, products: products.products });
      return;
    }

    const readiness = await fetchRuntimeReadiness();
    let audit: AdminAuditLog[] = [];
    const limited: string[] = [];
    if (currentAccess.permissions.includes("audit.view")) {
      const auditResult = await Promise.allSettled([fetchAdminAuditLogs(current, { page: 1 })]);
      if (auditResult[0].status === "fulfilled") audit = auditResult[0].value.logs;
      else limited.push("audit.view");
    } else {
      limited.push("audit.view");
    }
    setData({ readiness, audit, limited });
  }, [kind]);

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active) return;
      if (!current) {
        navigate(`/auth?next=${encodeURIComponent(`/admin/${kind}`)}`, { replace: true });
        return;
      }
      try {
        const [resolvedAccess, mfa] = await Promise.all([fetchAdminAccess(current), fetchMfaStatus(current)]);
        if (!active) return;
        if (!resolvedAccess.permissions.includes(page.permission) || (mfa.required && !mfa.verified)) {
          setState("denied");
          return;
        }
        setSession(current);
        setAccess(resolvedAccess);
        await loadData(current, resolvedAccess);
        if (active) setState("ready");
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "The operations surface could not be loaded.");
        setState("error");
      }
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "The staff session could not be restored.");
      setState("error");
    });
    return () => { active = false; };
  }, [kind, loadData, navigate, page.permission]);

  const visibleNav = useMemo(() => navigation.filter((item) => access?.permissions.includes(item.permission)), [access]);

  async function refund(order: AdminOrder) {
    if (!session || !access?.permissions.includes("payments.refund") || order.payment_status !== "paid") return;
    setBusyOrder(order.id);
    setError("");
    try {
      await requestPaymentRefund(order.id, "staff_console_request", session);
      await loadData(session, access);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Refund request failed.");
    } finally {
      setBusyOrder(null);
    }
  }

  if (state !== "ready" || !session || !access) return <PlatformGate locale={locale} state={state} error={error} />;

  return (
    <div className="el-platform-admin" dir={ar ? "rtl" : "ltr"} lang={locale} data-figma-node={page.figmaNode}>
      <aside className="el-platform-sidebar">
        <div className="el-platform-brand"><ElitedomBrand compact /><span><b>ELITEDOM OPS</b><small>ADMIN / RBAC / MFA</small></span></div>
        <nav aria-label={ar ? "أقسام الإدارة" : "Admin sections"}>
          {visibleNav.map((item) => <Link className={item.kind === kind ? "is-active" : ""} key={item.href} to={item.href}><StoreIcon name={item.icon} size={18} /><span>{ar ? item.labelAr : item.label}</span></Link>)}
        </nav>
        {access.permissions.includes("config.manage") ? <Link className="el-platform-launch" to="/admin/launch"><StoreIcon name="rocket" size={18} /><span>{ar ? "تحكم الإطلاق" : "Launch control"}</span></Link> : null}
      </aside>

      <main className="el-platform-main">
        <header className="el-platform-topbar">
          <div><p>{page.eyebrow}</p><h1>{ar ? page.titleAr : page.title}</h1><span>{ar ? page.descriptionAr : page.description}</span></div>
          <div><span className="el-platform-mfa"><StoreIcon name="shield" size={14} />{ar ? "MFA مُتحقق" : "MFA VERIFIED"}</span><ThemeToggle locale={locale} /><button onClick={() => setLocale(ar ? "en" : "ar")} type="button">{ar ? "EN" : "AR"}</button></div>
        </header>
        {error ? <p className="el-platform-error" role="alert">{error}</p> : null}
        {data.limited?.length ? <p className="el-platform-limited">{ar ? "بعض البيانات الثانوية مخفية لأن الدور الحالي لا يملك الصلاحية الإضافية المطلوبة." : "Some secondary data is hidden because the current role does not have the additional permission required."}</p> : null}
        <PlatformBody access={access} ar={ar} busyOrder={busyOrder} data={data} kind={kind} locale={locale} onRefund={refund} />
        <p className="el-platform-evidence">FIGMA {page.figmaNode} · BACKEND-SOURCED · {ar ? "لا يتم اختراع حالة مزود خارجي داخل المتصفح" : "External provider health is never invented in-browser"}</p>
      </main>
    </div>
  );
}

function PlatformBody({ kind, data, locale, ar, access, onRefund, busyOrder }: { kind: AdminPlatformKind; data: PlatformData; locale: "en" | "ar"; ar: boolean; access: AdminAccess; onRefund: (order: AdminOrder) => void; busyOrder: number | null }) {
  if (kind === "payments") return <PaymentsSurface access={access} ar={ar} busyOrder={busyOrder} data={data} locale={locale} onRefund={onRefund} />;
  if (kind === "inventory") return <InventorySurface ar={ar} data={data} locale={locale} />;
  if (kind === "suppliers") return <SuppliersSurface ar={ar} data={data} locale={locale} />;
  if (kind === "reports") return <ReportsSurface ar={ar} data={data} locale={locale} />;
  if (kind === "catalog") return <CatalogSurface ar={ar} data={data} locale={locale} />;
  return <IntegrationsSurface ar={ar} data={data} />;
}

function PaymentsSurface({ data, locale, ar, access, onRefund, busyOrder }: { data: PlatformData; locale: "en" | "ar"; ar: boolean; access: AdminAccess; onRefund: (order: AdminOrder) => void; busyOrder: number | null }) {
  const orders = data.orders ?? [];
  const trails = new Map((data.paymentTrails ?? []).map((trail) => [trail.order_id, trail]));
  const paid = orders.filter((order) => order.payment_status === "paid").length;
  const refunding = data.paymentTrails?.filter((trail) => Boolean(trail.refund_id)).length ?? 0;
  return <><KpiRow items={[[ar ? "طلبات ظاهرة" : "VISIBLE ORDERS", n(orders.length, locale), ar ? "آخر سجلات" : "latest records"], [ar ? "مدفوع" : "PAID", n(paid, locale), ar ? "حالة محلية" : "local state"], [ar ? "استرداد" : "REFUNDS", n(refunding, locale), ar ? "طلبات مسجلة" : "recorded requests"], [ar ? "المحاولات" : "ATTEMPTS", n(data.paymentTrails?.length ?? 0, locale), ar ? "مسار محفوظ" : "persisted trail"]]} /><DataPanel title={ar ? "دفتر المدفوعات" : "Payment ledger"}><DataTable headers={[ar ? "الطلب" : "Order", ar ? "الدفع" : "Payment", ar ? "المحاولة" : "Attempt", ar ? "الإجمالي" : "Total", ar ? "الإجراء" : "Action"]}>{orders.map((order) => { const trail = trails.get(order.id); return <tr key={order.id}><td><code>#{order.order_number}</code></td><td><Status value={order.payment_status} /></td><td>{trail?.provider_attempt_status ? human(trail.provider_attempt_status) : "—"}</td><td>{money(order.amount_total, locale)} EGP</td><td>{access.permissions.includes("payments.refund") && order.payment_status === "paid" ? <button disabled={busyOrder === order.id} onClick={() => onRefund(order)} type="button">{busyOrder === order.id ? "…" : ar ? "طلب استرداد" : "Request refund"}</button> : "—"}</td></tr>; })}</DataTable></DataPanel></>;
}

function InventorySurface({ data, locale, ar }: { data: PlatformData; locale: "en" | "ar"; ar: boolean }) {
  const report = data.inventory;
  return <><KpiRow items={[[ar ? "عدد SKU" : "SKU COUNT", n(report?.total_sku_count ?? 0, locale), ar ? "مسجل" : "persisted"], [ar ? "وحدات متاحة" : "UNITS ON HAND", n(report?.total_units_on_hand ?? 0, locale), ar ? "إجمالي" : "total"], [ar ? "قيمة التجزئة" : "RETAIL VALUE", `${money(report?.total_retail_value_egp ?? 0, locale)} EGP`, ar ? "محلية" : "persisted"], [ar ? "مخزون منخفض" : "LOW STOCK", n(report?.low_stock_products.length ?? 0, locale), ar ? "منتج" : "SKUs"]]} /><DataPanel title={ar ? "تنبيهات المخزون" : "Inventory exceptions"}><DataTable headers={["SKU", ar ? "المنتج" : "Product", ar ? "الكمية" : "Stock", "Dropship"]}>{(report?.low_stock_products ?? []).map((product) => <tr key={product.product_id}><td><code>{product.sku}</code></td><td>{product.name}</td><td><Status value={String(product.stock_qty)} tone={product.stock_qty <= 2 ? "warning" : "accent"} /></td><td>{product.is_dropship_enabled ? (ar ? "مفعل" : "Enabled") : "—"}</td></tr>)}</DataTable></DataPanel></>;
}

function SuppliersSurface({ data, locale, ar }: { data: PlatformData; locale: "en" | "ar"; ar: boolean }) {
  const suppliers = data.suppliers ?? [];
  const po = data.purchaseOrders ?? [];
  const verified = suppliers.filter((supplier) => supplier.is_verified).length;
  const openPo = po.filter((item) => !["received", "cancelled"].includes(item.status)).length;
  return <><KpiRow items={[[ar ? "الموردون" : "SUPPLIERS", n(suppliers.length, locale), `${n(verified, locale)} ${ar ? "موثق" : "verified"}`], [ar ? "أوامر شراء مفتوحة" : "OPEN POs", n(openPo, locale), ar ? "تحت التنفيذ" : "in flight"], [ar ? "مستلم" : "RECEIVED", n(po.filter((item) => item.status === "received").length, locale), ar ? "أوامر شراء" : "purchase orders"], [ar ? "تقارير الأداء" : "PERFORMANCE", n(data.supplierReport?.suppliers.length ?? 0, locale), ar ? "مورد" : "suppliers"]]} /><div className="el-platform-grid"><DataPanel title={ar ? "الموردون" : "Supplier directory"}><DataTable headers={[ar ? "الاسم" : "Name", ar ? "توثيق" : "Verified", "Lead time", ar ? "العيوب" : "Defect rate"]}>{suppliers.map((supplier) => <tr key={supplier.id}><td>{supplier.name}</td><td><Status value={supplier.is_verified ? (ar ? "موثق" : "Verified") : (ar ? "غير موثق" : "Unverified")} tone={supplier.is_verified ? "success" : "muted"} /></td><td>{n(supplier.lead_time_days, locale)} {ar ? "يوم" : "days"}</td><td>{Number(supplier.defect_rate_percent).toFixed(1)}%</td></tr>)}</DataTable></DataPanel><DataPanel title={ar ? "أوامر الشراء" : "Purchase orders"}><DataTable headers={["PO", ar ? "المورد" : "Supplier", ar ? "الحالة" : "State", ar ? "القيمة" : "Value"]}>{po.slice(0, 12).map((item) => <tr key={item.id}><td><code>{item.po_number}</code></td><td>#{item.supplier_id}</td><td><Status value={item.status} /></td><td>{money(item.total_amount, locale)} {item.currency}</td></tr>)}</DataTable></DataPanel></div></>;
}

function ReportsSurface({ data, locale, ar }: { data: PlatformData; locale: "en" | "ar"; ar: boolean }) {
  const report = data.reporting;
  return <><KpiRow items={[[ar ? "الإيراد" : "REVENUE", `${money(report?.total_revenue ?? 0, locale)} EGP`, ar ? "الفترة الحالية" : "selected period"], [ar ? "الطلبات" : "ORDERS", n(report?.total_orders ?? 0, locale), `${n(report?.paid_orders ?? 0, locale)} ${ar ? "مدفوع" : "paid"}`], [ar ? "العملاء النشطون" : "ACTIVE CUSTOMERS", n(report?.active_customers ?? 0, locale), ar ? "فعلي" : "persisted"], [ar ? "RMA" : "RMA CLAIMS", n(data.rmaReport?.total_claims ?? 0, locale), `${n(data.rmaReport?.recent_claims ?? 0, locale)} ${ar ? "حديث" : "recent"}`]]} /><div className="el-platform-grid"><DataPanel title={ar ? "سلسلة الإيراد" : "Revenue series"}><DataTable headers={[ar ? "الفترة" : "Period", ar ? "الطلبات" : "Orders", ar ? "الإيراد" : "Revenue"]}>{(report?.revenue_series ?? []).slice(-12).map((point) => <tr key={point.period}><td>{point.period}</td><td>{n(point.order_count, locale)}</td><td>{money(point.revenue, locale)} EGP</td></tr>)}</DataTable></DataPanel><DataPanel title={ar ? "الأكثر مبيعًا" : "Best sellers"}><DataTable headers={["SKU", ar ? "المنتج" : "Product", ar ? "الوحدات" : "Units"]}>{(report?.best_sellers ?? []).slice(0, 12).map((item) => <tr key={item.product_id}><td><code>{item.sku}</code></td><td>{item.name}</td><td>{n(item.units_sold, locale)}</td></tr>)}</DataTable></DataPanel></div></>;
}

function CatalogSurface({ data, locale, ar }: { data: PlatformData; locale: "en" | "ar"; ar: boolean }) {
  return <><KpiRow items={[[ar ? "المنتجات" : "PRODUCTS", n(data.products?.length ?? 0, locale), ar ? "العينة الحالية" : "current page"], [ar ? "الأقسام" : "CATEGORIES", n(data.categories?.length ?? 0, locale), ar ? "تعريف" : "definitions"], [ar ? "الخصائص" : "ATTRIBUTES", n(data.attributes?.length ?? 0, locale), ar ? "تقنية" : "technical"], [ar ? "فلاتر" : "FILTERABLE", n(data.attributes?.filter((item) => item.is_filterable).length ?? 0, locale), ar ? "خاصية" : "attributes"]]} /><div className="el-platform-grid"><DataPanel title={ar ? "الأقسام" : "Categories"}><DataTable headers={[ar ? "الاسم" : "Name", "Slug", ar ? "الحالة" : "State"]}>{(data.categories ?? []).map((item) => <tr key={item.id}><td dir="auto">{ar && item.name_ar ? item.name_ar : item.name}</td><td><code>{item.slug}</code></td><td><Status value={item.is_active === false ? (ar ? "غير نشط" : "Inactive") : (ar ? "نشط" : "Active")} tone={item.is_active === false ? "muted" : "success"} /></td></tr>)}</DataTable></DataPanel><DataPanel title={ar ? "الخصائص التقنية" : "Technical attributes"}><DataTable headers={[ar ? "الاسم" : "Name", "Code", ar ? "فلتر" : "Filter"]}>{(data.attributes ?? []).map((item) => <tr key={item.id}><td dir="auto">{ar && item.name_ar ? item.name_ar : item.name}</td><td><code>{item.code}</code></td><td>{item.is_filterable ? (ar ? "نعم" : "Yes") : "—"}</td></tr>)}</DataTable></DataPanel></div></>;
}

function IntegrationsSurface({ data, ar }: { data: PlatformData; ar: boolean }) {
  const deps = data.readiness?.dependencies ?? {};
  return <><KpiRow items={[["API", data.readiness?.ready ? "READY" : "CHECK", ar ? "فحص runtime" : "runtime readiness"], ["POSTGRES", deps.postgres ?? "—", ar ? "جاهزية" : "readiness"], ["REDIS", deps.redis ?? "—", ar ? "جاهزية" : "readiness"], [ar ? "التدقيق" : "AUDIT", String(data.audit?.length ?? 0), ar ? "أحداث متاحة" : "available events"]]} /><div className="el-platform-grid"><DataPanel title={ar ? "جاهزية التشغيل" : "Runtime readiness"}><DataTable headers={[ar ? "الخدمة" : "Dependency", ar ? "الحالة" : "State"]}>{Object.entries(deps).map(([name, status]) => <tr key={name}><td>{name}</td><td><Status value={status} tone={status === "ready" ? "success" : "muted"} /></td></tr>)}<tr><td>Odoo 17</td><td><Status value={ar ? "دليل إصدار" : "Release-scoped"} tone="muted" /></td></tr><tr><td>{ar ? "مزود الدفع" : "Payment provider"}</td><td><Status value={ar ? "دليل إصدار" : "Release-scoped"} tone="muted" /></td></tr></DataTable></DataPanel><DataPanel title={ar ? "آخر أحداث التدقيق" : "Recent audit events"}><DataTable headers={[ar ? "الإجراء" : "Action", ar ? "الكيان" : "Entity", ar ? "الوقت" : "Time"]}>{(data.audit ?? []).slice(0, 12).map((item) => <tr key={item.id}><td><code>{item.action}</code></td><td>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ""}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</DataTable></DataPanel></div></>;
}

function KpiRow({ items }: { items: Array<[string, string, string]> }) { return <section className="el-platform-kpis">{items.map(([label, value, meta]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{meta}</span></article>)}</section>; }
function DataPanel({ title, children }: { title: string; children: ReactNode }) { return <section className="el-platform-panel"><h2>{title}</h2>{children}</section>; }
function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="el-platform-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Status({ value, tone }: { value: string; tone?: "success" | "warning" | "accent" | "muted" }) { const normalized = value.toLowerCase(); const inferred = tone ?? (/(paid|ready|received|verified|active|done|success)/.test(normalized) ? "success" : /(pending|partial|low|refund|review)/.test(normalized) ? "warning" : "accent"); return <span className={`el-platform-status is-${inferred}`}>{human(value)}</span>; }
function PlatformGate({ locale, state, error }: { locale: "en" | "ar"; state: State; error: string }) { const ar = locale === "ar"; const label = state === "loading" ? (ar ? "جارٍ تحميل سطح العمليات…" : "Loading operations surface…") : state === "denied" ? (ar ? "الحساب لا يملك الصلاحية أو يحتاج تحقق MFA." : "This account lacks permission or requires MFA verification.") : error || (ar ? "تعذر تحميل البيانات." : "The data could not be loaded."); return <main className="el-platform-gate" dir={ar ? "rtl" : "ltr"}><ElitedomBrand /><StoreIcon name={state === "denied" ? "lock" : "shield"} size={34} /><h1>{label}</h1>{state !== "loading" ? <Link to="/admin">{ar ? "العودة للإدارة" : "Back to admin"}</Link> : null}</main>; }
function human(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function n(value: number, locale: "en" | "ar") { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value); }
function money(value: string | number, locale: "en" | "ar") { const parsed = Number(value); return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(Number.isFinite(parsed) ? parsed : 0); }
