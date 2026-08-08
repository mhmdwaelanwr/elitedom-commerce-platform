"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  canAccessAdminSection,
  fetchAdminAccess,
  isStaffRole,
  type AdminAccess,
  type AdminPermission,
  type AdminSection,
} from "@/lib/admin-api";
import { humanize } from "@/lib/admin-ui";
import { logout } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { TranslationKey } from "@/locales";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type NavigationItem = {
  href: string;
  label: TranslationKey<"admin">;
  icon: IconName;
  section?: AdminSection;
  permission?: AdminPermission;
};

const navigation: NavigationItem[] = [
  { href: "/admin", label: "overview", section: "dashboard", icon: "grid" },
  { href: "/admin/orders", label: "orders", section: "orders", icon: "bag" },
  { href: "/admin/products", label: "catalogStock", section: "products", icon: "box" },
  { href: "/admin/customers", label: "customers", section: "customers", icon: "users" },
  { href: "/admin/rma", label: "warrantyDesk", section: "rma", icon: "shield" },
  { href: "/admin/rfqs", label: "b2bRfqs", section: "rfqs", icon: "quote" },
  { href: "/admin/shipments", label: "fulfilment", section: "shipments", icon: "truck" },
  { href: "/admin/payments", label: "payments", permission: "payments.view", icon: "credit" },
  { href: "/admin/suppliers", label: "suppliers", permission: "suppliers.view", icon: "factory" },
  { href: "/admin/integrations", label: "integrations", permission: "integrations.view", icon: "link" },
  { href: "/admin/staff", label: "staffAccess", section: "staff", icon: "key" },
  { href: "/admin/audit", label: "auditLog", section: "audit", icon: "history" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { direction, t } = usePreferences();
  const { notify, session, setSession } = useStore();
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [accessError, setAccessError] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 20);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !session || !isStaffRole(session.role)) return;
    let active = true;
    fetchAdminAccess(session)
      .then((payload) => {
        if (active) {
          setAccess(payload);
          setAccessError(false);
        }
      })
      .catch(() => {
        if (active) {
          setAccess(null);
          setAccessError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ready, session]);

  if (!ready) return <AdminBootScreen />;
  if (!session || !isStaffRole(session.role)) return <RestrictedAdminAccess />;
  if (!access && !accessError) return <AdminBootScreen />;
  if (accessError || !access) return <RestrictedAdminAccess />;

  const visibleNavigation = navigation.filter((item) => {
    if (item.permission) return access.permissions.includes(item.permission);
    return item.section ? canAccessAdminSection(access.permissions, item.section) : false;
  });

  async function signOut() {
    if (!session) return;
    setSigningOut(true);
    try {
      await logout(session);
    } catch {
      // Clear local credentials even when the API session endpoint is offline.
    } finally {
      setSession(null);
      notify(t("admin", "sessionEnded"), "info");
      router.replace("/signin?next=/admin");
    }
  }

  return (
    <div className="admin-console min-h-[calc(100vh-9rem)] border-y border-border bg-background">
      <div className="mx-auto flex w-full max-w-[112rem] flex-col lg:min-h-[calc(100vh-9rem)] lg:flex-row">
        <aside className="border-b border-border bg-surface lg:w-[16rem] lg:shrink-0 lg:border-b-0 lg:border-e">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 lg:px-5">
            <Link className="focus-ring group inline-flex items-center gap-3 rounded-lg" href="/admin">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-contrast shadow-sm"><AdminIcon name="bolt" /></span>
              <span>
                <span className="block text-sm font-black tracking-[-0.03em] text-foreground">ELITEDOM</span>
                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-primary">{t("admin", "operations")}</span>
              </span>
            </Link>
            <Link aria-label={t("admin", "returnToStore")} className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-primary lg:hidden" href="/">
              <StoreIcon direction={direction} />
            </Link>
          </div>

          <nav aria-label={t("admin", "operations")} className="flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-3 lg:py-4">
            {visibleNavigation.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring inline-flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition lg:flex",
                    active
                      ? "bg-primary text-primary-contrast shadow-sm"
                      : "text-muted hover:bg-elevated hover:text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <AdminIcon name={item.icon} />
                  <span className="whitespace-nowrap">{t("admin", item.label)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden border-t border-border p-3 lg:block">
            <div className="rounded-lg bg-elevated/65 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-xs font-black text-primary shadow-sm">
                  {(session.name ?? session.email ?? "E").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">{session.name ?? session.email}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">{humanize(access.role)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[10px] text-muted">{access.permissions.length} {t("admin", "activePermissions")}</span>
                <button className="focus-ring rounded-md text-[11px] font-bold text-primary hover:brightness-110 disabled:opacity-60" disabled={isSigningOut} onClick={signOut} type="button">
                  {isSigningOut ? t("auth", "signingOut") : t("auth", "signOut")}
                </button>
              </div>
            </div>
            <Link className="focus-ring mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-elevated hover:text-foreground" href="/">
              <StoreIcon direction={direction} />
              {t("admin", "returnToStore")}
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5 sm:px-6 lg:px-7">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground">{humanize(access.role)}</p>
              <p className="mt-0.5 hidden text-[10px] text-muted sm:block">{access.permissions.length} {t("admin", "activePermissions")}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-md border border-success/25 bg-success/5 px-2.5 py-1.5 text-[10px] font-bold text-success sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />API
              </span>
              <button className="focus-ring rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-primary shadow-sm disabled:opacity-60 lg:hidden" disabled={isSigningOut} onClick={signOut} type="button">
                {isSigningOut ? t("auth", "signingOut") : t("auth", "signOut")}
              </button>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}

function RestrictedAdminAccess() {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[60vh] place-items-center py-12">
      <section className="max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-danger/10 text-danger"><AdminIcon name="lock" /></span>
        <p className="section-kicker mt-6">{t("admin", "restrictedArea")}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground">{t("admin", "staffRequired")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t("admin", "restrictedDescription")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link className="button-primary" href="/signin?next=/admin">{t("auth", "signIn")}</Link>
          <Link className="button-secondary" href="/">{t("admin", "returnToStore")}</Link>
        </div>
      </section>
    </div>
  );
}

function AdminBootScreen() {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[60vh] place-items-center py-12" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-muted shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-e-transparent" />
        {t("admin", "checkingSession")}
      </div>
    </div>
  );
}

type IconName = "bag" | "bolt" | "box" | "credit" | "factory" | "grid" | "history" | "key" | "link" | "lock" | "quote" | "shield" | "truck" | "users";

export function AdminIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect height="6" rx="1" width="6" x="3" y="3" /><rect height="6" rx="1" width="6" x="15" y="3" /><rect height="6" rx="1" width="6" x="3" y="15" /><rect height="6" rx="1" width="6" x="15" y="15" /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="3.2" /><path d="M17 10a3 3 0 0 0 0-6M21 20v-1.3a4.2 4.2 0 0 0-2.5-3.9" /></>,
    shield: <><path d="M12 3 4.5 6v5c0 4.8 3.1 8.6 7.5 10 4.4-1.4 7.5-5.2 7.5-10V6L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    quote: <><path d="M5 5h14v10H9l-4 4V5Z" /><path d="M9 9h.01M15 9h.01" strokeWidth="3" /></>,
    truck: <><path d="M3 5h11v11H3zM14 9h3l3 3v4h-6z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    lock: <><rect height="10" rx="2" width="14" x="5" y="11" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    credit: <><rect height="14" rx="2" width="20" x="2" y="5" /><path d="M2 10h20M6 15h4" /></>,
    factory: <><path d="M3 21V9l6 3V9l6 3V5h6v16H3Z" /><path d="M7 17h2M12 17h2M17 17h2" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z" />,
  };
  return <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function StoreIcon({ direction }: { direction: "ltr" | "rtl" }) {
  return <svg aria-hidden="true" className={direction === "rtl" ? "rotate-180" : ""} fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M19 12H5m5-5-5 5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
