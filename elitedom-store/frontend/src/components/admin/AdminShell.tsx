"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  canAccessAdminSection,
  isStaffRole,
  type AdminSection,
} from "@/lib/admin-api";
import { humanize } from "@/lib/admin-ui";
import { logout } from "@/lib/api";
import { useStore } from "@/components/store/StoreProvider";

type NavigationItem = {
  href: string;
  label: string;
  section: AdminSection;
  icon: IconName;
};

const navigation: NavigationItem[] = [
  { href: "/admin", label: "Overview", section: "dashboard", icon: "grid" },
  { href: "/admin/orders", label: "Orders", section: "orders", icon: "bag" },
  { href: "/admin/products", label: "Catalog & stock", section: "products", icon: "box" },
  { href: "/admin/customers", label: "Customers", section: "customers", icon: "users" },
  { href: "/admin/rma", label: "Warranty desk", section: "rma", icon: "shield" },
  { href: "/admin/rfqs", label: "B2B RFQs", section: "rfqs", icon: "quote" },
  { href: "/admin/shipments", label: "Fulfilment", section: "shipments", icon: "truck" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify, session, setSession } = useStore();
  const [ready, setReady] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 20);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return <AdminBootScreen />;

  if (!session || !isStaffRole(session.role)) {
    return (
      <div className="site-container grid min-h-[60vh] place-items-center py-10">
        <section className="max-w-lg rounded-3xl border border-slate-800 bg-slate-950/70 p-8 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-200">
            <AdminIcon name="lock" />
          </div>
          <p className="section-kicker mt-6">Restricted area</p>
          <h1 className="mt-2 text-2xl font-black text-white">Staff access required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The operations console is available only to authorized Elitedom staff. Sign in
            using the account assigned by your administrator.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="button-primary" href="/signin?next=/admin">Sign in</Link>
            <Link className="button-secondary" href="/">Return to store</Link>
          </div>
        </section>
      </div>
    );
  }

  const visibleNavigation = navigation.filter((item) =>
    canAccessAdminSection(session.role, item.section),
  );

  async function signOut() {
    if (!session) return;
    setSigningOut(true);
    try {
      await logout(session);
    } catch {
      // Clear local credentials even when the API session endpoint is offline.
    } finally {
      setSession(null);
      notify("Staff session ended.", "info");
      router.replace("/signin?next=/admin");
    }
  }

  return (
    <div className="admin-console mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-[#08111e]/95 shadow-2xl shadow-black/25">
        <div className="flex min-h-[calc(100vh-11rem)] flex-col lg:flex-row">
          <aside className="border-b border-slate-800/90 bg-slate-950/60 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between px-5 py-5 lg:block">
              <Link className="group inline-flex items-center gap-3 focus-ring" href="/admin">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-sky-600 text-slate-950 shadow-lg shadow-cyan-500/20">
                  <AdminIcon name="bolt" />
                </span>
                <span>
                  <span className="block text-sm font-black tracking-tight text-white">ELITEDOM</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Operations</span>
                </span>
              </Link>
              <Link className="text-xs font-bold text-slate-400 hover:text-cyan-200 focus-ring lg:mt-6 lg:inline-flex" href="/">
                ← Storefront
              </Link>
            </div>
            <nav aria-label="Staff console" className="flex gap-1 overflow-x-auto border-t border-slate-800/80 px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:border-t-0 lg:px-3 lg:py-0">
              {visibleNavigation.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-ring lg:flex ${
                      active
                        ? "bg-cyan-400/12 text-cyan-200 shadow-sm shadow-cyan-500/10"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                    }`}
                    href={item.href}
                    key={item.href}
                  >
                    <AdminIcon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="hidden border-t border-slate-800/90 p-4 lg:block">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="truncate text-sm font-bold text-white">{session.email}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">{humanize(session.role)}</p>
                <button className="mt-3 text-xs font-bold text-sky-300 hover:text-white focus-ring disabled:opacity-60" disabled={isSigningOut} onClick={signOut} type="button">
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </aside>
          <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(14,116,144,0.13),transparent_34rem)]">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3 sm:px-7 lg:hidden">
              <p className="text-xs font-bold text-slate-400">{humanize(session.role)}</p>
              <button className="text-xs font-bold text-sky-300 hover:text-white focus-ring disabled:opacity-60" disabled={isSigningOut} onClick={signOut} type="button">
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
            <div className="p-5 sm:p-7">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminBootScreen() {
  return (
    <div className="site-container grid min-h-[60vh] place-items-center py-10" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm font-semibold text-slate-300">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-r-transparent" />
        Checking secure staff session…
      </div>
    </div>
  );
}

type IconName = "bag" | "bolt" | "box" | "grid" | "lock" | "quote" | "shield" | "truck" | "users";

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
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z" />,
  };
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
