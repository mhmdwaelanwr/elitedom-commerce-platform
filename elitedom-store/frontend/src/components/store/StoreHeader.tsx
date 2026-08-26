import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import {
  FeedbackToast,
  MegaMenu,
  MiniCart,
  MobileMenu,
  SearchOverlay,
  type StoreToast,
} from "@/components/store/StoreExperiencePanels";
import { StoreIcon } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { restoreSession } from "@/lib/auth-session";
import { loadGuestCart, type GuestCartSnapshot } from "@/lib/cart-data";
import { fetchRichCatalog } from "@/lib/catalog-api";
import type { Product } from "@/types/store";

export type StoreLocale = "en" | "ar";

type StoreHeaderProps = {
  locale: StoreLocale;
  onLocaleChange: (locale: StoreLocale) => void;
};

const copy = {
  en: {
    search: "Search products, brands or specs",
    hardware: "Hardware",
    navigation: [
      ["GPUs", "/catalog?q=GPU"],
      ["CPUs", "/catalog?q=CPU"],
      ["PC builds", "/catalog?q=PC%20build"],
      ["Displays", "/catalog?q=Monitor"],
      ["Deals", "/catalog?sort=price-asc"],
      ["Business", "/business"],
    ],
    utility: [
      ["delivery", "Shipping confirmed at checkout"],
      ["warranty", "Local warranty"],
      ["shield", "Secure checkout"],
    ],
    businessCta: "Business & bulk orders",
    menu: "Open navigation",
    closeMenu: "Close navigation",
    home: "Elitedom home",
    primary: "Primary navigation",
    account: "Account",
    cart: "Cart",
    addedTitle: "Added to cart",
    addedMessage: "Your cart was updated successfully.",
    cartErrorTitle: "Something needs attention",
    cartErrorMessage: "We could not load your cart. Your progress is safe.",
  },
  ar: {
    search: "ابحث عن منتج أو براند أو مواصفة",
    hardware: "الهاردوير",
    navigation: [
      ["كروت الشاشة", "/catalog?q=GPU"],
      ["المعالجات", "/catalog?q=CPU"],
      ["تجميعات PC", "/catalog?q=PC%20build"],
      ["الشاشات", "/catalog?q=Monitor"],
      ["العروض", "/catalog?sort=price-asc"],
      ["الشركات", "/business"],
    ],
    utility: [
      ["delivery", "الشحن يتأكد عند إتمام الطلب"],
      ["warranty", "ضمان محلي"],
      ["shield", "دفع آمن"],
    ],
    businessCta: "طلبات الشركات والكميات",
    menu: "افتح القائمة",
    closeMenu: "اقفل القائمة",
    home: "الرئيسية في Elitedom",
    primary: "التنقل الرئيسي",
    account: "الحساب",
    cart: "السلة",
    addedTitle: "تمت الإضافة للسلة",
    addedMessage: "تم تحديث سلتك بنجاح.",
    cartErrorTitle: "في حاجة محتاجة انتباه",
    cartErrorMessage: "مقدرناش نحمل السلة، لكن تقدمك محفوظ.",
  },
} as const;

const searchButtonStyle = {
  appearance: "none",
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
} as const;

