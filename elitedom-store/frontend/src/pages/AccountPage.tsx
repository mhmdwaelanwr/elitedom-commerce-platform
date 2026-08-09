import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  fetchCustomerProfile,
  fetchRemoteWishlist,
  removeRemoteWishlistItem,
  setDefaultCustomerAddress,
  updateCustomerProfile,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/api";
import {
  fetchCustomerOrders,
  fetchLoyaltyBalance,
  fetchLoyaltyHistory,
  type AccountOrder,
  type LoyaltyBalance,
  type LoyaltyHistoryItem,
} from "@/lib/account-api";
import {
  fetchAuthSessions,
  fetchMfaStatus,
  logoutAllSessions,
  logoutSession,
  revokeAuthSession,
  type AuthDeviceSession,
  type MfaStatus,
} from "@/lib/auth-api";
import { clearStoredSession, restoreSession } from "@/lib/auth-session";
import { fetchRichCatalog } from "@/lib/catalog-api";
import type { CustomerSession, Product } from "@/types/store";
import "@/styles/account.css";

type Section = "overview" | "orders" | "addresses" | "saved" | "profile" | "security" | "loyalty";

type AccountData = {
  profile: CustomerProfile | null;
  orders: AccountOrder[];
  orderCount: number;
  loyalty: LoyaltyBalance | null;
  loyaltyHistory: LoyaltyHistoryItem[];
  savedIds: string[];
  savedProducts: Product[];
  addresses: CustomerAddress[];
  mfa: MfaStatus | null;
  sessions: AuthDeviceSession[];
};

const emptyData: AccountData = {
  profile: null,
  orders: [],
  orderCount: 0,
  loyalty: null,
  loyaltyHistory: [],
  savedIds: [],
  savedProducts: [],
  addresses: [],
  mfa: null,
  sessions: [],
};

const navItems: Array<[Section, StoreIconName]> = [
  ["overview", "home"],
  ["orders", "clipboard"],
  ["addresses", "location"],
  ["saved", "heart"],
  ["profile", "account"],
  ["security", "shield"],
  ["loyalty", "star"],
];

const labels = {
  en: {
    subtitle: "Track orders, manage saved hardware, addresses and account security.",
    overview: "Overview",
    orders: "Orders",
    addresses: "Addresses",
    saved: "Saved items",
    profile: "Profile",
    security: "Security",
    loyalty: "Loyalty",
    signOut: "Sign out",
    loyaltyValue: "Loyalty",
    ordersMetric: "Orders",
    savedMetric: "Saved items",
    securityMetric: "Security",
    points: "points",
    protected: "Protected",
    recentOrders: "Recent orders",
    activeOrder: "Active order",
    noOrders: "No orders yet. Your next build can start in the catalogue.",
    viewOrder: "Order details",
    orderItems: "items",
    default: "Default",
    makeDefault: "Make default",
    delete: "Delete",
    addAddress: "Add address",
    saveAddress: "Save address",
    noAddresses: "No saved addresses yet.",
    remove: "Remove",
    noSaved: "No saved hardware yet.",
    shop: "Browse hardware",
    saveProfile: "Save profile",
    sessions: "Active sessions",
    revoke: "Revoke",
    current: "Current",
    logoutAll: "Sign out all sessions",
    staffMfa: "Staff MFA",
    customerSecurity: "Customer sessions are protected by revocable refresh credentials and phone OTP sign-in.",
    pointsBalance: "Points balance",
    redeemable: "Redeemable value",
    history: "Points history",
    noHistory: "No loyalty activity yet.",
    loading: "Loading your account…",
    loadError: "Some account data could not be loaded. You can refresh this page to retry.",
  },
  ar: {
    subtitle: "تابع طلباتك والهاردوير المحفوظ والعناوين وأمان الحساب.",
    overview: "نظرة عامة",
    orders: "الطلبات",
    addresses: "العناوين",
    saved: "المحفوظات",
    profile: "الملف الشخصي",
    security: "الأمان",
    loyalty: "النقاط",
    signOut: "تسجيل الخروج",
    loyaltyValue: "النقاط",
    ordersMetric: "الطلبات",
    savedMetric: "المحفوظات",
    securityMetric: "الأمان",
    points: "نقطة",
    protected: "محمي",
    recentOrders: "آخر الطلبات",
    activeOrder: "طلب نشط",
    noOrders: "مفيش طلبات لسه. ابدأ التجميعة الجاية من الكتالوج.",
    viewOrder: "تفاصيل الطلب",
    orderItems: "منتج",
    default: "الافتراضي",
    makeDefault: "اجعله الافتراضي",
    delete: "حذف",
    addAddress: "إضافة عنوان",
    saveAddress: "حفظ العنوان",
    noAddresses: "مفيش عناوين محفوظة لسه.",
    remove: "إزالة",
    noSaved: "مفيش هاردوير محفوظ لسه.",
    shop: "تصفح الهاردوير",
    saveProfile: "حفظ البيانات",
    sessions: "الجلسات النشطة",
    revoke: "إنهاء",
    current: "الحالية",
    logoutAll: "تسجيل الخروج من كل الأجهزة",
    staffMfa: "MFA للموظفين",
    customerSecurity: "جلسات العميل محمية بتوكنات قابلة للإلغاء وتسجيل دخول OTP بالموبايل.",
    pointsBalance: "رصيد النقاط",
    redeemable: "القيمة القابلة للاستخدام",
    history: "سجل النقاط",
    noHistory: "مفيش حركة نقاط لسه.",
    loading: "بنحمّل حسابك…",
    loadError: "جزء من بيانات الحساب متحملش. حدّث الصفحة للمحاولة تاني.",
  },
} as const;

