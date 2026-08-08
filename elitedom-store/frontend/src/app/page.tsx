"use client";

import Image from "next/image";
import Link from "next/link";
import { HomeCatalogSections } from "@/components/store/HomeCatalogSections";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function HomePage() {
  const { direction, t } = usePreferences();
  const arrow = direction === "rtl" ? "←" : "→";
  const departmentNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  return (
    <main>
      <section className="site-container py-6 sm:py-8 lg:py-10">
        <div className="grid min-h-[34rem] overflow-hidden rounded-2xl bg-elevated lg:grid-cols-2">
          <div className="flex flex-col justify-center px-7 py-10 sm:px-10 lg:px-14 xl:px-16">
            <p className="text-sm font-bold text-primary">{t("storefront", "heroEyebrow")}</p>
            <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
              {t("storefront", "heroTitleLead")} {t("storefront", "heroTitleAccent")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
              {t("storefront", "heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/shop">
                {t("storefront", "shopNow")}
              </Link>
              <Link className="button-secondary bg-surface" href="/b2b">
                {t("storefront", "businessQuote")}
              </Link>
            </div>
          </div>

          <div className="relative min-h-[22rem] bg-surface lg:min-h-full">
            <Image
              alt=""
              aria-hidden="true"
              className="object-contain p-8 sm:p-12 lg:p-14"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src="/template/images/hero/hero-01.png"
            />
          </div>
        </div>
      </section>

      <section className="site-container py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-primary">{t("storefront", "browseByDepartment")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl">
              {t("storefront", "departmentHeading")}
            </h2>
          </div>
          <Link className="focus-ring rounded-full px-4 py-2 text-sm font-bold text-primary transition hover:bg-[var(--ds-primary-soft)]" href="/shop">
            {t("storefront", "fullCatalogue")} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((department) => (
            <Link
              className="focus-ring group flex min-w-0 flex-col rounded-2xl bg-elevated p-4 transition hover:text-primary"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-surface">
                <Image alt="" className="object-contain p-5 transition-transform duration-200 group-hover:scale-[1.03]" fill sizes="(min-width: 1024px) 12vw, 45vw" src={department.image} />
              </span>
              <span className="mt-4 truncate text-center text-sm font-bold text-foreground group-hover:text-primary">
                {departmentNames[department.slug] ?? department.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <TrustRow />

      <HomeCatalogSections />

      <section className="site-container py-14 sm:py-20">
        <div className="grid overflow-hidden rounded-2xl bg-elevated lg:grid-cols-2">
          <div className="flex flex-col justify-center px-7 py-10 sm:px-10 lg:px-14">
            <p className="text-sm font-bold text-primary">{t("storefront", "performanceSystems")}</p>
            <h2 className="mt-3 max-w-lg text-3xl font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
              {t("storefront", "performanceSystemsTitle")}
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted sm:text-base">
              {t("storefront", "performanceSystemsText")}
            </p>
            <Link className="button-primary mt-7 w-fit" href="/shop?category=computers">
              {t("storefront", "shopNow")}
            </Link>
          </div>
          <div className="relative min-h-[24rem] bg-surface sm:min-h-[30rem]">
            <Image alt="" className="object-contain p-8 sm:p-12" fill sizes="(min-width: 1024px) 50vw, 100vw" src="/template/images/promo/promo-01.png" />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="site-container grid divide-y divide-border py-2 md:grid-cols-2 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
          <ServiceLink arrow={arrow} href="/b2b" label={t("storefront", "business")} text={t("storefront", "equipTeamText")} title={t("storefront", "equipTeam")} />
          <ServiceLink arrow={arrow} href="/warranty" label={t("storefront", "warranty")} text={t("storefront", "supportAfterCheckoutText")} title={t("storefront", "supportAfterCheckout")} />
        </div>
      </section>
    </main>
  );
}

function TrustRow() {
  const { t } = usePreferences();
  return (
    <section className="border-y border-border bg-surface">
      <div className="site-container grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
        <TrustPoint title={t("storefront", "freeShipping")} detail={t("storefront", "freeShippingDetail")} />
        <TrustPoint title={t("storefront", "securePayments")} detail={t("storefront", "securePaymentsDetail")} />
        <TrustPoint title={t("storefront", "verifiedWarranty")} detail={t("storefront", "verifiedWarrantyDetail")} />
      </div>
    </section>
  );
}

function TrustPoint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-3 py-6 sm:px-6">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function ServiceLink({ arrow, href, label, text, title }: { arrow: string; href: string; label: string; text: string; title: string }) {
  return (
    <Link className="focus-ring group px-4 py-10 sm:px-8 lg:px-12" href={href}>
      <p className="text-sm font-bold text-primary">{label}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-muted">{text}</p>
      <span className="mt-5 inline-flex text-sm font-bold text-primary group-hover:underline">
        {label} <span className="ms-1" aria-hidden="true">{arrow}</span>
      </span>
    </Link>
  );
}