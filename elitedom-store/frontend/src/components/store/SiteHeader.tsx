"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorefrontSearch } from "@/components/store/StorefrontSearch";
import { useStore } from "@/components/store/StoreProvider";
import { CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const {
    locale,
    setLocale,
    theme,
    setTheme,
    t,
  } = usePreferences();
  const {
    cartCount,
    cartSubtotal,
    currency,
    setCartOpen,
    session,
    wishlist,
  } = useStore();

  const categoryNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  const closeMobile = () => setMobileOpen(false);
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--ds-header)] text-foreground backdrop-blur-xl">
      <div className="border-b border-border bg-elevated/80">
        <div className="site-container flex min-h-9 items-center justify-between gap-4 py-1.5 text-[11px] font-semibold text-muted sm:text-xs">
          <div className="flex min-w-0 items-center gap-4">
            <span className="truncate">{t("storefront", "deliveryStrip")}</span>
            <Link className="focus-ring hidden rounded-md text-foreground hover:text-primary md:inline" href="/b2b">
              {t("storefront", "business")}
            </Link>
            <Link className="focus-ring hidden rounded-md text-foreground hover:text-primary md:inline" href="/warranty">
              {t("storefront", "warranty")}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              className="focus-ring rounded-md px-2 py-1 text-foreground hover:bg-surface hover:text-primary"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              type="button"
            >
              {locale === "en" ? "العربية" : "English"}
            </button>
            <span aria-hidden="true" className="text-border">|</span>
            <button
              aria-label={`Theme: ${theme}`}
              className="focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-foreground hover:bg-surface hover:text-primary"
              onClick={() => setTheme(nextTheme)}
              type="button"
            >
              <ThemeIcon theme={theme} />
              <span className="hidden capitalize sm:inline">{theme}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="site-container grid min-h-[4.6rem] grid-cols-[auto_1fr_auto] items-center gap-3 py-3 lg:gap-6">
        <Brand />

        <div className="hidden min-w-0 md:block">
          <StorefrontSearch inputId="site-search" />
        </div>

        <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
          <Link
            aria-label={`${t("storefront", "wishlist")} (${wishlist.length})`}
            className="focus-ring relative hidden h-10 items-center gap-2 rounded-lg px-2.5 text-muted transition hover:bg-elevated hover:text-foreground sm:flex"
            href="/wishlist"
          >
            <HeartIcon />
            <span className="hidden text-xs font-bold xl:inline">{t("storefront", "wishlist")}</span>
            {wishlist.length > 0 ? <CountBadge value={wishlist.length} /> : null}
          </Link>

          <Link
            aria-label={session ? t("storefront", "account") : t("storefront", "signIn")}
            className="focus-ring flex h-10 items-center gap-2 rounded-lg px-2.5 text-muted transition hover:bg-elevated hover:text-foreground"
            href={session ? "/account" : "/signin"}
          >
            <UserIcon />
            <span className="hidden max-w-28 truncate text-xs font-bold xl:inline">
              {session ? session.name ?? t("storefront", "account") : t("storefront", "signIn")}
            </span>
          </Link>

          <button
            aria-label={`${t("storefront", "cart")} (${cartCount})`}
            className="focus-ring relative flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-foreground shadow-sm transition hover:border-primary"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <CartIcon />
            <span className="hidden text-xs font-black xl:inline">{formatPrice(cartSubtotal, currency, locale)}</span>
            {cartCount > 0 ? <CountBadge value={cartCount} /> : null}
          </button>

          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label={t("storefront", "departments")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            type="button"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      <div className="site-container pb-3 md:hidden">
        <StorefrontSearch inputId="mobile-header-search" />
      </div>

      <div className="hidden border-t border-border lg:block">
        <div className="site-container flex min-h-11 items-center gap-1">
          <div className="relative shrink-0">
            <button
              aria-expanded={departmentsOpen}
              className="focus-ring flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-black text-primary-contrast hover:brightness-105"
              onClick={() => setDepartmentsOpen((open) => !open)}
              type="button"
            >
              <GridIcon />
              {t("storefront", "departments")}
              <ChevronIcon open={departmentsOpen} />
            </button>
            {departmentsOpen ? (
              <MegaMenu
                categoryNames={categoryNames}
                onNavigate={() => setDepartmentsOpen(false)}
              />
            ) : null}
          </div>

          <Link
            className={navClass(pathname === "/shop")}
            href="/shop"
          >
            {t("storefront", "shopAll")}
          </Link>

          <nav aria-label={t("storefront", "departments")} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {CATEGORIES.map((category) => (
              <Link
                className={navClass(false)}
                href={`/shop?category=${category.slug}`}
                key={category.slug}
              >
                {categoryNames[category.slug] ?? category.name}
              </Link>
            ))}
          </nav>

          <Link className="focus-ring ms-auto shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold text-primary hover:bg-[var(--ds-soft-primary)]" href="/b2b">
            {t("storefront", "businessQuote")}
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-surface lg:hidden" id="mobile-navigation">
          <div className="site-container py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-muted">{t("storefront", "departments")}</p>
              <Link className="focus-ring rounded-md text-xs font-black text-primary" href="/shop" onClick={closeMobile}>
                {t("storefront", "fullCatalogue")}
              </Link>
            </div>
            <nav className="mt-3 grid grid-cols-2 gap-2" aria-label={t("storefront", "departments")}>
              {CATEGORIES.map((category) => (
                <Link
                  className="focus-ring flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground"
                  href={`/shop?category=${category.slug}`}
                  key={category.slug}
                  onClick={closeMobile}
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-elevated">
                    <Image alt="" className="object-contain p-1.5" fill sizes="40px" src={category.image} />
                  </span>
                  <span className="truncate">{categoryNames[category.slug] ?? category.name}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Link className="button-secondary" href="/wishlist" onClick={closeMobile}>{t("storefront", "wishlist")}</Link>
              <Link className="button-secondary" href="/b2b" onClick={closeMobile}>{t("storefront", "business")}</Link>
              <Link className="button-secondary" href="/warranty" onClick={closeMobile}>{t("storefront", "warranty")}</Link>
              <Link className="button-primary" href={session ? "/account" : "/signin"} onClick={closeMobile}>
                {session ? t("storefront", "account") : t("storefront", "signIn")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MegaMenu({
  categoryNames,
  onNavigate,
}: {
  categoryNames: Record<string, string>;
  onNavigate: () => void;
}) {
  const { t } = usePreferences();

  return (
    <div className="absolute start-0 top-[calc(100%+0.6rem)] z-50 w-[46rem] overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-2xl">
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((category) => (
          <Link
            className="focus-ring group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-elevated"
            href={`/shop?category=${category.slug}`}
            key={category.slug}
            onClick={onNavigate}
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-background">
              <Image alt="" className="object-contain p-1.5 transition group-hover:scale-105" fill sizes="48px" src={category.image} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-foreground group-hover:text-primary">
                {categoryNames[category.slug] ?? category.name}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted">{category.description}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-elevated px-4 py-3">
        <div>
          <p className="text-sm font-black text-foreground">{t("storefront", "equipTeam")}</p>
          <p className="mt-0.5 text-xs text-muted">{t("storefront", "equipTeamText")}</p>
        </div>
        <Link className="focus-ring rounded-lg bg-surface px-3 py-2 text-xs font-black text-primary shadow-sm" href="/b2b" onClick={onNavigate}>
          {t("storefront", "businessQuote")}
        </Link>
      </div>
    </div>
  );
}

function Brand() {
  const { t } = usePreferences();
  return (
    <Link aria-label={t("common", "brandHome")} className="focus-ring flex shrink-0 items-center gap-2.5 rounded-lg" href="/">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-base font-black text-primary-contrast shadow-sm">E</span>
      <span className="hidden text-lg font-black tracking-[-0.04em] text-foreground sm:block">
        ELITE<span className="text-primary">DOM</span>
      </span>
    </Link>
  );
}

function navClass(active: boolean) {
  return cn(
    "focus-ring whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-bold transition",
    active ? "bg-elevated text-foreground" : "text-muted hover:bg-elevated hover:text-foreground",
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black text-primary-contrast">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function HeartIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function UserIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}

function GridIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="3" y="3" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="15" y="3" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="3" y="15" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="15" y="15" /></svg>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg aria-hidden="true" className={`transition ${open ? "rotate-180" : ""}`} fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
}

function MenuIcon({ open }: { open: boolean }) {
  return open
    ? <span aria-hidden="true" className="text-xl leading-none">×</span>
    : <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

function ThemeIcon({ theme }: { theme: "system" | "light" | "dark" }) {
  if (theme === "light") {
    return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  }
  if (theme === "dark") {
    return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M20.2 15.1A8 8 0 0 1 8.9 3.8 8 8 0 1 0 20.2 15.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><rect height="13" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M8 21h8M12 17v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
