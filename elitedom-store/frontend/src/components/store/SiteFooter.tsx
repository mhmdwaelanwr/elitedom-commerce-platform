"use client";

import Link from "next/link";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function SiteFooter() {
  const { t } = usePreferences();

  const storeLinks = [
    { href: "/shop", label: t("storefront", "shopHardware") },
    { href: "/b2b", label: t("storefront", "b2bQuotation") },
    { href: "/warranty", label: t("storefront", "warrantyRma") },
    { href: "/account", label: t("storefront", "myAccount") },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-surface text-muted">
      <div className="site-container py-10 sm:py-12">
        <div className="grid gap-10 border-b border-border pb-10 md:grid-cols-[1.35fr_0.8fr_1fr]">
          <div>
            <Link className="focus-ring inline-flex items-center gap-2.5 rounded-lg" href="/">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-black text-primary-contrast shadow-sm">E</span>
              <span className="text-lg font-black tracking-[-0.04em] text-foreground">ELITE<span className="text-primary">DOM</span></span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6">{t("storefront", "footerDescription")}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-foreground">EGP</span>
              <span className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-foreground">Paymob</span>
              <span className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-foreground">Odoo 17</span>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-foreground">{t("storefront", "store")}</h2>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {storeLinks.map((link) => (
                <li key={link.href}>
                  <Link className="focus-ring inline-flex rounded-md hover:text-primary" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-foreground">{t("storefront", "customerPromise")}</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-6">
              <PromiseItem>{t("storefront", "clearPrices")}</PromiseItem>
              <PromiseItem>{t("storefront", "governorateDelivery")}</PromiseItem>
              <PromiseItem>{t("storefront", "digitalWarranty")}</PromiseItem>
              <PromiseItem>{t("storefront", "technicalHelp")}</PromiseItem>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Elitedom Store. {t("storefront", "rightsReserved")}</span>
          <span>{t("storefront", "paymentMethods")}</span>
        </div>
      </div>
    </footer>
  );
}

function PromiseItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      <span>{children}</span>
    </li>
  );
}
