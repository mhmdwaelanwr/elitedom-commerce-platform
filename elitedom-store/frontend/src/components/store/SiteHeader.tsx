"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorefrontSearch } from "@/components/store/StorefrontSearch";
import { useStore } from "@/components/store/StoreProvider";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, theme, setTheme, t } = usePreferences();
  const { cartCount, setCartOpen, session } = useStore();
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
    <header className="sticky top-0 z-50 border-b border-border bg-surface text-foreground">
      <div className="site-container grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4">
        <Brand />

        <nav aria-label={t("storefront", "departments")} className="hidden min-w-0 items-center justify-center gap-1 lg:flex">
          {CATEGORIES.slice(0, 6).map((category) => (
            <Link
              className={`focus-ring rounded-full px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/shop") && pathname.includes(category.slug)
                  ? "bg-elevated text-foreground"
                  : "text-muted hover:bg-elevated hover:text-foreground"
              }`}
              href={`/shop?category=${category.slug}`}
              key={category.slug}
            >
              {categoryNames[category.slug] ?? category.name}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-0.5">
          <button
            aria-expanded={searchOpen}
            aria-label={t("storefront", "search")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground"
            onClick={() => setSearchOpen((open) => !open)}
            type="button"
          >
            <SearchIcon />
          </button>

          <button
            aria-label={locale === "en" ? "العربية" : "English"}
            className="focus-ring hidden h-10 min-w-10 place-items-center rounded-full px-2 text-xs font-bold text-muted transition hover:bg-elevated hover:text-foreground sm:grid"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            type="button"
          >
            {locale === "en" ? "AR" : "EN"}
          </button>

          <button
            aria-label={`Theme: ${theme}`}
            className="focus-ring hidden h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground md:grid"
            onClick={() => setTheme(nextTheme)}
            type="button"
          >
            <ThemeIcon theme={theme} />
          </button>

          <Link
            aria-label={session ? t("storefront", "account") : t("storefront", "signIn")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground"
            href={session ? "/account" : "/signin"}
          >
            <UserIcon />
          </Link>

          <button
            aria-label={`${t("storefront", "cart")} (${cartCount})`}
            className="focus-ring relative grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <CartIcon />
            {cartCount > 0 ? <CountBadge value={cartCount} /> : null}
          </button>

          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label={t("storefront", "departments")}
            className="focus-ring grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-elevated hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            type="button"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-border bg-surface">
          <div className="site-container py-3">
            <div className="mx-auto max-w-3xl">
              <StorefrontSearch inputId="site-search" onNavigate={() => setSearchOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="border-t border-border bg-surface lg:hidden" id="mobile-navigation">
          <div className="site-container py-4">
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t("storefront", "departments")}>
              {CATEGORIES.map((category) => (
                <Link
                  className="focus-ring rounded-2xl bg-elevated px-4 py-3 text-sm font-medium text-foreground transition hover:text-primary"
                  href={`/shop?category=${category.slug}`}
                  key={category.slug}
                  onClick={() => setMobileOpen(false)}
                >
                  {categoryNames[category.slug] ?? category.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Brand() {
  const { t } = usePreferences();
  return (
    <Link aria-label={t("common", "brandHome")} className="focus-ring flex shrink-0 items-center gap-2 rounded-full" href="/">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-contrast">E</span>
      <span className="hidden text-[1.05rem] font-bold tracking-[-0.03em] text-foreground sm:block">Elitedom</span>
    </Link>
  );
}

function CountBadge({ value }: { value: number }) {
  return <span className="absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-contrast">{value > 99 ? "99+" : value}</span>;
}

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function UserIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}
function ThemeIcon({ theme }: { theme: "light" | "dark" | "system" }) {
  if (theme === "dark") return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M20 15.1A8.2 8.2 0 0 1 8.9 4 8.2 8.2 0 1 0 20 15.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  if (theme === "system") return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M9 20h6M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function MenuIcon({ open }: { open: boolean }) {
  return open
    ? <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
    : <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}