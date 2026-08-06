"use client";

import Image from "next/image";
import Link from "next/link";
import { HomeCatalogSections } from "@/components/store/HomeCatalogSections";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function HomePage() {
  const { direction, t } = usePreferences();
  const departmentNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };
  const arrow = direction === "rtl" ? "←" : "→";

  return (
    <>
      <section className="surface-grid overflow-hidden border-b border-border bg-background py-6 lg:py-10">
        <div className="site-container grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(20rem,1fr)]">
          <div className="relative isolate min-h-[31rem] overflow-hidden rounded-[2rem] border border-border bg-surface px-7 py-12 shadow-2xl sm:px-12 lg:min-h-[35rem] lg:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,var(--ds-primary-soft),transparent_38%),radial-gradient(circle_at_15%_90%,var(--ds-accent-soft),transparent_34%)]" />
            <div className="relative z-10 max-w-2xl">
              <p className="section-kicker">{t("storefront", "heroEyebrow")}</p>
              <h1 className="mt-4 text-4xl font-black leading-[1.03] tracking-tight text-foreground sm:text-6xl">
                {t("storefront", "heroTitleLead")} {" "}
                <span className="gradient-text">{t("storefront", "heroTitleAccent")}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
                {t("storefront", "heroDescription")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="button-primary" href="/shop">
                  {t("storefront", "shopNow")} <span aria-hidden="true">{arrow}</span>
                </Link>
                <Link className="button-secondary" href="/b2b">
                  {t("storefront", "businessQuote")}
                </Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-border pt-6">
                <Metric label={t("storefront", "liveInventory")} value="Odoo" />
                <Metric label={t("storefront", "vatIncluded")} value="14%" />
                <Metric label={t("storefront", "fulfillment")} value={t("storefront", "localWarehouses")} />
              </dl>
            </div>
            <Image
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 end-0 hidden h-auto w-[42%] max-w-[29rem] object-contain drop-shadow-2xl lg:block"
              height={520}
              priority
              src="/template/images/hero/hero-01.png"
              width={520}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <PromoCard
              action={t("storefront", "shopMobile")}
              arrow={arrow}
              href="/shop?category=mobile"
              image="/template/images/hero/hero-02.png"
              kicker={t("storefront", "mobileWork")}
              title={t("storefront", "portablePerformance")}
            />
            <PromoCard
              action={t("storefront", "shopAudio")}
              arrow={arrow}
              href="/shop?category=audio"
              image="/template/images/hero/hero-03.png"
              kicker={t("storefront", "focusedSound")}
              title={t("storefront", "audioForEverything")}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-elevated/70">
        <div className="site-container grid divide-y divide-border py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          <TrustPoint title={t("storefront", "freeShipping")} detail={t("storefront", "freeShippingDetail")} icon="truck" />
          <TrustPoint title={t("storefront", "securePayments")} detail={t("storefront", "securePaymentsDetail")} icon="shield" />
          <TrustPoint title={t("storefront", "verifiedWarranty")} detail={t("storefront", "verifiedWarrantyDetail")} icon="support" />
        </div>
      </section>

      <section className="site-container py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{t("storefront", "browseByDepartment")}</p>
            <h2 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">
              {t("storefront", "departmentHeading")}
            </h2>
          </div>
          <Link className="focus-ring rounded-lg text-sm font-black text-primary hover:brightness-110" href="/shop">
            {t("storefront", "fullCatalogue")} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((department) => (
            <Link
              className="group rounded-2xl border border-border bg-surface p-4 text-center transition hover:-translate-y-1 hover:border-primary hover:shadow-xl"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className="relative mx-auto block aspect-square max-w-24 overflow-hidden rounded-2xl bg-elevated">
                <Image
                  alt=""
                  className="object-contain p-3 transition duration-300 group-hover:scale-110"
                  fill
                  sizes="96px"
                  src={department.image}
                />
              </span>
              <span className="mt-4 block text-sm font-black text-foreground group-hover:text-primary">
                {departmentNames[department.slug] ?? department.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HomeCatalogSections />

      <section className="site-container py-14 sm:py-16">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Link
            className="group relative min-h-80 overflow-hidden rounded-3xl border border-border bg-surface p-8 transition hover:border-primary hover:shadow-xl"
            href="/shop?category=computers"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,var(--ds-primary-soft),transparent_46%)]" />
            <Image
              alt=""
              className="absolute bottom-0 end-0 h-full w-[48%] object-contain object-bottom transition duration-500 group-hover:scale-105"
              fill
              sizes="50vw"
              src="/template/images/promo/promo-01.png"
            />
            <div className="relative z-10 max-w-sm">
              <p className="section-kicker">{t("storefront", "performanceSystems")}</p>
              <h2 className="mt-3 text-3xl font-black text-foreground">
                {t("storefront", "performanceSystemsTitle")}
              </h2>
              <p className="mt-4 leading-7 text-muted">{t("storefront", "performanceSystemsText")}</p>
              <span className="mt-6 inline-flex text-sm font-black text-primary">
                {t("storefront", "shopNow")} {arrow}
              </span>
            </div>
          </Link>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <SmallBanner
              title={t("storefront", "equipTeam")}
              text={t("storefront", "equipTeamText")}
              href="/b2b"
              action={`${t("storefront", "open")} ${arrow}`}
            />
            <SmallBanner
              title={t("storefront", "supportAfterCheckout")}
              text={t("storefront", "supportAfterCheckoutText")}
              href="/warranty"
              action={`${t("storefront", "open")} ${arrow}`}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-black text-foreground">{value}</dd>
    </div>
  );
}

function PromoCard({
  action,
  arrow,
  href,
  image,
  kicker,
  title,
}: {
  action: string;
  arrow: string;
  href: string;
  image: string;
  kicker: string;
  title: string;
}) {
  return (
    <Link
      className="group relative min-h-64 overflow-hidden rounded-3xl border border-border bg-surface p-6 text-foreground transition hover:-translate-y-1 hover:border-primary hover:shadow-xl"
      href={href}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,var(--ds-accent-soft),transparent_46%)]" />
      <div className="relative z-10 max-w-[14rem]">
        <p className="section-kicker">{kicker}</p>
        <h2 className="mt-3 text-2xl font-black leading-tight">{title}</h2>
        <span className="mt-5 inline-flex text-sm font-black text-primary">{action} {arrow}</span>
      </div>
      <Image
        alt=""
        className="absolute bottom-0 end-0 h-[65%] w-[48%] object-contain object-bottom transition duration-500 group-hover:scale-105"
        fill
        sizes="320px"
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
    <div className="flex gap-3 px-5 py-5 sm:px-7">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ds-primary-soft)] text-primary">
        <TrustIcon icon={icon} />
      </span>
      <div>
        <p className="font-black text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

function TrustIcon({ icon }: { icon: "truck" | "shield" | "support" }) {
  if (icon === "truck") {
    return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (icon === "shield") {
    return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  }
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M5 13v-2a7 7 0 0 1 14 0v2M5 13H3v5h4v-5H5Zm14 0h2v5h-4v-5h2ZM17 18c0 2-2 3-5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function SmallBanner({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <Link className="rounded-3xl border border-border bg-elevated p-7 transition hover:border-primary hover:bg-surface hover:shadow-lg" href={href}>
      <h3 className="text-xl font-black text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
      <span className="mt-5 inline-flex text-sm font-black text-primary">{action}</span>
    </Link>
  );
}
