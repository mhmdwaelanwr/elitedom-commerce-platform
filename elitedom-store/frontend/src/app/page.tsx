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
    <>
      <section className="border-b border-border bg-background">
        <div className="site-container py-5 sm:py-7 lg:py-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,0.8fr)]">
            <HeroCard arrow={arrow} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <CampaignCard
                action={t("storefront", "shopMobile")}
                href="/shop?category=mobile"
                image="/template/images/hero/hero-02.png"
                kicker={t("storefront", "mobileWork")}
                title={t("storefront", "portablePerformance")}
                arrow={arrow}
              />
              <CampaignCard
                action={t("storefront", "shopAudio")}
                href="/shop?category=audio"
                image="/template/images/hero/hero-03.png"
                kicker={t("storefront", "focusedSound")}
                title={t("storefront", "audioForEverything")}
                arrow={arrow}
              />
            </div>
          </div>
        </div>
      </section>

      <TrustStrip />

      <section className="site-container py-10 sm:py-12">
        <SectionHeading
          action={t("storefront", "fullCatalogue")}
          actionHref="/shop"
          arrow={arrow}
          eyebrow={t("storefront", "browseByDepartment")}
          title={t("storefront", "departmentHeading")}
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((department) => (
            <Link
              className="commerce-card commerce-card-hover group flex min-h-36 flex-col items-center justify-center gap-3 p-4 text-center"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className="relative block h-20 w-20 overflow-hidden rounded-xl bg-elevated">
                <Image
                  alt=""
                  className="object-contain p-2.5 transition duration-200 group-hover:scale-105"
                  fill
                  sizes="80px"
                  src={department.image}
                />
              </span>
              <span className="text-sm font-black text-foreground group-hover:text-primary">
                {departmentNames[department.slug] ?? department.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HomeCatalogSections />

      <section className="site-container py-10 sm:py-14">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Link
            className="commerce-panel group relative min-h-[23rem] overflow-hidden p-7 sm:p-9"
            href="/shop?category=computers"
          >
            <div className="relative z-10 max-w-md">
              <p className="section-kicker">{t("storefront", "performanceSystems")}</p>
              <h2 className="mt-3 max-w-sm text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                {t("storefront", "performanceSystemsTitle")}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted sm:text-base sm:leading-7">
                {t("storefront", "performanceSystemsText")}
              </p>
              <span className="button-secondary mt-7">
                {t("storefront", "shopNow")} <span aria-hidden="true">{arrow}</span>
              </span>
            </div>
            <div className="absolute inset-y-0 end-0 hidden w-[48%] sm:block">
              <Image
                alt=""
                className="object-contain object-bottom p-5 transition duration-300 group-hover:scale-[1.02]"
                fill
                sizes="(min-width: 1024px) 40vw, 50vw"
                src="/template/images/promo/promo-01.png"
              />
            </div>
          </Link>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <ServiceCard
              action={`${t("storefront", "open")} ${arrow}`}
              href="/b2b"
              icon="business"
              text={t("storefront", "equipTeamText")}
              title={t("storefront", "equipTeam")}
            />
            <ServiceCard
              action={`${t("storefront", "open")} ${arrow}`}
              href="/warranty"
              icon="shield"
              text={t("storefront", "supportAfterCheckoutText")}
              title={t("storefront", "supportAfterCheckout")}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-elevated/65">
        <div className="site-container grid gap-7 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center sm:py-12">
          <div>
            <p className="section-kicker">{t("storefront", "customerPromise")}</p>
            <h2 className="mt-3 max-w-md text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {t("storefront", "supportAfterCheckout")}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted sm:text-base">
              {t("storefront", "footerDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PromiseItem icon="price" text={t("storefront", "clearPrices")} />
            <PromiseItem icon="truck" text={t("storefront", "governorateDelivery")} />
            <PromiseItem icon="shield" text={t("storefront", "digitalWarranty")} />
            <PromiseItem icon="support" text={t("storefront", "technicalHelp")} />
          </div>
        </div>
      </section>
    </>
  );
}

function HeroCard({ arrow }: { arrow: string }) {
  const { t } = usePreferences();
  return (
    <div className="commerce-panel relative min-h-[34rem] overflow-hidden px-6 py-10 sm:px-10 sm:py-12 lg:min-h-[36rem] lg:px-12 lg:py-14">
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 text-xs font-bold text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {t("storefront", "heroEyebrow")}
        </div>
        <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.03] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[3.6rem]">
          {t("storefront", "heroTitleLead")} {" "}
          <span className="text-primary">{t("storefront", "heroTitleAccent")}</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted lg:text-lg lg:leading-8">
          {t("storefront", "heroDescription")}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="button-primary" href="/shop">
            {t("storefront", "shopNow")} <span aria-hidden="true">{arrow}</span>
          </Link>
          <Link className="button-secondary" href="/b2b">
            {t("storefront", "businessQuote")}
          </Link>
        </div>
        <dl className="mt-9 grid max-w-xl grid-cols-3 divide-x divide-border border-t border-border pt-5 rtl:divide-x-reverse">
          <Metric label={t("storefront", "liveInventory")} value="Odoo" />
          <Metric label={t("storefront", "vatIncluded")} value="14%" />
          <Metric label={t("storefront", "fulfillment")} value={t("storefront", "localWarehouses")} />
        </dl>
      </div>
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 end-[-2rem] hidden h-auto w-[42%] max-w-[31rem] object-contain drop-shadow-xl lg:block"
        height={560}
        priority
        src="/template/images/hero/hero-01.png"
        width={560}
      />
    </div>
  );
}

function CampaignCard({
  action,
  href,
  image,
  kicker,
  title,
  arrow,
}: {
  action: string;
  href: string;
  image: string;
  kicker: string;
  title: string;
  arrow: string;
}) {
  return (
    <Link className="commerce-card commerce-card-hover group relative min-h-64 overflow-hidden p-6" href={href}>
      <div className="relative z-10 max-w-[14rem]">
        <p className="section-kicker">{kicker}</p>
        <h2 className="mt-2 text-xl font-black leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-primary">
          {action} <span aria-hidden="true">{arrow}</span>
        </span>
      </div>
      <Image
        alt=""
        className="absolute bottom-0 end-0 h-[62%] w-[48%] object-contain object-bottom p-2 transition duration-300 group-hover:scale-[1.03]"
        fill
        sizes="320px"
        src={image}
      />
    </Link>
  );
}

function TrustStrip() {
  const { t } = usePreferences();
  return (
    <section className="border-b border-border bg-surface">
      <div className="site-container grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
        <TrustPoint detail={t("storefront", "freeShippingDetail")} icon="truck" title={t("storefront", "freeShipping")} />
        <TrustPoint detail={t("storefront", "securePaymentsDetail")} icon="shield" title={t("storefront", "securePayments")} />
        <TrustPoint detail={t("storefront", "verifiedWarrantyDetail")} icon="support" title={t("storefront", "verifiedWarranty")} />
      </div>
    </section>
  );
}

function TrustPoint({ title, detail, icon }: { title: string; detail: string; icon: "truck" | "shield" | "support" }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-primary">
        <SimpleIcon icon={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  action,
  actionHref,
  arrow,
  eyebrow,
  title,
}: {
  action: string;
  actionHref: string;
  arrow: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h2>
      </div>
      <Link className="focus-ring rounded-lg text-sm font-black text-primary hover:underline" href={actionHref}>
        {action} <span aria-hidden="true">{arrow}</span>
      </Link>
    </div>
  );
}

function ServiceCard({
  action,
  href,
  icon,
  text,
  title,
}: {
  action: string;
  href: string;
  icon: "business" | "shield";
  text: string;
  title: string;
}) {
  return (
    <Link className="commerce-card commerce-card-hover group flex min-h-44 flex-col p-6" href={href}>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-primary">
        <SimpleIcon icon={icon} />
      </span>
      <h3 className="mt-5 text-xl font-black tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
      <span className="mt-auto pt-5 text-sm font-black text-primary group-hover:underline">{action}</span>
    </Link>
  );
}

function PromiseItem({ icon, text }: { icon: "price" | "truck" | "shield" | "support"; text: string }) {
  return (
    <div className="commerce-card flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-primary">
        <SimpleIcon icon={icon} />
      </span>
      <span className="text-sm font-bold leading-5 text-foreground">{text}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:ps-0 last:pe-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-base font-black text-foreground sm:text-lg">{value}</dd>
    </div>
  );
}

function SimpleIcon({ icon }: { icon: "truck" | "shield" | "support" | "business" | "price" }) {
  if (icon === "truck") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (icon === "shield") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  if (icon === "support") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M5 13v-2a7 7 0 0 1 14 0v2M5 13H3v5h4v-5H5Zm14 0h2v5h-4v-5h2ZM17 18c0 2-2 3-5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  if (icon === "business") {
    return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M4 21V5h10v16M14 9h6v12M8 9h2M8 13h2M8 17h2M17 13h1M17 17h1M2 21h20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><path d="M4 7h16v10H4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8 12h8M12 9v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
