"use client";

import Image from "next/image";
import Link from "next/link";
import { HomeCatalogSections } from "@/components/store/HomeCatalogSections";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function HomePage() {
  const { t } = usePreferences();
  const departmentNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  return (
    <>
      <section className="border-b border-border bg-background py-5 sm:py-7">
        <div className="site-container grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
          <div className="relative isolate min-h-[31rem] overflow-hidden rounded-2xl border border-border bg-primary px-6 py-9 text-primary-contrast shadow-sm sm:px-10 sm:py-12 lg:min-h-[36rem] lg:px-12">
            <div className="relative z-10 max-w-[38rem]">
              <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">
                {t("storefront", "heroEyebrow")}
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                {t("storefront", "heroTitleLead")} {t("storefront", "heroTitleAccent")}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 opacity-85 sm:text-base sm:leading-7">
                {t("storefront", "heroDescription")}
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-4 py-2.5 text-sm font-black text-primary shadow-sm transition hover:brightness-95" href="/shop">
                  {t("storefront", "shopNow")}
                  <ArrowIcon />
                </Link>
                <Link className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-primary-contrast/30 px-4 py-2.5 text-sm font-bold transition hover:bg-primary-contrast/10" href="/b2b">
                  {t("storefront", "businessQuote")}
                </Link>
              </div>

              <dl className="mt-9 grid max-w-2xl grid-cols-3 divide-x divide-primary-contrast/20 border-t border-primary-contrast/20 pt-5 rtl:divide-x-reverse">
                <Metric label={t("storefront", "liveInventory")} value="Odoo" />
                <Metric label={t("storefront", "vatIncluded")} value="14%" />
                <Metric label={t("storefront", "fulfillment")} value={t("storefront", "localWarehouses")} />
              </dl>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[43%] bg-primary-contrast/5 lg:inset-y-0 lg:end-0 lg:start-auto lg:h-auto lg:w-[42%]" />
            <Image
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 end-0 h-auto w-[60%] max-w-[31rem] object-contain object-bottom drop-shadow-xl sm:w-[48%]"
              height={560}
              priority
              src="/template/images/hero/hero-01.png"
              width={560}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <EditorialPromo
              action={t("storefront", "shopMobile")}
              href="/shop?category=mobile"
              image="/template/images/hero/hero-02.png"
              kicker={t("storefront", "mobileWork")}
              title={t("storefront", "portablePerformance")}
            />
            <EditorialPromo
              action={t("storefront", "shopAudio")}
              href="/shop?category=audio"
              image="/template/images/hero/hero-03.png"
              kicker={t("storefront", "focusedSound")}
              title={t("storefront", "audioForEverything")}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface">
        <div className="site-container grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          <TrustPoint icon="truck" title={t("storefront", "freeShipping")} detail={t("storefront", "freeShippingDetail")} />
          <TrustPoint icon="shield" title={t("storefront", "securePayments")} detail={t("storefront", "securePaymentsDetail")} />
          <TrustPoint icon="support" title={t("storefront", "verifiedWarranty")} detail={t("storefront", "verifiedWarrantyDetail")} />
        </div>
      </section>

      <section className="site-container py-12 sm:py-14">
        <SectionHeading
          eyebrow={t("storefront", "browseByDepartment")}
          title={t("storefront", "departmentHeading")}
          action={t("storefront", "fullCatalogue")}
          href="/shop"
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((department) => (
            <Link
              className="group commerce-card commerce-card-interactive flex min-h-40 flex-col justify-between p-3.5"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className="relative mx-auto block aspect-square w-full max-w-24 overflow-hidden rounded-lg bg-elevated">
                <Image
                  alt=""
                  className="object-contain p-3 transition duration-200 group-hover:scale-105"
                  fill
                  sizes="96px"
                  src={department.image}
                />
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 text-sm font-bold text-foreground group-hover:text-primary">
                <span>{departmentNames[department.slug] ?? department.name}</span>
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HomeCatalogSections />

      <section className="site-container py-12 sm:py-14">
        <div className="grid overflow-hidden rounded-2xl border border-border bg-surface lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-[25rem] overflow-hidden border-b border-border p-7 sm:p-9 lg:border-b-0 lg:border-e">
            <div className="relative z-10 max-w-md">
              <p className="section-kicker">{t("storefront", "performanceSystems")}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {t("storefront", "performanceSystemsTitle")}
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted sm:text-base">
                {t("storefront", "performanceSystemsText")}
              </p>
              <Link className="button-primary mt-6" href="/shop?category=computers">
                {t("storefront", "shopNow")}
                <ArrowIcon />
              </Link>
            </div>
            <Image
              alt=""
              className="absolute bottom-0 end-0 h-[68%] w-[56%] object-contain object-bottom"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              src="/template/images/promo/promo-01.png"
            />
          </div>

          <div className="grid divide-y divide-border">
            <FeaturePanel
              action={t("storefront", "businessQuote")}
              href="/b2b"
              kicker={t("storefront", "equipTeam")}
              text={t("storefront", "equipTeamText")}
            />
            <FeaturePanel
              action={t("storefront", "open")}
              href="/warranty"
              kicker={t("storefront", "supportAfterCheckout")}
              text={t("storefront", "supportAfterCheckoutText")}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  href,
}: {
  eyebrow: string;
  title: string;
  action: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h2>
      </div>
      <Link className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-primary hover:brightness-110" href={href}>
        {action}
        <ArrowIcon />
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:ps-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</dt>
      <dd className="mt-1 text-sm font-black sm:text-base">{value}</dd>
    </div>
  );
}

function EditorialPromo({
  action,
  href,
  image,
  kicker,
  title,
}: {
  action: string;
  href: string;
  image: string;
  kicker: string;
  title: string;
}) {
  return (
    <Link className="group commerce-card commerce-card-interactive relative min-h-64 overflow-hidden p-5 sm:min-h-72" href={href}>
      <div className="relative z-10 max-w-[13rem]">
        <p className="section-kicker">{kicker}</p>
        <h2 className="mt-2 text-xl font-black leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-primary">
          {action}
          <ArrowIcon />
        </span>
      </div>
      <Image
        alt=""
        className="absolute bottom-0 end-0 h-[63%] w-[52%] object-contain object-bottom transition duration-300 group-hover:scale-[1.025]"
        fill
        sizes="360px"
        src={image}
      />
    </Link>
  );
}

function TrustPoint({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon: "truck" | "shield" | "support";
}) {
  return (
    <div className="flex items-start gap-3 px-2 py-5 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-primary">
        <TrustIcon icon={icon} />
      </span>
      <div>
        <p className="text-sm font-black text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

function FeaturePanel({
  action,
  href,
  kicker,
  text,
}: {
  action: string;
  href: string;
  kicker: string;
  text: string;
}) {
  return (
    <Link className="group flex min-h-48 flex-col justify-center p-7 transition hover:bg-elevated/60 sm:p-8" href={href}>
      <p className="section-kicker">{kicker}</p>
      <p className="mt-3 max-w-md text-base leading-6 text-muted">{text}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary">
        {action}
        <ArrowIcon />
      </span>
    </Link>
  );
}

function ArrowIcon() {
  return <svg aria-hidden="true" className="shrink-0 rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function TrustIcon({ icon }: { icon: "truck" | "shield" | "support" }) {
  if (icon === "truck") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (icon === "shield") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M5 13v-2a7 7 0 0 1 14 0v2M5 13H3v5h4v-5H5Zm14 0h2v5h-4v-5h2ZM17 18c0 2-2 3-5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
