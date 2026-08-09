import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  adjustAdminProductStock,
  canAccessAdminSection,
  dispatchAdminOrder,
  fetchAdminAccess,
  fetchAdminAuditLogs,
  fetchAdminCustomers,
  fetchAdminDashboard,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminRfqs,
  fetchAdminRmas,
  fetchAdminShipments,
  fetchAdminStaff,
  issueAdminRfqQuote,
  reviewAdminRma,
  updateAdminOrderState,
  updateAdminStaffAccess,
  type AdminAccess,
  type AdminAuditLog,
  type AdminCustomer,
  type AdminDashboard,
  type AdminOrder,
  type AdminProduct,
  type AdminRfq,
  type AdminRma,
  type AdminSection,
  type AdminShipment,
  type AdminStaffAccess,
} from "@/lib/admin-api";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  fetchMfaStatus,
  logoutSession,
  verifyMfa,
  type MfaEnrollment,
  type MfaStatus,
} from "@/lib/auth-api";
import { clearStoredSession, restoreSession } from "@/lib/auth-session";
import type { CustomerSession } from "@/types/store";
import "@/styles/admin-console.css";

const sectionIcons: Record<AdminSection, StoreIconName> = {
  dashboard: "home",
  orders: "clipboard",
  products: "package",
  customers: "account",
  rma: "returns",
  rfqs: "bank",
  shipments: "delivery",
  staff: "shield",
  audit: "clock",
};

const staffRoles = [
  "system_admin",
  "operations_manager",
  "finance_officer",
  "inventory_manager",
  "warehouse_operator",
  "customer_support",
  "content_catalog",
] as const;

const copy = {
  en: {
    ops: "ELITEDOM OPS",
    system: "ADMIN / RBAC / MFA",
    adminSections: "Admin sections",
    close: "Close",
    sections: {
      dashboard: "Dashboard",
      orders: "Orders",
      products: "Products & inventory",
      customers: "Customers",
      rma: "RMA / returns",
      rfqs: "B2B / RFQ",
      shipments: "Shipments",
      staff: "Staff & roles",
      audit: "Audit log",
    } satisfies Record<AdminSection, string>,
    logout: "Sign out",
    console: "Operations dashboard",
    consoleIntro: "Summary first, then permission-scoped operational depth.",
    mfaVerified: "MFA VERIFIED",
    accessDenied: "This account does not have staff-console access.",
    authRequired: "Staff authentication required.",
    loading: "Loading operations data…",
    retry: "Retry",
    todayRevenue: "Today revenue",
    ordersToday: "Orders today",
    pendingShipments: "Pending shipments",
    lowStock: "Low stock",
    revenueTrend: "Paid revenue · last 7 days",
    attention: "Orders requiring attention",
    queues: "Operational queues",
    pendingOrders: "Pending orders",
    activeRfqs: "Active RFQs",
    pendingRma: "Pending RMA",
    lowStockProducts: "Low-stock products",
    noAttention: "No recent orders currently require attention.",
    search: "Search",
    total: "Total",
    state: "State",
    payment: "Payment",
    customer: "Customer",
    amount: "Amount",
    created: "Created",
    stock: "Stock",
    sku: "SKU",
    product: "Product",
    role: "Role",
    email: "Email",
    status: "Status",
    reference: "Reference",
    action: "Action",
    entity: "Entity",
    actor: "Actor",
    adjust: "Adjust stock",
    delta: "Quantity delta",
    reason: "Reason",
    save: "Save",
    quote: "Issue quote",
    validity: "Valid until",
    terms: "Terms",
    review: "Review",
    dispatch: "Dispatch",
    tracking: "Tracking number",
    scheduled: "Scheduled date",
    noData: "No records match this view.",
    updateRole: "Update role",
    permissions: "permissions",
    operationalTruth: "Figures reflect persisted local records. Provider health is never inferred from UI placeholders.",
    launch: "Launch control",
    launchMeta: "Release evidence and environment gates",
  },
  ar: {
    ops: "ELITEDOM OPS",
    system: "الإدارة / الصلاحيات / MFA",
    adminSections: "أقسام لوحة الإدارة",
    close: "إغلاق",
    sections: {
      dashboard: "لوحة المتابعة",
      orders: "الطلبات",
      products: "المنتجات والمخزون",
      customers: "العملاء",
      rma: "المرتجعات / RMA",
      rfqs: "الشركات / عروض الأسعار",
      shipments: "الشحنات",
      staff: "الموظفون والصلاحيات",
      audit: "سجل التدقيق",
    } satisfies Record<AdminSection, string>,
    logout: "تسجيل الخروج",
    console: "لوحة العمليات",
    consoleIntro: "ملخص أولًا، وبعده تفاصيل التشغيل حسب الصلاحيات.",
    mfaVerified: "MFA مُتحقق",
    accessDenied: "الحساب ده ملوش صلاحية دخول لوحة الموظفين.",
    authRequired: "لازم تسجيل دخول موظف.",
    loading: "بنحمّل بيانات العمليات…",
    retry: "حاول تاني",
    todayRevenue: "إيراد اليوم",
    ordersToday: "طلبات اليوم",
    pendingShipments: "شحنات معلقة",
    lowStock: "مخزون منخفض",
    revenueTrend: "الإيراد المدفوع · آخر 7 أيام",
    attention: "طلبات محتاجة متابعة",
    queues: "طوابير التشغيل",
    pendingOrders: "طلبات معلقة",
    activeRfqs: "عروض شركات نشطة",
    pendingRma: "RMA معلقة",
    lowStockProducts: "منتجات مخزونها منخفض",
    noAttention: "مفيش طلبات حديثة محتاجة تدخل حاليًا.",
    search: "بحث",
    total: "الإجمالي",
    state: "الحالة",
    payment: "الدفع",
    customer: "العميل",
    amount: "القيمة",
    created: "التاريخ",
    stock: "المخزون",
    sku: "SKU",
    product: "المنتج",
    role: "الدور",
    email: "الإيميل",
    status: "الحالة",
    reference: "المرجع",
    action: "الإجراء",
    entity: "الكيان",
    actor: "المنفذ",
    adjust: "تعديل المخزون",
    delta: "فرق الكمية",
    reason: "السبب",
    save: "حفظ",
    quote: "إصدار عرض سعر",
    validity: "صالح لحد",
    terms: "الشروط",
    review: "مراجعة",
    dispatch: "تسجيل الشحن",
    tracking: "رقم التتبع",
    scheduled: "موعد الشحن",
    noData: "مفيش سجلات مطابقة للعرض ده.",
    updateRole: "تعديل الدور",
    permissions: "صلاحية",
    operationalTruth: "الأرقام من السجلات المحلية الفعلية؛ حالة أي مزود خارجي مش بنفترضها من UI.",
    launch: "تحكم الإطلاق",
    launchMeta: "أدلة الإصدار وبوابات البيئة",
  },
} as const;

