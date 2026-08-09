import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    ],
    menu: "Open navigation",
    account: "Account",
    cart: "Cart",
  },
  ar: {
    search: "ابحث في الهاردوير",
    navigation: [
      ["كروت الشاشة", "/catalog"],
      ["المعالجات", "/#categories"],
      ["تجميعات PC", "/#outcomes"],
      ["الشاشات", "/#categories"],
      ["العروض", "/#curated"],
    ],
    menu: "افتح القائمة",
    account: "الحساب",
    cart: "السلة",
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labels = copy[locale];
  const nextLocale: StoreLocale = locale === "en" ? "ar" : "en";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    navigate(normalized ? `/catalog?q=${encodeURIComponent(normalized)}` : "/catalog");
    setMobileOpen(false);
  }

  return (
    <header className="el-store-header" data-testid="store-header">
      <div className="el-store-header__left">
        <Link aria-label="Elitedom home" className="el-store-header__brand" to="/">
          <span className="el-store-header__desktop-brand"><ElitedomBrand /></span>
          <span className="el-store-header__mobile-brand"><ElitedomBrand compact /></span>
        </Link>

        <nav aria-label="Primary" className="el-store-header__nav">
          {labels.navigation.map(([label, href], index) => (
            <Link className={index === 0 ? "is-active" : undefined} to={href} key={label}>
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
          onClick={() => onLocaleChange(nextLocale)}
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

        <button
          aria-expanded={mobileOpen}
          aria-label={labels.menu}
          className="el-icon-button el-menu-button"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          <StoreIcon name="menu" size={20} />
        </button>
      </div>

      {mobileOpen ? (
        <nav aria-label="Mobile primary" className="el-mobile-nav">
          {labels.navigation.map(([label, href]) => (
            <Link key={label} onClick={() => setMobileOpen(false)} to={href}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
