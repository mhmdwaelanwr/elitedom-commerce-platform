"use client";

import Link from "next/link";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteFooter() {
  const { t } = usePreferences();

  const shopLinks = [
    { href: "/shop", label: t("storefront", "shopHardware") },
    { href: "/b2b", label: t("storefront", "b2bQuotation") },
    { href: "/warranty", label: t("storefront", "warrantyRma") },
    { href: "/account", label: t("storefront", "myAccount") },
  ];

  const promiseItems = [
    t("storefront", "clearPrices"),
    t("storefront", "governorateDelivery"),
    t("storefront", "digitalWarranty"),
    t("storefront", "technicalHelp"),
  ];

  return (
    <footer className="mt-auto border-t border-border bg-surface text-muted">
      <div className="site-container grid gap-9 py-10 md:grid-cols-[1.4fr_0.8fr_1fr] lg:gap-14 lg:py-12">
        <div>
          <Link className="focus-ring inline-flex items-center gap-2.5 rounded-lg" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-base font-black text-primary-contrast">E</span>
            <span className="text-lg font-black tracking-[-0.04em] text-foreground">ELITE<span className="text-primary">DOM</span></span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6">{t("storefront", "footerDescription")}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            {t("storefront", "verifiedCatalogue")}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground">{t("storefront", "store")}</h2>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link className="focus-ring inline-flex rounded-md transition hover:text-primary" href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-foreground">{t("storefront", "customerPromise")}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-5">
            {promiseItems.map((item) => (
              <li className="flex items-start gap-2" key={item}>
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--ds-soft-success)] text-[10px] font-black text-success" aria-hidden="true">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border bg-background/70">
        <div className="site-container flex flex-col gap-2 py-4 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <span>© {new Date().getFullYear()} Elitedom Store. {t("storefront", "rightsReserved")}</span>
          <span>{t("storefront", "paymentMethods")}</span>
        </div>
      </div>
    </footer>
  );
}
