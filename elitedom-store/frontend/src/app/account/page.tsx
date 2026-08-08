"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { fetchAccountOverview, logout } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type Overview = Awaited<ReturnType<typeof fetchAccountOverview>>;

export default function AccountPage() {
  const { locale, t } = usePreferences();
  const { currency, notify, session, setSession } = useStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchAccountOverview(session)
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch(() => {
        if (active) setOverview(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return (
      <div className="site-container grid min-h-[58vh] place-items-center py-14 text-center">
        <div className="max-w-lg">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm"><UserIcon /></span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("account", "signInTitle")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{t("account", "signInText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link className="button-primary" href="/signin?next=/account">{t("account", "signIn")}</Link>
            <Link className="button-secondary" href="/signup">{t("account", "createAccount")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSession = session;
  const profileName = overview?.profile?.name ?? activeSession.name ?? t("account", "customerFallback");
  const recentOrders = overview?.orders ?? [];
  const profileEmail = overview?.profile?.email ?? activeSession.email ?? "";
  const accountIdentifier = profileEmail.endsWith("@phone.elitedom.local")
    ? overview?.profile?.phone ?? ""
    : profileEmail;

  async function handleLogout() {
    try {
      await logout(activeSession);
    } catch {
      // Browser state must still be cleared if the API is unavailable.
    }
    setSession(null);
    notify(t("account", "signedOut"), "info");
  }

  return (
    <div className="site-container py-7 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="absolute inset-y-0 end-0 hidden w-1/3 bg-primary/5 lg:block" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-lg font-black text-primary-contrast">
              {profileName.trim().slice(0, 1).toUpperCase() || "E"}
            </span>
            <div className="min-w-0">
              <p className="section-kicker">{t("account", "dashboard")}</p>
              <h1 className="mt-1.5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {t("account", "hello")}, {profileName}
              </h1>
              <p className="mt-2 truncate text-sm text-muted">
                {accountIdentifier} · {activeSession.role.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <button className="button-secondary text-sm" onClick={handleLogout} type="button">{t("account", "signOut")}</button>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountMetric
          detail={overview?.loyalty
            ? `${formatPrice(Number(overview.loyalty.redeemable_value_egp), currency, locale)} ${t("account", "redeemable")}`
            : t("account", "earnPoints")}
          icon={<LoyaltyIcon />}
          label={t("account", "loyaltyPoints")}
          value={overview?.loyalty ? String(overview.loyalty.points_balance) : isLoading ? "…" : "0"}
        />
        <AccountLink detail={t("account", "allOrdersDescription")} href="/account/orders" icon={<OrdersIcon />} label={t("account", "orders")} />
        <AccountLink detail={t("account", "updateContact")} href="/account/profile" icon={<UserIcon />} label={t("account", "personalDetails")} />
        <AccountLink detail={t("account", "manageDelivery")} href="/account/addresses" icon={<LocationIcon />} label={t("account", "savedAddresses")} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">{t("account", "recentOrders")}</h2>
              <p className="mt-1 text-xs text-muted">{t("account", "ordersSynced")}</p>
            </div>
            <Link className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-primary hover:brightness-110" href="/account/orders">
              {t("account", "allOrders")}<ArrowIcon />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <article className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6" key={order.id}>
                  <div className="min-w-0">
                    <Link className="focus-ring rounded-md font-bold text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>{order.name}</Link>
                    <p className="mt-1 text-xs text-muted">{formatDate(order.created_at, locale)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:block sm:text-end">
                    <p className="font-black text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</p>
                    <span className="mt-1 inline-flex rounded-md bg-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {order.state.replaceAll("_", " ")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-elevated text-primary"><OrdersIcon /></span>
              <p className="mt-4 text-sm text-muted">{isLoading ? t("account", "loadingOrders") : t("account", "noOrders")}</p>
              <Link className="button-primary mt-5" href="/shop">{t("account", "browseProducts")}</Link>
            </div>
          )}
        </section>

        <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <QuickAction detail={t("auth", "securityDescription")} href="/account/security" icon={<ShieldIcon />} label={t("auth", "securityTitle")} />
          <QuickAction detail={t("account", "openClaim")} href="/warranty" icon={<WarrantyIcon />} label={t("account", "warrantyRma")} />
          <QuickAction detail={t("account", "procurementRfq")} href="/b2b" icon={<BusinessIcon />} label={t("account", "businessQuotes")} />
        </aside>
      </div>
    </div>
  );
}

function AccountMetric({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-muted">{label}</p><span className="text-primary">{icon}</span></div>
      <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </article>
  );
}

function AccountLink({ detail, href, icon, label }: { detail: string; href: string; icon: ReactNode; label: string }) {
  return (
    <Link className="focus-ring group rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md" href={href}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary group-hover:bg-primary group-hover:text-primary-contrast">{icon}</span>
      <div className="mt-4 flex items-center justify-between gap-3"><p className="font-black text-foreground group-hover:text-primary">{label}</p><ArrowIcon /></div>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </Link>
  );
}

function QuickAction({ detail, href, icon, label }: { detail: string; href: string; icon: ReactNode; label: string }) {
  return (
    <Link className="focus-ring group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/40" href={href}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-primary">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-black text-foreground group-hover:text-primary">{label}</span><span className="mt-1 block text-xs leading-5 text-muted">{detail}</span></span>
      <ArrowIcon />
    </Link>
  );
}

function ArrowIcon() { return <svg aria-hidden="true" className="shrink-0 text-primary rtl:rotate-180" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function UserIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function OrdersIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function LocationIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function ShieldIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function LoyaltyIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></svg>; }
function WarrantyIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function BusinessIcon() { return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M4 7h16v13H4zM8 7V4h8v3M4 12h16M10 12v2h4v-2" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
