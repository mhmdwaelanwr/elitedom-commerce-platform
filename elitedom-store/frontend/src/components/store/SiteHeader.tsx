"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorefrontSearch } from "@/components/store/StorefrontSearch";
import { useStore } from "@/components/store/StoreProvider";
import { CATEGORIES } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  const { cartCount, cartSubtotal, currency, setCartOpen, session, wishlist } = useStore();

  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const categoryNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--ds-header)] text-foreground backdrop-blur-xl">
      <div className="site-container">
        <div className="grid min-h-[4.75rem] grid-cols-[auto_1fr_auto] items-center gap-3 py-3 md:gap-5 lg:min-h-[5.25rem]">
          <Brand />

          <div className="hidden min-w-0 md:block">
            <div className="mx-auto max-w-3xl">
              <StorefrontSearch inputId="site-search" />
            </div>
          </div>

          <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
            <button
              aria-label={locale === "en" ? "العربية" : "English"}
              className="focus-ring hidden min-h-11 rounded-full px-3 text-xs font-bold text-muted transition hover:bg-elevated hover:text-foreground sm:block"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              type="button"
            >
              {locale === "en" ? "AR" : "EN"}
            </button>

            <button
              aria-label={`Theme: ${theme}`}
              className="focus-ring grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground"
              onClick={() => setTheme(nextTheme)}
              type="button"
            >
              <ThemeIcon theme={theme} />
            </button>

            <Link
              aria-label={`${t("storefront", "wishlist")} (${wishlist.length})`}
              className="focus-ring relative hidden h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground sm:grid"
              href="/wishlist"
            >
              <HeartIcon />
              {wishlist.length > 0 ? <CountBadge value={wishlist.length} /> : null}
            </Link>

            <Link
              aria-label={session ? t("storefront", "account") : t("storefront", "signIn")}
              className="focus-ring grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground"
              href={session ? "/account" : "/signin"}
            >
              <UserIcon />
            </Link>

            <button
              aria-label={`${t("storefront", "cart")} (${cartCount})`}
              className="focus-ring relative ms-1 flex h-11 items-center gap-2 rounded-full bg-elevated px-3 text-foreground transition hover:bg-[var(--ds-primary-soft)] sm:px-4"
              onClick={() => setCartOpen(true)}
              type="button"
            >
              <CartIcon />
              <span className="hidden text-xs font-bold xl:inline">{formatPrice(cartSubtotal, currency, locale)}</span>
              {cartCount > 0 ? <CountBadge value={cartCount} /> : null}
            </button>

            <button
              aria-controls="mobile-navigation"
              aria-expanded={mobileOpen}
              aria-label={t("storefront", "departments")}
              className="focus-ring grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <StorefrontSearch inputId="mobile-header-search" />
        </div>

        <div className="hidden min-h-11 items-center gap-1 border-t border-border lg:flex">
          <Link className={navClass(pathname === "/shop")} href="/shop">
            {t("storefront", "shopAll")}
          </Link>
          <nav aria-label={t("storefront", "departments")} className="flex min-w-0 flex-1 items-center overflow-x-auto">
            {CATEGORIES.map((category) => (
              <Link className={navClass(false)} href={`/shop?category=${category.slug}`} key={category.slug}>
                {categoryNames[category.slug] ?? category.name}
              </Link>
            ))}
          </nav>
          <Link className="focus-ring ms-auto shrink-0 rounded-full px-3 py-2 text-xs font-bold text-primary transition hover:bg-[var(--ds-primary-soft)]" href="/b2b">
            {t("storefront", "business")}
          </Link>
          <Link className="focus-ring shrink-0 rounded-full px-3 py-2 text-xs font-bold text-muted transition hover:bg-elevated hover:text-foreground" href="/warranty">
            {t("storefront", "warranty")}
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-surface lg:hidden" id="mobile-navigation">
          <div className="site-container py-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">{t("storefront", "departments")}</h2>
              <Link className="focus-ring rounded-full px-3 py-2 text-xs font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href="/shop" onClick={() => setMobileOpen(false)}>
                {t("storefront", "fullCatalogue")}
              </Link>
            </div>
            <nav className="mt-4 grid grid-cols-2 gap-2" aria-label={t("storefront", "departments")}>
              {CATEGORIES.map((category) => (
                <Link
                  className="focus-ring flex min-w-0 items-center gap-3 rounded-2xl bg-elevated p-3 text-sm font-bold text-foreground transition hover:bg-[var(--ds-primary-soft)]"
                  href={`/shop?category=${category.slug}`}
                  key={category.slug}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface">
                    <Image alt="" className="object-contain p-1.5" fill sizes="44px" src={category.image} />
                  </span>
                  <span className="truncate">{categoryNames[category.slug] ?? category.name}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <button className="button-secondary" onClick={() => setLocale(locale === "en" ? "ar" : "en")} type="button">
                {locale === "en" ? "العربية" : "English"}
              </button>
              <Link className="button-secondary" href="/b2b" onClick={() => setMobileOpen(false)}>{t("storefront", "business")}</Link>
              <Link className="button-secondary" href="/warranty" onClick={() => setMobileOpen(false)}>{t("storefront", "warranty")}</Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Brand() {
  const { t } = usePreferences();
  return (
    <Link aria-label={t("common", "brandHome")} className="focus-ring flex shrink-0 items-center gap-2.5 rounded-full" href="/">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-contrast">
        E
        <span className="absolute bottom-1.5 end-1.5 h-1.5 w-1.5 rounded-full bg-surface" aria-hidden="true" />
      </span>
      <span className="hidden text-lg font-bold tracking-[-0.04em] text-foreground sm:block">
        Elitedom
      </span>
    </Link>
  );
}

function navClass(active: boolean) {
  return `focus-ring whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition ${
    active ? "bg-elevated text-foreground" : "text-muted hover:bg-elevated hover:text-foreground"
  }`;
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -end-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-contrast">
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

function ThemeIcon({ theme }: { theme: "light" | "dark" | "system" }) {
  if (theme === "dark") return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M20 15.1A8.2 8.2 0 0 1 8.9 4 8.2 8.2 0 1 0 20 15.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  if (theme === "system") return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M9 20h6M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function MenuIcon({ open }: { open: boolean }) {
  return open
    ? <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
    : <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}