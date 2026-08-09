import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";

export type StoreLocale = "en" | "ar";

type StoreHeaderProps = {
  locale: StoreLocale;
  onLocaleChange: (locale: StoreLocale) => void;
};

const copy = {
  en: {
    search: "Search hardware",
    navigation: [
      ["GPUs", "/catalog"],
      ["CPUs", "/#categories"],
      ["PC builds", "/#outcomes"],
      ["Displays", "/#categories"],
      ["Deals", "/#curated"],
      ["Business", "/business"],
    ],
    menu: "Open navigation",
    closeMenu: "Close navigation",
    home: "Elitedom home",
    primary: "Primary navigation",
    mobilePrimary: "Mobile navigation",
    account: "Account",
    cart: "Cart",
    language: "العربية",
  },
  ar: {
    search: "ابحث في الهاردوير",
    navigation: [
      ["كروت الشاشة", "/catalog"],
      ["المعالجات", "/#categories"],
      ["تجميعات PC", "/#outcomes"],
      ["الشاشات", "/#categories"],
      ["العروض", "/#curated"],
      ["الشركات", "/business"],
    ],
    menu: "افتح القائمة",
    closeMenu: "اقفل القائمة",
    home: "الرئيسية في Elitedom",
    primary: "التنقل الرئيسي",
    mobilePrimary: "التنقل على الموبايل",
    account: "الحساب",
    cart: "السلة",
    language: "English",
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
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const labels = copy[locale];
  const nextLocale: StoreLocale = locale === "en" ? "ar" : "en";

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    navigate(normalized ? `/catalog?q=${encodeURIComponent(normalized)}` : "/catalog");
    setMobileOpen(false);
  }

  function openMobileSearch() {
    navigate("/catalog");
    setMobileOpen(false);
  }

  function changeLocale() {
    onLocaleChange(nextLocale);
    setMobileOpen(false);
  }

  function activeHref(href: string) {
    if (href === "/business") return location.pathname.startsWith("/business");
    if (href === "/catalog") return location.pathname.startsWith("/catalog") || location.pathname.startsWith("/products/");
    return false;
  }

  return (
    <header className="el-store-header" data-testid="store-header">
      <div className="el-store-header__left">
        <Link aria-label={labels.home} className="el-store-header__brand" to="/">
          <span className="el-store-header__desktop-brand"><ElitedomBrand /></span>
        </Link>

        <nav aria-label={labels.primary} className="el-store-header__nav">
          {labels.navigation.map(([label, href]) => (
            <Link className={activeHref(href) ? "is-active" : undefined} to={href} key={label}>
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
            placeholder={labels.search}
            type="search"
            value={query}
          />
        </form>

        <button
          aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
          className="el-icon-button el-locale-button"
          onClick={changeLocale}
          type="button"
        >
          {nextLocale === "ar" ? "AR" : "EN"}
        </button>

        <Link aria-label={labels.account} className="el-icon-button" to="/account">
          <StoreIcon name="account" size={20} />
        </Link>
        <Link aria-label={labels.cart} className="el-icon-button" to="/cart">
          <StoreIcon name="cart" size={20} />
        </Link>
      </div>

      <div className="el-store-header__mobile-row">
        <div className="el-store-header__mobile-brand-group">
          <Link aria-label={labels.home} className="el-store-header__mobile-brand" to="/">
            <ElitedomBrand compact />
          </Link>
          <button
            aria-expanded={mobileOpen}
            aria-controls="el-mobile-navigation"
            aria-label={mobileOpen ? labels.closeMenu : labels.menu}
            className="el-icon-button el-menu-button"
            onClick={() => setMobileOpen((open) => !open)}
            ref={menuButtonRef}
            type="button"
          >
            <StoreIcon name="menu" size={20} />
          </button>
        </div>

        <div className="el-store-header__mobile-actions">
          <button aria-label={labels.search} className="el-icon-button" onClick={openMobileSearch} type="button">
            <StoreIcon name="search" size={20} />
          </button>
          <Link aria-label={labels.account} className="el-icon-button" to="/account">
            <StoreIcon name="account" size={20} />
          </Link>
          <Link aria-label={labels.cart} className="el-icon-button" to="/cart">
            <StoreIcon name="cart" size={20} />
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <nav aria-label={labels.mobilePrimary} className="el-mobile-nav" id="el-mobile-navigation">
          {labels.navigation.map(([label, href]) => (
            <Link key={label} onClick={() => setMobileOpen(false)} to={href}>
              {label}
            </Link>
          ))}
          <button className="el-mobile-nav__locale" onClick={changeLocale} type="button">
            {labels.language}
          </button>
        </nav>
      ) : null}
    </header>
  );
}
