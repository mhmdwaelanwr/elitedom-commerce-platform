"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
      <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-3xl text-primary">◌</div>
          <h1 className="mt-4 text-3xl font-black text-foreground">{t("account", "signInTitle")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{t("account", "signInText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="button-primary" href="/signin?next=/account">
              {t("account", "signIn")}
            </Link>
            <Link className="button-secondary" href="/signup">
              {t("account", "createAccount")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSession = session;
  const profileName = overview?.profile?.name ?? activeSession.name ?? t("account", "customerFallback");
  const recentOrders = overview?.orders ?? [];

  async function handleLogout() {
    try {
      await logout(activeSession);
    } catch {
      // Clear browser state even when the API is temporarily unavailable.
    }
    setSession(null);
    notify(t("account", "signedOut"), "info");
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="section-kicker">{t("account", "dashboard")}</p>
            <h1 className="mt-2 text-3xl font-black text-foreground">
              {t("account", "hello")}, {profileName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {overview?.profile?.email ?? activeSession.email} · {activeSession.role.replaceAll("_", " ")}
            </p>
          </div>
          <button className="button-secondary text-sm" onClick={handleLogout} type="button">
            {t("account", "signOut")}
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AccountMetric
          detail={overview?.loyalty
            ? `${formatPrice(Number(overview.loyalty.redeemable_value_egp), currency, locale)} ${t("account", "redeemable")}`
            : t("account", "earnPoints")}
          label={t("account", "loyaltyPoints")}
          value={overview?.loyalty ? String(overview.loyalty.points_balance) : isLoading ? "…" : "0"}
        />
        <AccountMetric
          detail={t("account", "latestFive")}
          label={t("account", "recentOrders")}
          value={isLoading ? "…" : String(recentOrders.length)}
        />
        <AccountLink
          detail={t("account", "updateContact")}
          href="/account/profile"
          icon="◌"
          label={t("account", "personalDetails")}
        />
        <AccountLink
          detail={t("account", "manageDelivery")}
          href="/account/addresses"
          icon="⌂"
          label={t("account", "savedAddresses")}
        />
        <AccountLink
          detail={t("account", "openClaim")}
          href="/warranty"
          icon="⌁"
          label={t("account", "warrantyRma")}
        />
        <AccountLink
          detail={t("account", "procurementRfq")}
          href="/b2b"
          icon="▣"
          label={t("account", "businessQuotes")}
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-elevated p-6">
          <div>
            <h2 className="text-xl font-black text-foreground">{t("account", "recentOrders")}</h2>
            <p className="mt-1 text-sm text-muted">{t("account", "ordersSynced")}</p>
          </div>
          <Link className="focus-ring rounded-md text-sm font-bold text-primary hover:brightness-110" href="/shop">
            {t("account", "shopAgain")}
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <article className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={order.id}>
                <div>
                  <p className="font-bold text-foreground">{order.name}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(order.created_at, locale)}</p>
                </div>
                <div className="sm:text-end">
                  <p className="font-bold text-foreground">{formatPrice(Number(order.amount_total), currency, locale)}</p>
                  <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    {order.state.replaceAll("_", " ")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-muted">{isLoading ? t("account", "loadingOrders") : t("account", "noOrders")}</p>
            <Link className="button-primary mt-5" href="/shop">
              {t("account", "browseProducts")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </article>
  );
}

function AccountLink({ detail, href, icon, label }: { detail: string; href: string; icon: string; label: string }) {
  return (
    <Link className="focus-ring group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary hover:bg-elevated" href={href}>
      <span className="text-xl text-primary">{icon}</span>
      <p className="mt-2 font-bold text-foreground group-hover:text-primary">{label}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </Link>
  );
}