export function StoreHeader({ locale, onLocaleChange }: StoreHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cartSnapshot, setCartSnapshot] = useState<GuestCartSnapshot | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [toast, setToast] = useState<StoreToast | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const labels = copy[locale];
  const nextLocale: StoreLocale = locale === "en" ? "ar" : "en";
  const cartCount = cartSnapshot?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;
  const catalogueActive = location.pathname.startsWith("/catalog") || location.pathname.startsWith("/products/");

  const openCart = useCallback(async () => {
    setCartOpen(true);
    setSearchOpen(false);
    setMegaOpen(false);
    setCartLoading(true);
    try {
      const session = await restoreSession();
      setCartSnapshot(await loadGuestCart(locale, session));
    } catch {
      setCartSnapshot({ items: [] });
      setToast({ tone: "error", title: labels.cartErrorTitle, message: labels.cartErrorMessage });
    } finally {
      setCartLoading(false);
    }
  }, [labels.cartErrorMessage, labels.cartErrorTitle, locale]);

  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) setSearchLoading(true);
      fetchRichCatalog({ locale, query: query.trim() || undefined, limit: 3 })
        .then((products) => { if (active) setSearchResults(products.slice(0, 3)); })
        .catch(() => { if (active) setSearchResults([]); })
        .finally(() => { if (active) setSearchLoading(false); });
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [locale, query, searchOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileOpen) menuButtonRef.current?.focus();
      setMobileOpen(false);
      setMegaOpen(false);
      setSearchOpen(false);
      setCartOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  useEffect(() => {
    function cartUpdated() {
      setToast({ tone: "success", title: labels.addedTitle, message: labels.addedMessage });
      if (cartOpen) void openCart();
    }
    window.addEventListener("elitedom:cart-updated", cartUpdated);
    return () => window.removeEventListener("elitedom:cart-updated", cartUpdated);
  }, [cartOpen, labels.addedMessage, labels.addedTitle, openCart]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchAll();
  }

  function searchAll() {
    const normalized = query.trim();
    navigate(normalized ? `/catalog?q=${encodeURIComponent(normalized)}` : "/catalog");
    setSearchOpen(false);
    setMobileOpen(false);
  }

  function changeLocale(value: StoreLocale = nextLocale) {
    onLocaleChange(value);
    setMobileOpen(false);
    setMegaOpen(false);
  }

  function activeHref(href: string) {
    const destination = new URL(href, window.location.origin);
    if (destination.pathname === "/business") return location.pathname.startsWith("/business");
    if (destination.pathname !== "/catalog" || !location.pathname.startsWith("/catalog")) return false;

    const current = new URLSearchParams(location.search);
    const destinationQuery = destination.searchParams.get("q");
    const destinationSort = destination.searchParams.get("sort");

    if (destinationQuery) return current.get("q")?.toLowerCase() === destinationQuery.toLowerCase();
    if (destinationSort) return current.get("sort") === destinationSort && !current.get("q");
    return !current.get("q") && !current.get("sort");
  }

  const portalRoot = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <header className="el-store-header" data-testid="store-header">
        <div className="el-store-header__utility">
          <div className="el-store-header__utility-trust">
            {labels.utility.map(([icon, label]) => (
              <span key={label}>
                <StoreIcon name={icon} size={13} />
                {label}
              </span>
            ))}
          </div>
          <Link className="el-store-header__business-link" to="/business">
            <StoreIcon name="briefcase" size={14} />
            <span>{labels.businessCta}</span>
            <StoreIcon name="arrow" size={13} />
          </Link>
        </div>

        <div className="el-store-header__main">
          <div className="el-store-header__left">
            <Link aria-label={labels.home} className="el-store-header__brand" to="/">
              <span className="el-store-header__desktop-brand"><ElitedomBrand /></span>
            </Link>

            <nav aria-label={labels.primary} className="el-store-header__nav">
              <button aria-expanded={megaOpen} className={`el-store-header__hardware${catalogueActive ? " is-active" : ""}`} onClick={() => { setMegaOpen((open) => !open); setSearchOpen(false); setCartOpen(false); }} type="button">
                {labels.hardware}<StoreIcon name="chevron" size={14} />
              </button>
              {labels.navigation.map(([label, href]) => (
                <Link aria-current={activeHref(href) ? "page" : undefined} className={activeHref(href) ? "is-active" : undefined} to={href} key={label}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="el-store-header__actions">
            <form className="el-store-search" onSubmit={submitSearch} role="search">
              <button aria-label={labels.search} className="el-store-search__submit" style={searchButtonStyle} type="submit">
                <StoreIcon name="search" size={18} />
              </button>
              <input
                aria-label={labels.search}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => { setSearchOpen(true); setSearchLoading(true); setMegaOpen(false); setCartOpen(false); }}
                placeholder={labels.search}
                type="search"
                value={query}
              />
              <span aria-hidden="true" className="el-store-search__shortcut">↵</span>
            </form>

            <div className="el-store-header__action-cluster">
              <button aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"} className="el-icon-button el-locale-button" onClick={() => changeLocale()} type="button">
                {nextLocale === "ar" ? "AR" : "EN"}
              </button>
              <ThemeToggle className="el-icon-button" locale={locale} />
              <Link aria-label={labels.account} className="el-icon-button" to="/account"><StoreIcon name="account" size={19} /></Link>
              <button aria-label={labels.cart} className="el-icon-button el-cart-button" onClick={() => void openCart()} type="button">
                <StoreIcon name="cart" size={19} />
                {cartCount > 0 ? <span className="el-cart-count">{cartCount > 99 ? "99+" : cartCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="el-store-header__mobile-row">
            <div className="el-store-header__mobile-brand-group">
              <Link aria-label={labels.home} className="el-store-header__mobile-brand" to="/"><ElitedomBrand compact /></Link>
              <button aria-expanded={mobileOpen} aria-label={mobileOpen ? labels.closeMenu : labels.menu} className="el-icon-button el-menu-button" onClick={() => { setMobileOpen(true); setSearchOpen(false); setCartOpen(false); }} ref={menuButtonRef} type="button"><StoreIcon name="menu" size={20} /></button>
            </div>
            <div className="el-store-header__mobile-actions">
              <button aria-label={labels.search} className="el-icon-button" onClick={() => { setSearchOpen(true); setSearchLoading(true); setCartOpen(false); }} type="button"><StoreIcon name="search" size={20} /></button>
              <button aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"} className="el-icon-button el-locale-button" onClick={() => changeLocale()} type="button">
                {nextLocale === "ar" ? "AR" : "EN"}
              </button>
              <ThemeToggle className="el-icon-button" locale={locale} />
              <Link aria-label={labels.account} className="el-icon-button" to="/account"><StoreIcon name="account" size={20} /></Link>
              <button aria-label={labels.cart} className="el-icon-button el-cart-button" onClick={() => void openCart()} type="button">
                <StoreIcon name="cart" size={20} />
                {cartCount > 0 ? <span className="el-cart-count">{cartCount > 99 ? "99+" : cartCount}</span> : null}
              </button>
            </div>
          </div>
        </div>

        {megaOpen ? <MegaMenu featured={searchResults[0]} locale={locale} onClose={() => setMegaOpen(false)} /> : null}
      </header>

      {portalRoot && searchOpen ? createPortal(
        <div className="el-store-layer is-search" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <SearchOverlay loading={searchLoading} locale={locale} onClose={() => setSearchOpen(false)} onQueryChange={setQuery} onSearchAll={searchAll} products={searchResults} query={query} />
        </div>, portalRoot,
      ) : null}

      {portalRoot && cartOpen ? createPortal(
        <div className="el-store-layer is-cart" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <MiniCart items={cartSnapshot?.items ?? []} loading={cartLoading} locale={locale} onClose={() => setCartOpen(false)} />
        </div>, portalRoot,
      ) : null}

      {portalRoot && mobileOpen ? createPortal(
        <div className="el-store-layer is-mobile-menu" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
          <MobileMenu locale={locale} onClose={() => setMobileOpen(false)} onLocaleChange={onLocaleChange} />
        </div>, portalRoot,
      ) : null}

      {portalRoot && toast ? createPortal(<div aria-live="polite" className="el-toast-region"><FeedbackToast onClose={() => setToast(null)} toast={toast} /></div>, portalRoot) : null}
    </>
  );
}
