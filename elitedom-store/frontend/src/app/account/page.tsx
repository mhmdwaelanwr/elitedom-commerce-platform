"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
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
      <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center">
        <section className="w-full max-w-lg">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <UserIcon large />
          </span>
          <p className="section-kicker mt-7">{t("account", "dashboard")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("account", "signInTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted sm:text-base">
            {t("account", "signInText")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className="button-primary" href="/signin?next=/account">
              {t("account", "signIn")}
            </Link>
            <Link className="button-secondary" href="/signup">
              {t("account", "createAccount")}
            </Link>
          </div>
        </section>
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
  const initial = profileName.trim().slice(0, 1).toUpperCase() || "E";

  async function handleLogout() {
    try {
      await logout(activeSession);
    } catch {
      // Clear browser state even when the API is temporarily unavailable.
    }
    setSession(null);
    notify(t("account", "signedOut"), "info");
  }

  const quickActions = [
    {
      detail: t("account", "allOrdersDescription"),
      href: "/account/orders",
      icon: <OrdersIcon />,
      label: t("account", "orders"),
    },
    {
      detail: t("account", "updateContact"),
      href: "/account/profile",
      icon: <UserIcon />,
      label: t("account", "personalDetails"),
    },
    {
      detail: t("account", "manageDelivery"),
      href: "/account/addresses",
      icon: <LocationIcon />,
      label: t("account", "savedAddresses"),
    },
    {
      detail: t("auth", "securityDescription"),
      href: "/account/security",
      icon: <ShieldIcon />,
      label: t("auth", "securityTitle"),
    },
    {
      detail: t("account", "openClaim"),
      href: "/warranty",
      icon: <WarrantyIcon />,
      label: t("account", "warrantyRma"),
    },
    {
      detail: t("account", "procurementRfq"),
      href: "/b2b",
      icon: <BusinessIcon />,
      label: t("account", "businessQuotes"),
    },
  ];

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-contrast sm:h-16 sm:w-16 sm:text-2xl">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="section-kicker">{t("account", "dashboard")}</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {t("account", "hello")}, {profileName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                {accountIdentifier && <span className="truncate">{accountIdentifier}</span>}
                <span className="rounded-full bg-elevated px-2.5 py-1 font-bold capitalize text-foreground">
                  {activeSession.role.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>
          <button className="button-secondary w-fit px-4 py-2.5 text-sm" onClick={handleLogout} type="button">
            <LogoutIcon />
            {t("account", "signOut")}
          </button>
        </div>

        <div className="grid border-t border-border md:grid-cols-[0.75fr_1.25fr]">
          <div className="border-b border-border bg-elevated p-6 md:border-b-0 md:border-e sm:p-7">
            <div className="flex items-center gap-2 text-sm font-bold text-muted">
              <CoinIcon />
              <span>{t("account", "loyaltyPoints")}</span>
            </div>
            <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
              {overview?.loyalty ? String(overview.loyalty.points_balance) : isLoading ? "…" : "0"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {overview?.loyalty
                ? `${formatPrice(Number(overview.loyalty.redeemable_value_egp), currency, locale)} ${t("account", "redeemable")}`
                : t("account", "earnPoints")}
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border rtl:divide-x-reverse sm:grid-cols-3">
            {quickActions.map((action) => (
              <AccountAction key={action.href} {...action} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <p className="section-kicker">{t("account", "orders")}</p>
            <h2 className="mt-1 text-xl font-black text-foreground">{t("account", "recentOrders")}</h2>
            <p className="mt-1 text-xs text-muted">{t("account", "ordersSynced")}</p>
          </div>
          <Link className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-black text-primary hover:underline" href="/account/orders">
            {t("account", "allOrders")}
            <ArrowIcon />
          </Link>
        </header>

        {recentOrders.length > 0 ? (
          <div>
            {recentOrders.map((order) => (
              <article className="grid gap-4 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6" key={order.id}>
                <div className="min-w-0">
                  <Link className="focus-ring truncate rounded-md font-black text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>
                    {order.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{formatDate(order.created_at, locale)}</p>
                </div>
                <span className="w-fit rounded-full bg-[var(--ds-soft-primary)] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
                  {order.state.replaceAll("_", " ")}
                </span>
                <p className="font-black text-foreground sm:min-w-32 sm:text-end">
                  {formatPrice(Number(order.amount_total), currency, locale)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-elevated text-primary">
              <OrdersIcon />
            </span>
            <p className="mt-4 text-sm text-muted">
              {isLoading ? t("account", "loadingOrders") : t("account", "noOrders")}
            </p>
            {!isLoading && (
              <Link className="button-primary mt-5" href="/shop">
                {t("account", "browseProducts")}
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AccountAction({ detail, href, icon, label }: { detail: string; href: string; icon: ReactNode; label: string }) {
  return (
    <Link className="focus-ring group min-h-36 p-4 transition hover:bg-elevated sm:p-5" href={href}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary transition group-hover:bg-primary group-hover:text-primary-contrast">
        {icon}
      </span>
      <p className="mt-3 text-sm font-black text-foreground group-hover:text-primary">{label}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted">{detail}</p>
    </Link>
  );
}

function UserIcon({ large = false }: { large?: boolean }) {
  const size = large ? 32 : 18;
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c.8-3.2 3.3-5.2 7-5.2s6.2 2 7 5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M5 4h14v16H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function WarrantyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M6 4h12v16H6V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function BusinessIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1M2 21h20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9.5c0-1 1.1-1.8 3-1.8s3 .8 3 1.8-1.1 1.8-3 1.8-3 .8-3 1.8 1.1 1.8 3 1.8 3-.8 3-1.8M12 6v12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