type AccountText = (typeof labels)[keyof typeof labels];

function isSection(value: string | null): value is Section {
  return navItems.some(([section]) => section === value);
}

export function AccountPage() {
  const [locale, setLocale] = useStoreLocale();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const text = labels[locale];
  const rawSection = searchParams.get("section");
  const section: Section = isSection(rawSection) ? rawSection : "overview";
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [data, setData] = useState<AccountData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [partialError, setPartialError] = useState(false);

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (currentSession) => {
      if (!active) return;
      if (!currentSession) {
        const destination = `/account${section !== "overview" ? `?section=${section}` : ""}`;
        navigate(`/auth?next=${encodeURIComponent(destination)}`, { replace: true });
        return;
      }

      setSession(currentSession);
      const results = await Promise.allSettled([
        fetchCustomerProfile(currentSession),
        fetchCustomerOrders(currentSession),
        fetchLoyaltyBalance(currentSession),
        fetchLoyaltyHistory(currentSession),
        fetchRemoteWishlist(currentSession),
        fetchCustomerAddresses(currentSession),
        fetchMfaStatus(currentSession),
        fetchAuthSessions(currentSession),
        fetchRichCatalog({ locale, limit: 100 }),
      ] as const);
      if (!active) return;

      const [profileResult, ordersResult, loyaltyResult, historyResult, wishlistResult, addressesResult, mfaResult, sessionsResult, catalogResult] = results;
      const savedIds = wishlistResult.status === "fulfilled" ? wishlistResult.value : [];
      const catalog = catalogResult.status === "fulfilled" ? catalogResult.value : [];
      const savedSet = new Set(savedIds);

      setData({
        profile: profileResult.status === "fulfilled" ? profileResult.value : null,
        orders: ordersResult.status === "fulfilled" ? ordersResult.value.orders : [],
        orderCount: ordersResult.status === "fulfilled" ? ordersResult.value.total_count : 0,
        loyalty: loyaltyResult.status === "fulfilled" ? loyaltyResult.value : null,
        loyaltyHistory: historyResult.status === "fulfilled" ? historyResult.value.transactions : [],
        savedIds,
        savedProducts: catalog.filter((product) => savedSet.has(product.id)),
        addresses: addressesResult.status === "fulfilled" ? addressesResult.value : [],
        mfa: mfaResult.status === "fulfilled" ? mfaResult.value : null,
        sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value : [],
      });
      setPartialError(results.slice(0, 8).some((result) => result.status === "rejected"));
      setLoading(false);
    });
    return () => { active = false; };
  }, [locale, navigate, section]);

  async function signOut() {
    if (session) {
      try {
        await logoutSession(session);
      } catch {
        // Clear the browser session even if the network is unavailable.
      }
    }
    clearStoredSession();
    navigate("/", { replace: true });
  }

  const displayName = data.profile?.name || session?.name || "Elitedom customer";
  const firstName = displayName.trim().split(/\s+/)[0] || (locale === "ar" ? "صديقنا" : "there");
  const greeting = locale === "ar" ? `أهلاً، ${firstName}.` : `Good morning, ${firstName}.`;

  return (
    <div className="el-account-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main>
          <header className="el-account-intro">
            <h1>{greeting}</h1>
            <p>{text.subtitle}</p>
          </header>

          {loading ? <AccountLoading label={text.loading} /> : (
            <div className="el-account-layout">
              <aside className="el-account-nav">
                <div className="el-account-nav__identity">
                  <div>{initials(displayName)}</div>
                  <span><strong>{displayName}</strong><small>{publicEmail(data.profile?.email || session?.email)}</small></span>
                </div>
                <nav aria-label="Account sections">
                  {navItems.map(([item, icon]) => (
                    <Link className={section === item ? "is-active" : ""} key={item} to={item === "overview" ? "/account" : `/account?section=${item}`}>
                      <StoreIcon name={icon} size={19} />{text[item]}
                    </Link>
                  ))}
                </nav>
                <button onClick={() => void signOut()} type="button"><StoreIcon name="arrow" size={18} />{text.signOut}</button>
              </aside>

              <section className="el-account-content">
                {partialError ? <p className="el-account-warning">{text.loadError}</p> : null}
                {section === "overview" ? <Overview data={data} locale={locale} text={text} /> : null}
                {section === "orders" ? <OrdersSection orders={data.orders} locale={locale} text={text} /> : null}
                {section === "addresses" && session ? <AddressesSection addresses={data.addresses} locale={locale} onChange={(addresses) => setData((current) => ({ ...current, addresses }))} session={session} text={text} /> : null}
                {section === "saved" && session ? <SavedSection locale={locale} onRemove={(productId) => setData((current) => ({ ...current, savedIds: current.savedIds.filter((id) => id !== productId), savedProducts: current.savedProducts.filter((product) => product.id !== productId) }))} products={data.savedProducts} session={session} text={text} /> : null}
                {section === "profile" && session ? <ProfileSection locale={locale} onChange={(profile) => setData((current) => ({ ...current, profile }))} profile={data.profile} session={session} text={text} /> : null}
                {section === "security" && session ? <SecuritySection mfa={data.mfa} navigate={navigate} onSessions={(sessions) => setData((current) => ({ ...current, sessions }))} session={session} sessions={data.sessions} text={text} /> : null}
                {section === "loyalty" ? <LoyaltySection balance={data.loyalty} history={data.loyaltyHistory} locale={locale} text={text} /> : null}
              </section>
            </div>
          )}
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function Overview({ data, locale, text }: { data: AccountData; locale: "en" | "ar"; text: AccountText }) {
  const active = data.orders.find((order) => !["done", "cancel"].includes(order.state));
  return <>
    <div className="el-account-metrics">
      <Metric icon="star" label={text.loyaltyValue} value={`${formatNumber(data.loyalty?.points_balance ?? 0, locale)} ${text.points}`} />
      <Metric icon="clipboard" label={text.ordersMetric} value={formatNumber(data.orderCount, locale)} />
      <Metric icon="heart" label={text.savedMetric} value={formatNumber(data.savedIds.length, locale)} />
      <Metric icon="shield" label={text.securityMetric} value={text.protected} />
    </div>
    {active ? <div className="el-account-block"><div className="el-account-heading"><h2>{text.activeOrder}</h2></div><OrderCard featured locale={locale} order={active} text={text} /></div> : null}
    <div className="el-account-block">
      <div className="el-account-heading"><h2>{text.recentOrders}</h2><Link to="/account?section=orders">{text.orders} <StoreIcon name="arrow" size={15} /></Link></div>
      {data.orders.length ? <div className="el-account-order-list">{data.orders.slice(0, 3).map((order) => <OrderCard key={order.id} locale={locale} order={order} text={text} />)}</div> : <EmptyState action={text.shop} href="/catalog" icon="clipboard" message={text.noOrders} />}
    </div>
  </>;
}

function Metric({ icon, label, value }: { icon: StoreIconName; label: string; value: string }) {
  return <article className="el-account-metric"><div><StoreIcon name={icon} size={21} /></div><span>{label}</span><strong>{value}</strong></article>;
}

function OrdersSection({ orders, locale, text }: { orders: AccountOrder[]; locale: "en" | "ar"; text: AccountText }) {
  return <div className="el-account-block"><div className="el-account-heading"><h2>{text.orders}</h2></div>{orders.length ? <div className="el-account-order-list">{orders.map((order) => <OrderCard key={order.id} locale={locale} order={order} text={text} />)}</div> : <EmptyState action={text.shop} href="/catalog" icon="clipboard" message={text.noOrders} />}</div>;
}

function OrderCard({ order, locale, text, featured = false }: { order: AccountOrder; locale: "en" | "ar"; text: AccountText; featured?: boolean }) {
  const quantity = order.order_lines.reduce((sum, line) => sum + line.quantity, 0);
  return <article className={`el-account-order ${featured ? "is-featured" : ""}`}>
    <div className="el-account-order__icon"><StoreIcon name={order.state === "done" ? "check" : "package"} size={24} /></div>
    <div className="el-account-order__main"><span className="el-account-status">{humanize(order.state)}</span><h3>{order.name}</h3><p>{formatDate(order.created_at, locale)} · {quantity} {text.orderItems} · {humanize(order.payment_status)}</p></div>
    <strong>{formatMoney(Number(order.amount_total), locale)} {order.currency}</strong>
    <span className="el-account-order__action">{text.viewOrder}</span>
  </article>;
}

function AddressesSection({ addresses, session, onChange, locale, text }: { addresses: CustomerAddress[]; session: CustomerSession; onChange: (addresses: CustomerAddress[]) => void; locale: "en" | "ar"; text: AccountText }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const address = await createCustomerAddress({
        label: String(form.get("label") || "Home"),
        recipient_name: String(form.get("name") || ""),
        recipient_phone: String(form.get("phone") || ""),
        street_address: String(form.get("street") || ""),
        address_line_2: null,
        city: String(form.get("city") || ""),
        governorate: String(form.get("governorate") || ""),
        postal_code: null,
        country: "Egypt",
        is_default: addresses.length === 0,
      }, session);
      onChange([...addresses, address]);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Address could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function makeDefault(id: number) {
    const updated = await setDefaultCustomerAddress(id, session);
    onChange(addresses.map((address) => ({ ...address, is_default: address.id === updated.id })));
  }

  async function remove(id: number) {
    await deleteCustomerAddress(id, session);
    onChange(addresses.filter((address) => address.id !== id));
  }

  return <div className="el-account-block">
    <div className="el-account-heading"><h2>{text.addresses}</h2><button onClick={() => setOpen((value) => !value)} type="button"><StoreIcon name="plus" size={15} />{text.addAddress}</button></div>
    {open ? <form className="el-account-form el-address-form" onSubmit={create}>
      <AccountInput label={locale === "ar" ? "اسم العنوان" : "Label"} name="label" placeholder="Home" />
      <AccountInput label={locale === "ar" ? "اسم المستلم" : "Recipient name"} name="name" required />
      <AccountInput label={locale === "ar" ? "الموبايل" : "Phone"} name="phone" required />
      <AccountInput label={locale === "ar" ? "الشارع والعنوان" : "Street address"} name="street" required />
      <AccountInput label={locale === "ar" ? "المدينة" : "City"} name="city" required />
      <AccountInput label={locale === "ar" ? "المحافظة" : "Governorate"} name="governorate" required />
      {error ? <p className="el-account-error">{error}</p> : null}
      <button className="el-account-primary" disabled={pending} type="submit">{text.saveAddress}</button>
    </form> : null}
    {addresses.length ? <div className="el-address-list">{addresses.map((address) => <article className="el-address-card" key={address.id}>
      <div><span><StoreIcon name="location" size={20} />{address.label}</span>{address.is_default ? <b>{text.default}</b> : null}</div>
      <h3>{address.recipient_name}</h3>
      <p>{address.street_address}<br />{address.city}, {address.governorate} · {address.country}<br />{address.recipient_phone}</p>
      <footer>{!address.is_default ? <button onClick={() => void makeDefault(address.id)} type="button">{text.makeDefault}</button> : null}<button onClick={() => void remove(address.id)} type="button">{text.delete}</button></footer>
    </article>)}</div> : <EmptyState icon="location" message={text.noAddresses} />}
  </div>;
}

function SavedSection({ products, session, onRemove, text, locale }: { products: Product[]; session: CustomerSession; onRemove: (id: string) => void; text: AccountText; locale: "en" | "ar" }) {
  async function remove(id: string) {
    await removeRemoteWishlistItem(id, session);
    onRemove(id);
  }

  return <div className="el-account-block">
    <div className="el-account-heading"><h2>{text.saved}</h2></div>
    {products.length ? <div className="el-saved-grid">{products.map((product) => <article className="el-saved-card" key={product.id}>
      <Link className="el-saved-card__media" to={`/products/${product.id}`}><img alt={product.name} src={product.image} /></Link>
      <div><span>{product.brand}</span><Link to={`/products/${product.id}`}>{product.name}</Link><strong>{formatMoney(product.priceEgp, locale)} EGP</strong><button onClick={() => void remove(product.id)} type="button"><StoreIcon name="heart" size={15} />{text.remove}</button></div>
    </article>)}</div> : <EmptyState action={text.shop} href="/catalog" icon="heart" message={text.noSaved} />}
  </div>;
}

function ProfileSection({ profile, session, onChange, text, locale }: { profile: CustomerProfile | null; session: CustomerSession; onChange: (profile: CustomerProfile) => void; text: AccountText; locale: "en" | "ar" }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    setPending(true);
    setNotice("");
    try {
      const updated = await updateCustomerProfile({
        name: String(form.get("name") || ""),
        ...(email ? { email } : {}),
        phone: String(form.get("phone") || ""),
        governorate: String(form.get("governorate") || "") || undefined,
        street_address: String(form.get("street") || "") || undefined,
      }, session);
      onChange(updated);
      setNotice(locale === "ar" ? "تم حفظ البيانات." : "Profile saved.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return <div className="el-account-block">
    <div className="el-account-heading"><h2>{text.profile}</h2></div>
    <form className="el-account-form" onSubmit={submit}>
      <AccountInput defaultValue={profile?.name} label={locale === "ar" ? "الاسم" : "Name"} name="name" required />
      <AccountInput defaultValue={publicEmail(profile?.email)} label={locale === "ar" ? "الإيميل" : "Email"} name="email" type="email" />
      <AccountInput defaultValue={profile?.phone} label={locale === "ar" ? "الموبايل" : "Phone"} name="phone" required />
      <AccountInput defaultValue={profile?.governorate ?? ""} label={locale === "ar" ? "المحافظة" : "Governorate"} name="governorate" />
      <AccountInput defaultValue={profile?.street_address ?? ""} label={locale === "ar" ? "العنوان" : "Street address"} name="street" />
      {notice ? <p className="el-account-note">{notice}</p> : null}
      <button className="el-account-primary" disabled={pending} type="submit">{text.saveProfile}</button>
    </form>
  </div>;
}

function SecuritySection({ session, sessions, mfa, onSessions, navigate, text }: { session: CustomerSession; sessions: AuthDeviceSession[]; mfa: MfaStatus | null; onSessions: (sessions: AuthDeviceSession[]) => void; navigate: ReturnType<typeof useNavigate>; text: AccountText }) {
  const [pending, setPending] = useState(false);

  async function revoke(device: AuthDeviceSession) {
    setPending(true);
    try {
      await revokeAuthSession(device.id, session);
      if (device.current) {
        clearStoredSession();
        navigate("/auth", { replace: true });
        return;
      }
      onSessions(sessions.filter((item) => item.id !== device.id));
    } finally {
      setPending(false);
    }
  }

  async function signOutEverywhere() {
    setPending(true);
    try {
      await logoutAllSessions(session);
    } finally {
      clearStoredSession();
      navigate("/auth", { replace: true });
    }
  }

  return <div className="el-account-block">
    <div className="el-account-heading"><h2>{text.security}</h2></div>
    <div className="el-security-summary"><div><StoreIcon name="shield" size={24} /><span><strong>{text.protected}</strong><small>{text.customerSecurity}</small></span></div><span>{mfa?.required ? text.staffMfa : "OTP + revocable sessions"}</span></div>
    <h3 className="el-account-subheading">{text.sessions}</h3>
    <div className="el-session-list">{sessions.map((device) => <article key={device.id}>
      <div><StoreIcon name="clock" size={18} /><span><strong>{device.user_agent || humanize(device.auth_method)}</strong><small>{device.ip_address || "Private network"} · {formatDate(device.created_at, "en")}</small></span></div>
      <span>{device.current ? text.current : humanize(device.auth_method)}</span>
      <button disabled={pending} onClick={() => void revoke(device)} type="button">{text.revoke}</button>
    </article>)}</div>
    <button className="el-account-danger" disabled={pending} onClick={() => void signOutEverywhere()} type="button">{text.logoutAll}</button>
  </div>;
}

function LoyaltySection({ balance, history, locale, text }: { balance: LoyaltyBalance | null; history: LoyaltyHistoryItem[]; locale: "en" | "ar"; text: AccountText }) {
  return <div className="el-account-block">
    <div className="el-account-heading"><h2>{text.loyalty}</h2></div>
    <div className="el-loyalty-hero">
      <div><span>{text.pointsBalance}</span><strong>{formatNumber(balance?.points_balance ?? 0, locale)}</strong></div>
      <div><span>{text.redeemable}</span><strong>{formatMoney(Number(balance?.redeemable_value_egp ?? 0), locale)} EGP</strong></div>
    </div>
    <h3 className="el-account-subheading">{text.history}</h3>
    {history.length ? <div className="el-loyalty-history">{history.map((entry) => <article key={entry.id}>
      <div><StoreIcon name={entry.points_delta >= 0 ? "plus" : "minus"} size={18} /><span><strong>{entry.description || humanize(entry.transaction_type)}</strong><small>{formatDate(entry.created_at, locale)}{entry.reference_order_id ? ` · #${entry.reference_order_id}` : ""}</small></span></div>
      <b className={entry.points_delta >= 0 ? "is-positive" : ""}>{entry.points_delta > 0 ? "+" : ""}{formatNumber(entry.points_delta, locale)}</b>
    </article>)}</div> : <EmptyState icon="star" message={text.noHistory} />}
  </div>;
}

function AccountInput({ label, name, defaultValue = "", placeholder, required = false, type = "text" }: { label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; type?: string }) {
  return <label className="el-account-input"><span>{label}</span><input defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function EmptyState({ icon, message, action, href }: { icon: StoreIconName; message: string; action?: string; href?: string }) {
  return <div className="el-account-empty"><StoreIcon name={icon} size={28} /><p>{message}</p>{action && href ? <Link to={href}>{action} <StoreIcon name="arrow" size={14} /></Link> : null}</div>;
}

function AccountLoading({ label }: { label: string }) {
  return <div className="el-account-loading"><span /><span /><span /><p>{label}</p></div>;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E";
}

function publicEmail(value?: string | null) {
  return value && value.includes("@") && !value.endsWith("@phone.elitedom.local") ? value : "";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value);
}

function formatMoney(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}