type AdminCopy = typeof copy.en | typeof copy.ar;
type SectionProps = {
  session: CustomerSession;
  access: AdminAccess;
  locale: "en" | "ar";
  text: AdminCopy;
};

function parseSection(value: string | null): AdminSection {
  return value && Object.prototype.hasOwnProperty.call(sectionIcons, value)
    ? value as AdminSection
    : "dashboard";
}

export function AdminConsolePage() {
  const [locale, setLocale] = useStoreLocale();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const text = copy[locale];
  const requestedSection = parseSection(params.get("section"));
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then(async (current) => {
        if (!active) return;
        if (!current) {
          navigate(`/auth?next=${encodeURIComponent("/admin")}`, { replace: true });
          return;
        }
        const [resolvedAccess, resolvedMfa] = await Promise.all([
          fetchAdminAccess(current),
          fetchMfaStatus(current),
        ]);
        if (!active) return;
        setSession(current);
        setAccess(resolvedAccess);
        setMfa(resolvedMfa);
        setState("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const status = errorStatus(reason);
        if (status === 401 || status === 403) setState("denied");
        else {
          setError(message(reason));
          setState("error");
        }
      });
    return () => { active = false; };
  }, [navigate]);

  async function signOut() {
    if (session) {
      try { await logoutSession(session); } catch { /* Local logout still proceeds if the API is unavailable. */ }
    }
    clearStoredSession();
    navigate("/auth", { replace: true });
  }

  if (state === "loading") return <AdminGate locale={locale} label={text.loading} />;
  if (state === "denied" || !session) return <AdminGate locale={locale} label={text.accessDenied} denied />;
  if (state === "error") return <AdminGate locale={locale} label={error || text.authRequired} retry />;
  if (!access || !mfa) return null;

  if (mfa.required && !mfa.verified) {
    return <MfaGate locale={locale} mfa={mfa} onVerified={setMfa} session={session} />;
  }

  const visibleSections = (Object.keys(sectionIcons) as AdminSection[])
    .filter((section) => canAccessAdminSection(access.permissions, section));
  const section = visibleSections.includes(requestedSection)
    ? requestedSection
    : visibleSections[0] ?? "dashboard";

  return (
    <div className="el-admin-page" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <aside className="el-admin-sidebar">
        <div className="el-admin-brand">
          <ElitedomBrand compact />
          <span><b>{text.ops}</b><small>{text.system}</small></span>
        </div>
        <nav aria-label={text.adminSections}>
          {visibleSections.map((item) => (
            <Link
              className={section === item ? "is-active" : ""}
              key={item}
              to={item === "dashboard" ? "/admin" : `/admin?section=${item}`}
            >
              <StoreIcon name={sectionIcons[item]} size={18} />
              {text.sections[item]}
            </Link>
          ))}
        </nav>
        {access.permissions.includes("config.manage") ? (
          <Link className="el-admin-launch-link" to="/admin/launch">
            <StoreIcon name="shield" size={18} />
            <span><b>{text.launch}</b><small>{text.launchMeta}</small></span>
          </Link>
        ) : null}
        <div className="el-admin-sidebar__footer">
          <span><b>{session.name || session.email || "Elitedom staff"}</b><small>{humanize(access.role)}</small></span>
          <button onClick={() => void signOut()} type="button">{text.logout}</button>
        </div>
      </aside>

      <main className="el-admin-main">
        <header className="el-admin-topbar">
          <div>
            <p className="el-eyebrow">ELITEDOM / OPERATIONS</p>
            <h1>{section === "dashboard" ? text.console : text.sections[section]}</h1>
            <p>{section === "dashboard" ? text.consoleIntro : text.operationalTruth}</p>
          </div>
          <div className="el-admin-topbar__actions">
            <span className="el-admin-mfa"><StoreIcon name="shield" size={14} />{text.mfaVerified}</span>
            <button onClick={() => setLocale(locale === "en" ? "ar" : "en")} type="button">
              {locale === "en" ? "AR" : "EN"}
            </button>
          </div>
        </header>
        <AdminSectionView access={access} locale={locale} section={section} session={session} text={text} />
      </main>
    </div>
  );
}

