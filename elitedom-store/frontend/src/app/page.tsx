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
      <section className="site-container pt-5 sm:pt-7 lg:pt-8">
        <div className="hero-surface relative min-h-[34rem] overflow-hidden rounded-[2rem] px-6 py-10 sm:min-h-[38rem] sm:px-10 sm:py-14 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)] lg:items-center lg:px-14 xl:min-h-[42rem] xl:px-16">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-bold text-primary">{t("storefront", "heroEyebrow")}</p>
            <h1 className="mt-4 max-w-2xl text-[2.65rem] font-bold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-[4.25rem] xl:text-[4.8rem]">
              {t("storefront", "heroTitleLead")} {t("storefront", "heroTitleAccent")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {t("storefront", "heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/shop">
                {t("storefront", "shopNow")} <span aria-hidden="true">{arrow}</span>
              </Link>
              <Link className="button-secondary border-transparent bg-surface" href="/b2b">
                {t("storefront", "businessQuote")}
              </Link>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] lg:inset-y-0 lg:start-auto lg:end-0 lg:h-auto lg:w-[54%]">
            <div className="hero-accent-surface absolute bottom-[-10%] end-[-8%] h-[84%] w-[78%] rounded-[42%_58%_42%_58%/55%_45%_55%_45%]" aria-hidden="true" />
            <Image
              alt=""
              aria-hidden="true"
              className="relative z-10 object-contain object-bottom p-3 lg:p-8 xl:p-10"
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
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
              {t("storefront", "departmentHeading")}
            </h2>
          </div>
          <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-primary transition hover:bg-[var(--ds-primary-soft)]" href="/shop">
            {t("storefront", "fullCatalogue")} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((department, index) => (
            <Link
              className="focus-ring group flex min-w-0 flex-col items-center gap-3 rounded-[1.75rem] p-2 text-center transition hover:bg-surface"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className={`relative block aspect-square w-full overflow-hidden rounded-[1.75rem] ${index % 2 === 0 ? "bg-elevated" : "tonal-surface"}`}>
                <Image alt="" className="object-contain p-5 transition duration-300 group-hover:scale-[1.05] sm:p-6" fill sizes="(min-width: 1024px) 12vw, 45vw" src={department.image} />
              </span>
              <span className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                {departmentNames[department.slug] ?? department.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <TrustRow />

      <HomeCatalogSections />

      <section className="site-container py-14 sm:py-20">
        <div className="grid overflow-hidden rounded-[2rem] bg-surface lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="flex flex-col justify-center px-7 py-10 sm:px-10 sm:py-14 lg:px-14">
            <p className="text-sm font-bold text-primary">{t("storefront", "performanceSystems")}</p>
            <h2 className="mt-3 max-w-lg text-3xl font-bold leading-tight tracking-[-0.045em] text-foreground sm:text-5xl">
              {t("storefront", "performanceSystemsTitle")}
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted sm:text-base">
              {t("storefront", "performanceSystemsText")}
            </p>
            <Link className="button-primary mt-7 w-fit" href="/shop?category=computers">
              {t("storefront", "shopNow")} <span aria-hidden="true">{arrow}</span>
            </Link>
          </div>
          <div className="product-canvas relative min-h-[22rem] sm:min-h-[30rem] lg:min-h-[34rem]">
            <Image alt="" className="object-contain object-bottom p-6 sm:p-10" fill sizes="(min-width: 1024px) 55vw, 100vw" src="/template/images/promo/promo-01.png" />
          </div>
        </div>
      </section>

      <section className="site-container pb-16 sm:pb-24">
        <div className="grid gap-4 lg:grid-cols-2">
          <ServiceTile
            arrow={arrow}
            href="/b2b"
            label={t("storefront", "business")}
            text={t("storefront", "equipTeamText")}
            title={t("storefront", "equipTeam")}
          />
          <ServiceTile
            arrow={arrow}
            href="/warranty"
            label={t("storefront", "warranty")}
            text={t("storefront", "supportAfterCheckoutText")}
            title={t("storefront", "supportAfterCheckout")}
            tonal
          />
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
        <TrustPoint detail={t("storefront", "freeShippingDetail")} icon={<TruckIcon />} title={t("storefront", "freeShipping")} />
        <TrustPoint detail={t("storefront", "securePaymentsDetail")} icon={<ShieldIcon />} title={t("storefront", "securePayments")} />
        <TrustPoint detail={t("storefront", "verifiedWarrantyDetail")} icon={<SupportIcon />} title={t("storefront", "verifiedWarranty")} />
      </div>
    </section>
  );
}

function TrustPoint({ title, detail, icon }: { title: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-2 py-6 sm:px-6 sm:py-7">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ds-primary-soft)] text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

function ServiceTile({
  arrow,
  href,
  label,
  text,
  title,
  tonal = false,
}: {
  arrow: string;
  href: string;
  label: string;
  text: string;
  title: string;
  tonal?: boolean;
}) {
  return (
    <Link className={`focus-ring group flex min-h-72 flex-col rounded-[2rem] p-7 transition sm:p-10 ${tonal ? "tonal-surface" : "hero-surface"}`} href={href}>
      <p className="text-sm font-bold text-primary">{label}</p>
      <h2 className="mt-3 max-w-md text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">{text}</p>
      <span className="mt-auto pt-8 text-sm font-bold text-primary group-hover:underline">
        {label} <span aria-hidden="true">{arrow}</span>
      </span>
    </Link>
  );
}

function TruckIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
function ShieldIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
function SupportIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M5 13v-2a7 7 0 0 1 14 0v2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><path d="M5 12H3v5h4v-5H5ZM19 12h2v5h-4v-5h2ZM17 19c-1.2 1-2.8 1.5-5 1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}