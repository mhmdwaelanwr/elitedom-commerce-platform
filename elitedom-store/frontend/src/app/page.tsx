"use client";

import Image from "next/image";
import Link from "next/link";
import { HomeCatalogSections } from "@/components/store/HomeCatalogSections";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function HomePage() {
  const { t } = usePreferences();
  const categoryNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="site-container grid min-h-[31rem] gap-8 py-10 lg:grid-cols-[minmax(0,.92fr)_minmax(30rem,1.08fr)] lg:items-center lg:py-14">
          <div className="max-w-xl">
            <p className="section-kicker">{t("storefront", "heroEyebrow")}</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-[3.55rem]">
              {t("storefront", "heroTitleLead")} {" "}
              <span className="text-primary">{t("storefront", "heroTitleAccent")}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted lg:text-[1.05rem] lg:leading-8">
              {t("storefront", "heroDescription")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="button-primary" href="/shop">
                {t("storefront", "shopNow")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
              </Link>
              <Link className="button-secondary" href="/b2b">{t("storefront", "businessQuote")}</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 text-xs font-bold text-muted">
              <span>{t("storefront", "liveInventory")}: Odoo</span>
              <span>{t("storefront", "vatIncluded")}: 14%</span>
              <span>{t("storefront", "localWarehouses")}</span>
            </div>
          </div>

          <div className="relative min-h-[22rem] overflow-hidden rounded-[1.6rem] border border-border bg-[var(--ds-product-canvas)] sm:min-h-[28rem]">
            <div className="absolute inset-x-5 top-5 z-10 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted sm:inset-x-7 sm:top-7">
              <span>{t("storefront", "performanceSystems")}</span>
              <Link className="normal-case tracking-normal text-foreground hover:text-primary" href="/shop?category=computers">
                {t("storefront", "details")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
              </Link>
            </div>
            <Image
              alt=""
              className="object-contain p-10 sm:p-14 lg:p-16"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src="/template/images/hero/hero-01.png"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="site-container py-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{t("storefront", "browseByDepartment")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground sm:text-3xl">{t("storefront", "departmentHeading")}</h2>
            </div>
            <Link className="focus-ring text-sm font-black text-foreground hover:text-primary" href="/shop">
              {t("storefront", "fullCatalogue")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.map((category) => (
              <Link
                className="group rounded-2xl border border-border bg-surface p-3 text-center transition hover:border-[color-mix(in_srgb,var(--ds-text)_22%,var(--ds-border))]"
                href={`/shop?category=${category.slug}`}
                key={category.slug}
              >
                <span className="relative mx-auto block aspect-square w-full max-w-28 overflow-hidden rounded-xl bg-[var(--ds-product-canvas)]">
                  <Image alt="" className="object-contain p-3 transition duration-300 group-hover:scale-[1.025]" fill sizes="112px" src={category.image} />
                </span>
                <span className="mt-3 block truncate text-sm font-black text-foreground group-hover:text-primary">
                  {categoryNames[category.slug] ?? category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HomeCatalogSections />

      <section className="site-container py-12 sm:py-16">
        <div className="grid gap-4 lg:grid-cols-2">
          <Link className="group rounded-[1.4rem] border border-border bg-surface p-7 transition hover:border-foreground/20 sm:p-8" href="/b2b">
            <p className="section-kicker">{t("storefront", "business")}</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground">{t("storefront", "equipTeam")}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">{t("storefront", "equipTeamText")}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-foreground group-hover:text-primary">
              {t("storefront", "businessQuote")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </span>
          </Link>
          <Link className="group rounded-[1.4rem] border border-border bg-surface p-7 transition hover:border-foreground/20 sm:p-8" href="/warranty">
            <p className="section-kicker">{t("storefront", "warranty")}</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground">{t("storefront", "supportAfterCheckout")}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">{t("storefront", "supportAfterCheckoutText")}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-foreground group-hover:text-primary">
              {t("storefront", "open")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-elevated/50">
        <div className="site-container grid gap-5 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <Promise title={t("storefront", "clearPrices")} />
          <Promise title={t("storefront", "governorateDelivery")} />
          <Promise title={t("storefront", "digitalWarranty")} />
          <Promise title={t("storefront", "technicalHelp")} />
        </div>
      </section>
    </>
  );
}

function Promise({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 text-sm font-bold text-foreground">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-success/20 bg-[var(--ds-soft-success)] text-xs text-success" aria-hidden="true">✓</span>
      <span>{title}</span>
    </div>
  );
}
