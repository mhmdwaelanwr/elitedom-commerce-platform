"use client";

import Link from "next/link";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteFooter() {
  const { t } = usePreferences();
  const footerLinks = [
    { href: "/shop", label: t("storefront", "shopHardware") },
    { href: "/b2b", label: t("storefront", "b2bQuotation") },
    { href: "/warranty", label: t("storefront", "warrantyRma") },
    { href: "/account", label: t("storefront", "myAccount") },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-surface text-muted">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-lg">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-black text-primary-contrast">E</span>
            <span className="text-lg font-black tracking-tight text-foreground">ELITE<span className="text-primary">DOM</span></span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6">{t("storefront", "footerDescription")}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">{t("storefront", "store")}</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            {footerLinks.map((link) => <li key={link.href}><Link className="focus-ring hover:text-foreground" href={link.href}>{link.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">{t("storefront", "customerPromise")}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6">
            <li>{t("storefront", "clearPrices")}</li>
            <li>{t("storefront", "governorateDelivery")}</li>
            <li>{t("storefront", "digitalWarranty")}</li>
            <li>{t("storefront", "technicalHelp")}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="site-container flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Elitedom Store. {t("storefront", "rightsReserved")}</span>
          <span>{t("storefront", "paymentMethods")}</span>
        </div>
      </div>
    </footer>
  );
}
