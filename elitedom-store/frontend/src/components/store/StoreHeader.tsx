import { useState } from "react";
import { Link } from "react-router-dom";
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
      ["GPUs", "#curated"],
      ["CPUs", "#categories"],
      ["PC builds", "#outcomes"],
      ["Displays", "#categories"],
      ["Deals", "#curated"],
    ],
    menu: "Open navigation",
    account: "Account",
    cart: "Cart",
  },
  ar: {
    search: "ابحث في الهاردوير",
    navigation: [
      ["كروت الشاشة", "#curated"],
      ["المعالجات", "#categories"],
      ["تجميعات PC", "#outcomes"],
      ["الشاشات", "#categories"],
      ["العروض", "#curated"],
    ],
    menu: "افتح القائمة",
    account: "الحساب",
    cart: "السلة",
  },
} as const;

export function StoreHeader({ locale, onLocaleChange }: StoreHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = copy[locale];
  const nextLocale: StoreLocale = locale === "en" ? "ar" : "en";

  return (
    <header className="el-store-header" data-testid="store-header">
      <div className="el-store-header__left">
        <Link aria-label="Elitedom home" className="el-store-header__brand" to="/">
          <span className="el-store-header__desktop-brand"><ElitedomBrand /></span>
          <span className="el-store-header__mobile-brand"><ElitedomBrand compact /></span>
        </Link>

        <nav aria-label="Primary" className="el-store-header__nav">
          {labels.navigation.map(([label, href], index) => (
            <a className={index === 0 ? "is-active" : undefined} href={href} key={label}>
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="el-store-header__actions">
        <label className="el-store-search">
          <StoreIcon name="search" size={18} />
          <span className="sr-only">{labels.search}</span>
          <input aria-label={labels.search} placeholder={labels.search} type="search" />
        </label>

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
            <a href={href} key={label} onClick={() => setMobileOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
