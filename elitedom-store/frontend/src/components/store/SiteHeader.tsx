"use client";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, t } = usePreferences();
  const {
    cartCount,
    cartSubtotal,
    currency,
    setCurrency,
    setCartOpen,
    session,
    wishlist,
  } = useStore();

  const closeMenu = () => setMenuOpen(false);
  const serviceNavigation = [
    { href: "/b2b", label: t("storefront", "business") },
    { href: "/warranty", label: t("storefront", "warranty") },
  ];

  return (
    <header className="glass-navbar sticky top-0 z-40 text-foreground">
      <div className="border-b border-border bg-elevated text-xs text-muted">
        <div className="site-container flex min-h-9 items-center justify-between gap-3 py-2">
          <p className="hidden sm:block">{t("storefront", "deliveryStrip")}</p>
          <p className="sm:hidden">{t("storefront", "deliveryStripMobile")}</p>
          <Link className="focus-ring font-bold text-primary hover:brightness-110" href="/warranty">
            {t("storefront", "trackWarranty")}
          </Link>
        </div>
      </div>

      <div className="site-container flex min-h-[4.5rem] items-center gap-3 py-3 lg:gap-6">
        <Link
          aria-label={t("common", "brandHome")}
          className="focus-ring group flex shrink-0 items-center gap-2 rounded-lg"
          href="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-black text-primary-contrast shadow-lg transition group-hover:brightness-110">
            E
          </span>
          <span className="hidden text-lg font-black tracking-tight text-foreground sm:block">
            ELITE<span className="text-primary">DOM</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 md:block">
          <StorefrontSearch inputId="site-search" />
        </div>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <button
            aria-label={`${t("storefront", "switchCurrency")}: ${currency}`}
            className="focus-ring hidden rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-bold text-muted hover:border-primary hover:text-foreground sm:block"
            onClick={() => setCurrency(currency === "EGP" ? "USD" : "EGP")}
            type="button"
          >
            {currency}
          </button>
          <Link
            aria-label={`${t("storefront", "wishlist")} (${wishlist.length})`}
            className="focus-ring relative grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
            href="/wishlist"
          >
            <HeartIcon />
            {wishlist.length > 0 && <CountBadge value={wishlist.length} />}
          </Link>
          <Link
            aria-label={session ? t("storefront", "account") : t("storefront", "signIn")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
            href={session ? "/account" : "/signin"}
          >
            <UserIcon />
          </Link>
          <button
            aria-label={`${t("storefront", "cart")} (${cartCount})`}
            className="focus-ring relative grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-contrast shadow-md hover:brightness-110"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <CartIcon />
            {cartCount > 0 && <CountBadge value={cartCount} />}
          </button>
          <button
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={t("storefront", "departments")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      <div className="hidden border-t border-border lg:block">
        <div className="site-container flex min-h-11 items-center gap-1">
          <Link
            className={cn(
              "focus-ring rounded-lg px-3 py-2 text-sm font-bold transition",
              pathname === "/shop"
                ? "bg-primary text-primary-contrast"
                : "text-foreground hover:bg-elevated",
            )}
            href="/shop"
          >
            {t("storefront", "shopAll")}
          </Link>
          <nav aria-label={t("storefront", "departments")} className="flex min-w-0 items-center gap-0.5 overflow-x-auto py-1">
            {CATEGORIES.map((category) => (
              <Link
                className="focus-ring whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold text-muted transition hover:bg-elevated hover:text-foreground"
                href={`/shop?category=${category.slug}`}
                key={category.slug}
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <nav aria-label={t("storefront", "account")} className="ms-auto flex shrink-0 items-center gap-1 border-s border-border ps-2">
            {serviceNavigation.map((item) => (
              <Link
                className={cn(
                  "focus-ring rounded-lg px-2.5 py-2 text-xs font-semibold transition",
                  pathname === item.href
                    ? "bg-elevated text-foreground"
                    : "text-muted hover:bg-elevated hover:text-foreground",
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            <span className="ms-2 text-xs text-muted">
              {t("storefront", "cart")}: {" "}
              <strong className="text-foreground">
                {formatPrice(cartSubtotal, currency, locale)}
              </strong>
            </span>
          </nav>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-surface lg:hidden" id="mobile-navigation">
          <div className="site-container grid gap-5 py-4">
            <StorefrontSearch
              inputId="mobile-site-search"
              onNavigate={closeMenu}
              placeholder={t("storefront", "searchPlaceholder")}
            />
            <nav aria-label={t("storefront", "departments")}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {t("storefront", "departments")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link className="focus-ring rounded-lg bg-primary px-3 py-3 text-sm font-bold text-primary-contrast" href="/shop" onClick={closeMenu}>
                  {t("storefront", "shopAll")}
                </Link>
                {CATEGORIES.map((category) => (
                  <Link
                    className="focus-ring rounded-lg bg-elevated px-3 py-3 text-sm font-semibold text-foreground hover:brightness-105"
                    href={`/shop?category=${category.slug}`}
                    key={category.slug}
                    onClick={closeMenu}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </nav>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
              {serviceNavigation.map((item) => (
                <Link className="focus-ring rounded-lg bg-elevated px-3 py-3 text-sm font-semibold text-foreground" href={item.href} key={item.href} onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
              <Link className="focus-ring rounded-lg bg-elevated px-3 py-3 text-sm font-semibold text-foreground" href="/cart" onClick={closeMenu}>
                {t("storefront", "cart")} · {formatPrice(cartSubtotal, currency, locale)}
              </Link>
              <button
                className="focus-ring rounded-lg bg-elevated px-3 py-3 text-start text-sm font-semibold text-foreground"
                onClick={() => setCurrency(currency === "EGP" ? "USD" : "EGP")}
                type="button"
              >
                {t("storefront", "displayPricesIn")} {currency === "EGP" ? "USD" : "EGP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-black text-primary-contrast">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function HeartIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function UserIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? <span aria-hidden="true" className="text-xl">×</span> : <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}
