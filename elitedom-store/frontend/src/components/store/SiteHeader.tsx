"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorefrontSearch } from "@/components/store/StorefrontSearch";
import { useStore } from "@/components/store/StoreProvider";
import { CATEGORIES } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

const serviceNavigation = [
  { href: "/b2b", label: "Business" },
  { href: "/warranty", label: "Warranty" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartCount, cartSubtotal, currency, setCurrency, setCartOpen, session, wishlist } =
    useStore();

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/92 backdrop-blur-xl">
      <div className="border-b border-slate-800/70 bg-slate-900/70 text-xs text-slate-300">
        <div className="site-container flex min-h-9 items-center justify-between gap-3 py-2">
          <p className="hidden sm:block">Egypt-wide delivery · VAT-inclusive pricing · Expert support</p>
          <p className="sm:hidden">Delivery across Egypt</p>
          <Link className="font-medium text-sky-300 hover:text-white focus-ring" href="/warranty">
            Track warranty support
          </Link>
        </div>
      </div>

      <div className="site-container flex min-h-[4.5rem] items-center gap-3 py-3 lg:gap-6">
        <Link
          aria-label="Elitedom home"
          className="group flex shrink-0 items-center gap-2 rounded-lg focus-ring"
          href="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-950/60 transition group-hover:bg-blue-500">
            E
          </span>
          <span className="hidden text-lg font-black tracking-tight text-white sm:block">
            ELITE<span className="text-sky-400">DOM</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 md:block">
          <StorefrontSearch inputId="site-search" />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            aria-label={`Switch price currency; currently ${currency}`}
            className="hidden rounded-lg border border-slate-700 px-2.5 py-2 text-xs font-bold text-slate-300 hover:border-sky-400 hover:text-white focus-ring sm:block"
            onClick={() => setCurrency(currency === "EGP" ? "USD" : "EGP")}
            type="button"
          >
            {currency}
          </button>
          <Link
            aria-label={`Wishlist (${wishlist.length} saved)`}
            className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white focus-ring"
            href="/wishlist"
          >
            <HeartIcon />
            {wishlist.length > 0 && <CountBadge value={wishlist.length} />}
          </Link>
          <Link
            aria-label={session ? "Open account" : "Sign in or create an account"}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white focus-ring"
            href={session ? "/account" : "/signin"}
          >
            <UserIcon />
          </Link>
          <button
            aria-label={`Open cart (${cartCount} items)`}
            className="relative grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-950/60 hover:bg-blue-500 focus-ring"
            onClick={() => setCartOpen(true)}
            type="button"
          >
            <CartIcon />
            {cartCount > 0 && <CountBadge value={cartCount} />}
          </button>
          <button
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white focus-ring lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      <div className="hidden border-t border-slate-800/70 lg:block">
        <div className="site-container flex min-h-11 items-center gap-1">
          <Link
            className={`rounded-lg px-3 py-2 text-sm font-bold transition focus-ring ${
              pathname === "/shop" ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-slate-900 hover:text-white"
            }`}
            href="/shop"
          >
            Shop all
          </Link>
          <nav aria-label="Shop categories" className="flex min-w-0 items-center gap-0.5 overflow-x-auto py-1">
            {CATEGORIES.map((category) => (
              <Link
                className="whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-white focus-ring"
                href={`/shop?category=${category.slug}`}
                key={category.slug}
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Customer services" className="ml-auto flex shrink-0 items-center gap-1 border-l border-slate-800 pl-2">
            {serviceNavigation.map((item) => (
              <Link
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition focus-ring ${
                  pathname === item.href ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            <span className="ml-2 text-xs text-slate-500">
              Cart: <strong className="text-slate-200">{formatPrice(cartSubtotal, currency)}</strong>
            </span>
          </nav>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 lg:hidden" id="mobile-navigation">
          <div className="site-container grid gap-5 py-4">
            <StorefrontSearch
              inputId="mobile-site-search"
              onNavigate={closeMenu}
              placeholder="Search the catalogue…"
            />
            <nav aria-label="Mobile shop categories">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Shop departments</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-bold text-white focus-ring"
                  href="/shop"
                  onClick={closeMenu}
                >
                  Shop all
                </Link>
                {CATEGORIES.map((category) => (
                  <Link
                    className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-ring"
                    href={`/shop?category=${category.slug}`}
                    key={category.slug}
                    onClick={closeMenu}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </nav>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
              {serviceNavigation.map((item) => (
                <Link
                  className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-ring"
                  href={item.href}
                  key={item.href}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                className="rounded-lg bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-ring"
                href="/cart"
                onClick={closeMenu}
              >
                Cart · {formatPrice(cartSubtotal, currency)}
              </Link>
              <button
                className="rounded-lg bg-slate-900 px-3 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-ring"
                onClick={() => setCurrency(currency === "EGP" ? "USD" : "EGP")}
                type="button"
              >
                Display prices in {currency === "EGP" ? "USD" : "EGP"}
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
    <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.7 20c.8-3.1 3.5-5.1 7.3-5.1s6.5 2 7.3 5.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="10" cy="20" fill="currentColor" r="1.2" />
      <circle cx="18" cy="20" fill="currentColor" r="1.2" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <span aria-hidden="true" className="text-xl">×</span>
  ) : (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