function AdminGate({ locale, label, denied = false, retry = false }: {
  locale: "en" | "ar";
  label: string;
  denied?: boolean;
  retry?: boolean;
}) {
  return (
    <div className="el-admin-gate" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <ElitedomBrand />
      <StoreIcon name={denied ? "lock" : "shield"} size={34} />
      <h1>{label}</h1>
      {retry ? <button onClick={() => window.location.reload()} type="button">{copy[locale].retry}</button> : <Link to="/auth">{copy[locale].authRequired}</Link>}
    </div>
  );
}

function MfaGate({ locale, mfa, session, onVerified }: {
  locale: "en" | "ar";
  mfa: MfaStatus;
  session: CustomerSession;
  onVerified: (status: MfaStatus) => void;
}) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [confirmedStatus, setConfirmedStatus] = useState<MfaStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const ar = locale === "ar";

  async function begin() {
    setPending(true);
    setError("");
    try { setEnrollment(await beginMfaEnrollment(session)); }
    catch (reason) { setError(message(reason)); }
    finally { setPending(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    if (!code) return;
    setPending(true);
    setError("");
    try {
      if (!mfa.enrolled) {
        const result = await confirmMfaEnrollment(code, session);
        setRecoveryCodes(result.recoveryCodes);
        setConfirmedStatus(result.status);
      } else {
        onVerified(await verifyMfa(code, session));
      }
    } catch (reason) {
      setError(message(reason));
    } finally {
      setPending(false);
    }
  }

  if (recoveryCodes.length && confirmedStatus) {
    return (
      <div className="el-admin-mfa-gate" dir={ar ? "rtl" : "ltr"}>
        <div className="el-admin-mfa-card">
          <ElitedomBrand />
          <StoreIcon name="shield" size={36} />
          <h1>{ar ? "احفظ أكواد الاسترداد" : "Save your recovery codes"}</h1>
          <p>{ar ? "الأكواد دي بتظهر مرة واحدة. خزّنها في مكان آمن قبل دخول لوحة الإدارة." : "These codes are shown once. Store them safely before continuing to the operations console."}</p>
          <div className="el-admin-recovery-codes">
            {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
          </div>
          <button onClick={() => onVerified(confirmedStatus)} type="button">{ar ? "تم الحفظ — دخول اللوحة" : "Saved — continue to console"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="el-admin-mfa-gate" dir={ar ? "rtl" : "ltr"}>
      <div className="el-admin-mfa-card">
        <ElitedomBrand />
        <StoreIcon name="shield" size={36} />
        <p className="el-eyebrow">ADMIN / MFA</p>
        <h1>{ar ? "التحقق بخطوتين مطلوب" : "Multi-factor verification required"}</h1>
        <p>{ar ? "لوحة العمليات محمية بحد MFA مستقل عن تسجيل الدخول الأساسي." : "The operations console has an MFA boundary in addition to the primary sign-in session."}</p>
        {!mfa.enrolled && !enrollment ? (
          <button disabled={pending} onClick={() => void begin()} type="button">{ar ? "ابدأ إعداد MFA" : "Begin MFA setup"}</button>
        ) : null}
        {enrollment ? (
          <div className="el-admin-enrollment">
            <span>{ar ? "أضف المفتاح في تطبيق Authenticator:" : "Add this key to your authenticator:"}</span>
            <code>{enrollment.secret}</code>
            <small>{enrollment.provisioningUri}</small>
          </div>
        ) : null}
        {mfa.enrolled || enrollment ? (
          <form onSubmit={verify}>
            <label>
              <span>{ar ? "كود التحقق" : "Verification code"}</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={10} name="code" required />
            </label>
            {error ? <p className="el-admin-error" role="alert">{error}</p> : null}
            <button disabled={pending} type="submit">{pending ? "…" : ar ? "تحقق" : "Verify"}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function AdminSectionView({ section, session, access, locale, text }: SectionProps & { section: AdminSection }) {
  if (section === "dashboard") return <DashboardSection locale={locale} session={session} text={text} />;
  if (section === "orders") return <OrdersSection access={access} locale={locale} session={session} text={text} />;
  if (section === "products") return <ProductsSection access={access} locale={locale} session={session} text={text} />;
  if (section === "customers") return <CustomersSection locale={locale} session={session} text={text} />;
  if (section === "rma") return <RmaSection access={access} locale={locale} session={session} text={text} />;
  if (section === "rfqs") return <RfqsSection access={access} locale={locale} session={session} text={text} />;
  if (section === "shipments") return <ShipmentsSection access={access} locale={locale} session={session} text={text} />;
  if (section === "staff") return <StaffSection access={access} session={session} text={text} />;
  return <AuditSection locale={locale} session={session} text={text} />;
}

function useRemote<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loader().then(
      (result) => {
        if (!active) return;
        setData(result);
        setError("");
      },
      (reason: unknown) => {
        if (active) setError(message(reason));
      },
    );
    return () => { active = false; };
  }, [loader]);

  return { data, setData, error, setError };
}

function DashboardSection({ session, locale, text }: Omit<SectionProps, "access">) {
  const loader = useCallback(() => fetchAdminDashboard(session), [session]);
  const { data, error } = useRemote<AdminDashboard>(loader);
  if (error) return <AdminError message={error} />;
  if (!data) return <AdminLoading label={text.loading} />;

  const attention = data.recent_orders
    .filter((order) => order.payment_status !== "paid" || ["draft", "sent"].includes(order.state))
    .slice(0, 5);
  const maxRevenue = Math.max(1, ...data.revenue_trend.map((point) => Number(point.paid_revenue)));

  return (
    <div className="el-admin-dashboard">
      <div className="el-admin-kpis">
        <Kpi label={text.todayRevenue} value={`${money(data.metrics.paid_revenue_today, locale)} EGP`} meta={`${data.metrics.orders_today} ${text.ordersToday.toLowerCase()}`} />
        <Kpi label={text.ordersToday} value={number(data.metrics.orders_today, locale)} meta={`${number(data.metrics.total_orders, locale)} ${text.total.toLowerCase()}`} />
        <Kpi label={text.pendingShipments} value={number(data.metrics.pending_shipments, locale)} meta={text.pendingShipments} />
        <Kpi label={text.lowStock} value={number(data.metrics.low_stock_products, locale)} meta={text.lowStockProducts} />
      </div>
      <div className="el-admin-dashboard-grid">
        <section className="el-admin-card el-admin-trend">
          <CardHeading title={text.revenueTrend} />
          <div className="el-admin-bars">
            {data.revenue_trend.map((point) => (
              <div key={point.date}>
                <span style={{ height: `${Math.max(4, Number(point.paid_revenue) / maxRevenue * 100)}%` }} />
                <small>{shortDate(point.date, locale)}</small>
                <b>{money(point.paid_revenue, locale)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="el-admin-card el-admin-queues">
          <CardHeading title={text.queues} />
          <Queue label={text.pendingOrders} value={data.metrics.pending_orders} />
          <Queue label={text.pendingShipments} value={data.metrics.pending_shipments} />
          <Queue label={text.activeRfqs} value={data.metrics.active_rfqs} />
          <Queue label={text.pendingRma} value={data.metrics.pending_rma_claims} />
          <Queue label={text.lowStockProducts} value={data.metrics.low_stock_products} />
          <p>{text.operationalTruth}</p>
        </section>
        <section className="el-admin-card el-admin-attention">
          <CardHeading title={text.attention} />
          {attention.length ? <AdminOrderTable locale={locale} orders={attention} text={text} /> : <Empty text={text.noAttention} />}
        </section>
        <section className="el-admin-card el-admin-low-stock">
          <CardHeading title={text.lowStockProducts} />
          {data.low_stock.length ? (
            <div className="el-admin-low-stock-list">
              {data.low_stock.map((product) => (
                <div key={product.id}><span><b>{product.name}</b><small>{product.sku}</small></span><strong>{product.stock_qty}</strong></div>
              ))}
            </div>
          ) : <Empty text={text.noData} />}
        </section>
      </div>
    </div>
  );
}

function OrdersSection({ session, access, locale, text }: SectionProps) {
  const initialLoader = useCallback(() => fetchAdminOrders(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  async function search() {
    try { setData(await fetchAdminOrders(await freshSession(session), { q: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  async function changeState(order: AdminOrder, state: string) {
    try {
      const next = await updateAdminOrderState(order.id, state, await freshSession(session));
      setData((current) => current ? { ...current, orders: current.orders.map((item) => item.id === order.id ? next : item) } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <AdminOrderTable locale={locale} orders={data?.orders ?? []} text={text} onSelect={access.permissions.includes("orders.manage") ? setSelected : undefined} />
      {!data?.orders.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.state} · ${selected.order_number}`} onClose={() => setSelected(null)}>
          <div className="el-admin-action-options">
            {["draft", "sent", "sale", "done", "cancel"].map((state) => (
              <button key={state} disabled={selected.state === state} onClick={() => void changeState(selected, state)} type="button">{humanize(state)}</button>
            ))}
          </div>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function ProductsSection({ session, access, locale, text }: SectionProps) {
  const initialLoader = useCallback(() => fetchAdminProducts(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [selected, setSelected] = useState<AdminProduct | null>(null);

  async function search() {
    try { setData(await fetchAdminProducts(await freshSession(session), { q: query || undefined, low_stock: lowStock || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await adjustAdminProductStock(selected.id, {
        quantity_delta: Number(form.get("delta")),
        reason: String(form.get("reason") || ""),
      }, await freshSession(session));
      setData((current) => current ? {
        ...current,
        products: current.products.map((item) => item.id === selected.id ? {
          ...item,
          stock_qty: result.stock_qty,
          stock_health: result.stock_qty <= 5 ? "low_stock" : "healthy",
        } : item),
      } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <div className="el-admin-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <StoreIcon name="search" size={16} />
          <input aria-label={text.search} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} type="search" value={query} />
          <button type="submit">{text.search}</button>
        </form>
        <label className="el-admin-toggle"><input checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} type="checkbox" />{text.lowStock}</label>
        <span>{text.total}: {number(data?.total_count ?? 0, locale)}</span>
      </div>
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.products} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.product}</span><span>{text.sku}</span><span>{text.stock}</span><span>{text.amount}</span><span>{text.status}</span></div>
        {(data?.products ?? []).map((product) => (
          <button className="el-admin-row" key={product.id} onClick={() => { if (access.permissions.includes("inventory.adjust")) setSelected(product); }} type="button">
            <span><b>{product.name}</b><small>{product.brand || "—"}</small></span><span>{product.sku}</span><span>{product.stock_qty}</span><span>{money(product.list_price, locale)} EGP</span><span><Status value={product.stock_health} /></span>
          </button>
        ))}
      </div>
      {!data?.products.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.adjust} · ${selected.sku}`} onClose={() => setSelected(null)}>
          <form className="el-admin-action-form" onSubmit={adjust}>
            <label><span>{text.delta}</span><input name="delta" required type="number" /></label>
            <label><span>{text.reason}</span><textarea minLength={3} name="reason" required rows={3} /></label>
            <button type="submit">{text.save}</button>
          </form>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function CustomersSection({ session, locale, text }: Omit<SectionProps, "access">) {
  const initialLoader = useCallback(() => fetchAdminCustomers(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");

  async function search() {
    try { setData(await fetchAdminCustomers(await freshSession(session), { q: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.customers} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.customer}</span><span>{text.email}</span><span>{text.role}</span><span>{text.ordersToday}</span><span>{text.total}</span></div>
        {(data?.customers ?? []).map((customer: AdminCustomer) => (
          <div className="el-admin-row" key={customer.id}><span><b>{customer.name}</b><small>{customer.phone}</small></span><span>{customer.email}</span><span>{humanize(customer.role)}</span><span>{number(customer.order_count, locale)}</span><span>{money(customer.lifetime_value, locale)} EGP</span></div>
        ))}
      </div>
      {!data?.customers.length ? <Empty text={text.noData} /> : null}
    </section>
  );
}

function RmaSection({ session, access, locale, text }: SectionProps) {
  const initialLoader = useCallback(() => fetchAdminRmas(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminRma | null>(null);

  async function search() {
    try { setData(await fetchAdminRmas(await freshSession(session), { q: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      const next = await reviewAdminRma(selected.ticket_number, {
        status: String(form.get("status")) as "approved" | "rejected" | "completed",
        resolution_notes: String(form.get("notes") || "") || undefined,
      }, await freshSession(session));
      setData((current) => current ? { ...current, claims: current.claims.map((item) => item.ticket_number === next.ticket_number ? next : item) } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.rma} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.reference}</span><span>{text.customer}</span><span>{text.product}</span><span>{text.status}</span><span>{text.created}</span></div>
        {(data?.claims ?? []).map((item) => (
          <button className="el-admin-row" key={item.ticket_number} onClick={() => { if (access.permissions.includes("support.manage")) setSelected(item); }} type="button">
            <span><b>{item.ticket_number}</b><small>{item.order_number}</small></span><span>{item.customer_name}</span><span>{item.product_name}</span><span><Status value={item.status} /></span><span>{dateTime(item.created_at, locale)}</span>
          </button>
        ))}
      </div>
      {!data?.claims.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.review} · ${selected.ticket_number}`} onClose={() => setSelected(null)}>
          <form className="el-admin-action-form" onSubmit={review}>
            <label><span>{text.status}</span><select defaultValue="approved" name="status"><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></label>
            <label><span>{text.reason}</span><textarea name="notes" rows={3} /></label>
            <button type="submit">{text.save}</button>
          </form>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function RfqsSection({ session, access, locale, text }: SectionProps) {
  const initialLoader = useCallback(() => fetchAdminRfqs(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminRfq | null>(null);

  async function search() {
    try { setData(await fetchAdminRfqs(await freshSession(session), { q: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  async function quote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      const next = await issueAdminRfqQuote(selected.rfq_code, {
        validity_date: String(form.get("validity")),
        terms: String(form.get("terms") || "") || undefined,
      }, await freshSession(session));
      setData((current) => current ? {
        ...current,
        rfqs: current.rfqs.map((item) => item.rfq_code === selected.rfq_code ? {
          ...item,
          status: next.status,
          validity_date: next.validity_date,
          total_estimated_value: next.total_estimated_value,
        } : item),
      } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.rfqs} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.reference}</span><span>{text.customer}</span><span>{text.status}</span><span>{text.product}</span><span>{text.amount}</span></div>
        {(data?.rfqs ?? []).map((item) => (
          <button className="el-admin-row" key={item.rfq_code} onClick={() => { if (access.permissions.includes("rfq.quote")) setSelected(item); }} type="button">
            <span><b>{item.rfq_code}</b><small>{dateTime(item.created_at, locale)}</small></span><span>{item.customer_name}</span><span><Status value={item.status} /></span><span>{item.item_count}</span><span>{item.total_estimated_value != null ? `${money(item.total_estimated_value, locale)} EGP` : "—"}</span>
          </button>
        ))}
      </div>
      {!data?.rfqs.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.quote} · ${selected.rfq_code}`} onClose={() => setSelected(null)}>
          <form className="el-admin-action-form" onSubmit={quote}>
            <label><span>{text.validity}</span><input name="validity" required type="date" /></label>
            <label><span>{text.terms}</span><textarea name="terms" rows={4} /></label>
            <button type="submit">{text.save}</button>
          </form>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function ShipmentsSection({ session, access, locale, text }: SectionProps) {
  const initialLoader = useCallback(() => fetchAdminShipments(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminShipment | null>(null);

  async function search() {
    try { setData(await fetchAdminShipments(await freshSession(session), { q: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.order_id) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await dispatchAdminOrder(selected.order_id, {
        tracking_number: String(form.get("tracking")),
        reference: selected.picking_reference,
        scheduled_date: String(form.get("scheduled") || "") || undefined,
      }, await freshSession(session));
      setData((current) => current ? {
        ...current,
        shipments: current.shipments.map((item) => item.id === selected.id ? {
          ...item,
          state: result.picking_state,
          tracking_number: result.tracking_number,
          order_state: result.order_state,
        } : item),
      } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.shipments} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.reference}</span><span>{text.customer}</span><span>{text.status}</span><span>{text.tracking}</span><span>{text.created}</span></div>
        {(data?.shipments ?? []).map((item) => (
          <button className="el-admin-row" key={item.id} onClick={() => { if (access.permissions.includes("shipments.dispatch") && item.order_id) setSelected(item); }} type="button">
            <span><b>{item.picking_reference}</b><small>{item.order_number || "—"}</small></span><span>{item.customer_name || "—"}</span><span><Status value={item.state} /></span><span>{item.tracking_number || "—"}</span><span>{dateTime(item.created_at, locale)}</span>
          </button>
        ))}
      </div>
      {!data?.shipments.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.dispatch} · ${selected.picking_reference}`} onClose={() => setSelected(null)}>
          <form className="el-admin-action-form" onSubmit={dispatch}>
            <label><span>{text.tracking}</span><input name="tracking" required /></label>
            <label><span>{text.scheduled}</span><input name="scheduled" type="datetime-local" /></label>
            <button type="submit">{text.save}</button>
          </form>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function StaffSection({ session, access, text }: Omit<SectionProps, "locale">) {
  const initialLoader = useCallback(() => fetchAdminStaff(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [selected, setSelected] = useState<AdminStaffAccess | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const role = String(new FormData(event.currentTarget).get("role"));
    try {
      const next = await updateAdminStaffAccess(selected.id, { role, overrides: selected.overrides }, await freshSession(session));
      setData((current) => current ? { staff: current.staff.map((item) => item.id === next.id ? next : item) } : current);
      setSelected(null);
    } catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.staff} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.customer}</span><span>{text.email}</span><span>{text.role}</span><span>{text.permissions}</span><span>{text.status}</span></div>
        {(data?.staff ?? []).map((item) => (
          <button className="el-admin-row" key={item.id} onClick={() => { if (access.permissions.includes("staff.manage")) setSelected(item); }} type="button">
            <span><b>{item.name}</b></span><span>{item.email}</span><span>{humanize(item.role)}</span><span>{item.permissions.length}</span><span><Status value={item.is_active ? "active" : "inactive"} /></span>
          </button>
        ))}
      </div>
      {!data?.staff.length ? <Empty text={text.noData} /> : null}
      {selected ? (
        <AdminActionDialog closeLabel={text.close} title={`${text.updateRole} · ${selected.name}`} onClose={() => setSelected(null)}>
          <form className="el-admin-action-form" onSubmit={save}>
            <label><span>{text.role}</span><select defaultValue={selected.role} name="role">{staffRoles.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}</select></label>
            <p>{selected.permissions.length} {text.permissions}</p>
            <button type="submit">{text.save}</button>
          </form>
        </AdminActionDialog>
      ) : null}
    </section>
  );
}

function AuditSection({ session, locale, text }: Omit<SectionProps, "access">) {
  const initialLoader = useCallback(() => fetchAdminAuditLogs(session), [session]);
  const { data, setData, error, setError } = useRemote(initialLoader);
  const [query, setQuery] = useState("");

  async function search() {
    try { setData(await fetchAdminAuditLogs(await freshSession(session), { action: query || undefined })); setError(""); }
    catch (reason) { setError(message(reason)); }
  }

  if (!data && !error) return <AdminLoading label={text.loading} />;
  return (
    <section className="el-admin-card">
      <Toolbar total={data?.total_count ?? 0} query={query} onQuery={setQuery} onSearch={() => void search()} text={text} />
      {error ? <AdminError message={error} /> : null}
      <div aria-label={text.sections.audit} className="el-admin-table" role="region" tabIndex={0}>
        <div className="el-admin-row is-head"><span>{text.action}</span><span>{text.entity}</span><span>{text.actor}</span><span>{text.reference}</span><span>{text.created}</span></div>
        {(data?.logs ?? []).map((item: AdminAuditLog) => (
          <div className="el-admin-row" key={item.id}><span><b>{item.action}</b></span><span>{item.entity_type}</span><span>{item.actor_role || item.actor_partner_id || "system"}</span><span>{item.entity_id || "—"}</span><span>{dateTime(item.created_at, locale)}</span></div>
        ))}
      </div>
      {!data?.logs.length ? <Empty text={text.noData} /> : null}
    </section>
  );
}

function Toolbar({ total, query, onQuery, onSearch, text }: {
  total: number;
  query: string;
  onQuery: (value: string) => void;
  onSearch: () => void;
  text: AdminCopy;
}) {
  return (
    <div className="el-admin-toolbar">
      <form onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
        <StoreIcon name="search" size={16} />
        <input aria-label={text.search} onChange={(event) => onQuery(event.target.value)} placeholder={text.search} type="search" value={query} />
        <button type="submit">{text.search}</button>
      </form>
      <span>{text.total}: {total}</span>
    </div>
  );
}

function AdminOrderTable({ orders, locale, text, onSelect }: {
  orders: AdminOrder[];
  locale: "en" | "ar";
  text: AdminCopy;
  onSelect?: (order: AdminOrder) => void;
}) {
  return (
    <div aria-label={text.sections.orders} className="el-admin-table" role="region" tabIndex={0}>
      <div className="el-admin-row is-head"><span>{text.reference}</span><span>{text.customer}</span><span>{text.state}</span><span>{text.payment}</span><span>{text.amount}</span></div>
      {orders.map((order) => (
        <button className="el-admin-row" key={order.id} onClick={() => onSelect?.(order)} type="button">
          <span><b>{order.order_number}</b><small>{dateTime(order.created_at, locale)}</small></span><span>{order.customer_name}</span><span><Status value={order.state} /></span><span><Status value={order.payment_status} /></span><span>{money(order.amount_total, locale)} EGP</span>
        </button>
      ))}
    </div>
  );
}

function AdminActionDialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
    ) ?? []).filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="el-admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-labelledby={titleId} aria-modal="true" className="el-admin-dialog" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog">
        <header><h2 id={titleId}>{title}</h2><button aria-label={closeLabel} onClick={onClose} ref={closeButtonRef} type="button">×</button></header>
        {children}
      </section>
    </div>
  );
}

function CardHeading({ title }: { title: string }) { return <header className="el-admin-card-heading"><h2>{title}</h2></header>; }
function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) { return <article className="el-admin-kpi"><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>; }
function Queue({ label, value }: { label: string; value: number }) { return <div className="el-admin-queue"><span>{label}</span><strong>{value}</strong></div>; }
function Status({ value }: { value: string }) { return <span className={`el-admin-status is-${value.replaceAll("_", "-")}`}>{humanize(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="el-admin-empty">{text}</p>; }
function AdminLoading({ label }: { label: string }) { return <div aria-busy="true" aria-live="polite" className="el-admin-loading"><span aria-hidden="true" /><p>{label}</p></div>; }
function AdminError({ message: value }: { message: string }) { return <p className="el-admin-error" role="alert">{value}</p>; }

async function freshSession(fallback: CustomerSession) {
  return await restoreSession() ?? fallback;
}

function errorStatus(reason: unknown) {
  return typeof reason === "object" && reason && "status" in reason
    ? Number((reason as { status?: number }).status)
    : 0;
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "The operation could not be completed.";
}

function money(value: string | number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function number(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value);
}

function shortDate(value: string, locale: "en" | "ar") {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short" }).format(date);
}

function dateTime(value: string, locale: "en" | "ar") {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
