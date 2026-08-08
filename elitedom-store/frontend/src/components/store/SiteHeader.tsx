"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorefrontSearch } from "@/components/store/StorefrontSearch";
import { useStore } from "@/components/store/StoreProvider";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  const { cartCount, setCartOpen, session, wishlist } = useStore();
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
    <header className="sticky top-0 z-50 border-b border-border bg-[var(--ds-header)] backdrop-blur-xl">
      <div className="site-container flex min-h-16 items-center gap-3 py-2.5 lg:gap-5">
        <Brand />

        <div className="hidden min-w-0 flex-1 md:block">
          <StorefrontSearch inputId="site-search" />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button
            aria-label={locale === "en" ? "العربية" : "English"}
            className="focus-ring hidden h-10 rounded-lg px-2.5 text-xs font-black text-muted transition hover:bg-elevated hover:text-foreground sm:inline-flex sm:items-center"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            type="button"
          >
            {locale === "en" ? "AR" : "EN"}
          </button>

          <button
            aria-label={`Theme: ${theme}`}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-foreground"
            onClick={() => setTheme(nextTheme)}
            type="button"
          >
            <ThemeIcon theme={theme} />
          </button>

          <Link
            aria-label={`${t("storefront", "wishlist")} (${wishlist.length})`}
            className="focus-ring relative hidden h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-foreground sm:grid"
            href="/wishlist"
          >
            <HeartIcon />
            {wishlist.length > 0 ? <CountBadge value={wishlist.length} /> : null}
          </Link>

          <Link
            aria-label={session ? t("storefront", "account") : t("storefront", "signIn")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-foreground"
            href={session ? "/account" : "/signin"}
          >
            <UserIcon />
          </Link>

          <button
            aria-label={`${t("storefront", "cart")} (${cartCount})`}
            className="focus-ring relative grid h-10 w-10 place-items-center rounded-lg bg-foreground text-background transition hover:opacity-85"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <CartIcon />
            {cartCount > 0 ? <CountBadge value={cartCount} inverse /> : null}
          </button>

          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label={t("storefront", "departments")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-foreground lg:hidden"
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
        <div className="site-container flex min-h-11 items-center gap-1 overflow-x-auto">
          <Link className={navClass(pathname === "/shop")} href="/shop">
            {t("storefront", "shopAll")}
          </Link>
          {CATEGORIES.map((category) => (
            <Link
              className={navClass(false)}
              href={`/shop?category=${category.slug}`}
              key={category.slug}
            >
              {categoryNames[category.slug] ?? category.name}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          <Link className={navClass(false)} href="/b2b">{t("storefront", "business")}</Link>
          <Link className={navClass(false)} href="/warranty">{t("storefront", "warranty")}</Link>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-surface lg:hidden" id="mobile-navigation">
          <div className="site-container py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{t("storefront", "departments")}</p>
              <Link className="text-xs font-black text-primary" href="/shop" onClick={() => setMobileOpen(false)}>
                {t("storefront", "fullCatalogue")}
              </Link>
            </div>
            <nav className="mt-3 grid grid-cols-2 gap-2" aria-label={t("storefront", "departments")}>
              {CATEGORIES.map((category) => (
                <Link
                  className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background p-2.5 text-sm font-black text-foreground"
                  href={`/shop?category=${category.slug}`}
                  key={category.slug}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--ds-product-canvas)]">
                    <Image alt="" className="object-contain p-1.5" fill sizes="40px" src={category.image} />
                  </span>
                  <span className="truncate">{categoryNames[category.slug] ?? category.name}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Link className="button-secondary" href="/b2b" onClick={() => setMobileOpen(false)}>{t("storefront", "business")}</Link>
              <Link className="button-secondary" href="/warranty" onClick={() => setMobileOpen(false)}>{t("storefront", "warranty")}</Link>
              <button className="button-secondary" onClick={() => setLocale(locale === "en" ? "ar" : "en")} type="button">
                {locale === "en" ? "العربية" : "English"}
              </button>
              <Link className="button-primary" href={session ? "/account" : "/signin"} onClick={() => setMobileOpen(false)}>
                {session ? t("storefront", "account") : t("storefront", "signIn")}
              </Link>
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
    <Link aria-label={t("common", "brandHome")} className="focus-ring flex shrink-0 items-center gap-2.5 rounded-lg" href="/">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-sm font-black text-background">E</span>
      <span className="hidden text-lg font-black tracking-[-0.05em] text-foreground sm:block">
        ELITE<span className="text-primary">DOM</span>
      </span>
    </Link>
  );
}

function navClass(active: boolean) {
  return `focus-ring shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black transition ${
    active ? "bg-elevated text-foreground" : "text-muted hover:bg-elevated hover:text-foreground"
  }`;
}

function CountBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  return (
    <span className={`absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black ${inverse ? "bg-primary text-primary-contrast" : "bg-danger text-primary-contrast"}`}>
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
function ThemeIcon({ theme }: { theme: "system" | "light" | "dark" }) {
  if (theme === "dark") return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M20 15.3A8 8 0 0 1 8.7 4a8 8 0 1 0 11.3 11.3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  if (theme === "light") return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="13" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M8 21h8M12 17v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function MenuIcon({ open }: { open: boolean }) {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /></svg>;
}
