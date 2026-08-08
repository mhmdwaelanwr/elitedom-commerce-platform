"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { fetchAccountOverview, logout } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type Overview = Awaited<ReturnType<typeof fetchAccountOverview>>;
type AccountIcon = "orders" | "profile" | "address" | "security" | "warranty" | "business";

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
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-primary" aria-hidden="true"><UserIcon /></span>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-foreground">{t("account", "signInTitle")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("account", "signInText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="button-primary" href="/signin?next=/account">{t("account", "signIn")}</Link>
            <Link className="button-secondary" href="/signup">{t("account", "createAccount")}</Link>
          </div>
        </div>
      </main>
    );
  }

  const activeSession = session;
  const profileName = overview?.profile?.name ?? activeSession.name ?? t("account", "customerFallback");
  const recentOrders = overview?.orders ?? [];
  const profileEmail = overview?.profile?.email ?? activeSession.email ?? "";
  const accountIdentifier = profileEmail.endsWith("@phone.elitedom.local") ? overview?.profile?.phone ?? "" : profileEmail;

  async function handleLogout() {
    try {
      await logout(activeSession);
    } catch {
      // Clear browser state even when the API is temporarily unavailable.
    }
    setSession(null);
    notify(t("account", "signedOut"), "info");
  }

  const links: Array<{ detail: string; href: string; icon: AccountIcon; label: string }> = [
    { detail: t("account", "allOrdersDescription"), href: "/account/orders", icon: "orders", label: t("account", "orders") },
    { detail: t("account", "updateContact"), href: "/account/profile", icon: "profile", label: t("account", "personalDetails") },
    { detail: t("account", "manageDelivery"), href: "/account/addresses", icon: "address", label: t("account", "savedAddresses") },
    { detail: t("auth", "securityDescription"), href: "/account/security", icon: "security", label: t("auth", "securityTitle") },
    { detail: t("account", "openClaim"), href: "/warranty", icon: "warranty", label: t("account", "warrantyRma") },
    { detail: t("account", "procurementRfq"), href: "/b2b", icon: "business", label: t("account", "businessQuotes") },
  ];

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <section className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-9">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--ds-primary-soft)] text-xl font-bold text-primary" aria-hidden="true">
            {profileName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary">{t("account", "dashboard")}</p>
            <h1 className="mt-1 truncate text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl">{t("account", "hello")}, {profileName}</h1>
            <p className="mt-2 truncate text-sm text-muted">{accountIdentifier}</p>
          </div>
        </div>
        <button className="button-secondary" onClick={handleLogout} type="button">{t("account", "signOut")}</button>
      </section>

      <section className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">{t("account", "personalDetails")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => <AccountLink key={link.href} {...link} />)}
          </div>
        </div>

        <aside className="h-fit rounded-2xl bg-elevated p-6">
          <p className="text-sm font-medium text-muted">{t("account", "loyaltyPoints")}</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground">{overview?.loyalty ? String(overview.loyalty.points_balance) : isLoading ? "…" : "0"}</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            {overview?.loyalty ? `${formatPrice(Number(overview.loyalty.redeemable_value_egp), currency, locale)} ${t("account", "redeemable")}` : t("account", "earnPoints")}
          </p>
        </aside>
      </section>

      <section className="mt-14 sm:mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground sm:text-3xl">{t("account", "recentOrders")}</h2>
            <p className="mt-2 text-sm text-muted">{t("account", "ordersSynced")}</p>
          </div>
          <Link className="focus-ring rounded-full px-4 py-2 text-sm font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href="/account/orders">{t("account", "allOrders")}</Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="mt-6 divide-y divide-border border-y border-border">
            {recentOrders.map((order) => (
              <article className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={order.id}>
                <div>
                  <Link className="focus-ring rounded-lg text-base font-bold text-foreground hover:text-primary" href={`/account/orders/${order.id}`}>{order.name}</Link>
                  <p className="mt-1 text-xs text-muted">{formatDate(order.created_at, locale)}</p>
                </div>
                <div className="sm:text-end">
                  <p className="font-bold text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</p>
                  <p className="mt-1 inline-flex rounded-full bg-[var(--ds-primary-soft)] px-2.5 py-1 text-xs font-medium text-primary">{order.state.replaceAll("_", " ")}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-elevated p-8 text-center">
            <p className="text-sm text-muted">{isLoading ? t("account", "loadingOrders") : t("account", "noOrders")}</p>
            <Link className="button-primary mt-5" href="/shop">{t("account", "browseProducts")}</Link>
          </div>
        )}
      </section>
    </main>
  );
}

function AccountLink({ detail, href, icon, label }: { detail: string; href: string; icon: AccountIcon; label: string }) {
  return (
    <Link className="focus-ring group rounded-2xl bg-elevated p-5 transition hover:text-primary" href={href}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-primary" aria-hidden="true"><AccountGlyph icon={icon} /></span>
      <p className="mt-4 font-bold text-foreground group-hover:text-primary">{label}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </Link>
  );
}

function AccountGlyph({ icon }: { icon: AccountIcon }) {
  if (icon === "orders") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  if (icon === "profile") return <UserIcon />;
  if (icon === "address") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (icon === "security") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  if (icon === "warranty") return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M9 12.5 11 14l4-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  return <svg fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M4 20V8h16v12M8 8V4h8v4M3 12h18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function UserIcon() {
  return <svg fill="none" height="21" viewBox="0 0 24 24" width="21"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}