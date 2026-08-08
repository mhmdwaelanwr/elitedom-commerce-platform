"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { fetchRichCatalog } from "@/lib/catalog-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

export function HomeCatalogSections() {
  const { direction, locale, t } = usePreferences();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetchRichCatalog({ locale, limit: 24 })
        .then((result) => {
          if (active) setProducts(result);
        })
        .catch((reason: unknown) => {
          if (active) {
            setError(reason instanceof Error ? reason.message : t("storefront", "catalogueLoadError"));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [locale, t]);

  if (loading) {
    return <CatalogSkeleton label={t("storefront", "checkingAvailability")} />;
  }

  if (error) {
    return (
      <section className="site-container py-10 sm:py-12">
        <div className="commerce-panel mx-auto max-w-3xl p-7 text-center sm:p-9">
          <span className="status-warning mx-auto grid h-10 w-10 place-items-center rounded-lg border text-sm font-black" aria-hidden="true">!</span>
          <p className="section-kicker mt-4">{t("storefront", "liveCatalogueUnavailable")}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">{t("storefront", "reconnectingInventory")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{error}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "retryCatalogue")}</Link>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="site-container py-10 sm:py-12">
        <div className="commerce-panel p-8 text-center text-sm text-muted">
          {t("storefront", "noPublishedProducts")}
        </div>
      </section>
    );
  }

  const arrivals = products.slice(0, 4);
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const available = products.filter((product) => product.stockQty > 0 || product.dropshipEnabled).slice(0, 4);
  const arrow = direction === "rtl" ? "←" : "→";

  return (
    <>
      <ProductSection
        arrow={arrow}
        eyebrow={t("storefront", "justLanded")}
        products={featured.length > 0 ? featured : arrivals}
        title={t("storefront", "newArrivals")}
        viewAll={t("storefront", "viewAllProducts")}
      />
      <ProductSection
        arrow={arrow}
        eyebrow={t("storefront", "readyToOrder")}
        muted
        products={available.length > 0 ? available : arrivals}
        title={t("storefront", "availableNow")}
        viewAll={t("storefront", "viewAllProducts")}
      />
    </>
  );
}

function ProductSection({
  arrow,
  eyebrow,
  title,
  products,
  viewAll,
  muted = false,
}: {
  arrow: string;
  eyebrow: string;
  title: string;
  products: Product[];
  viewAll: string;
  muted?: boolean;
}) {
  return (
    <section className={muted ? "border-y border-border bg-elevated/55 py-10 sm:py-12" : "py-10 sm:py-12"}>
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h2>
          </div>
          <Link className="focus-ring rounded-lg text-sm font-black text-primary hover:underline" href="/shop">
            {viewAll} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <StoreProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

function CatalogSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="site-container py-10 sm:py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-elevated" />
          <div className="h-8 w-64 max-w-[70vw] animate-pulse rounded bg-elevated" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded bg-elevated" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="commerce-card overflow-hidden" key={index}>
            <div className="aspect-[4/3] animate-pulse bg-elevated" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-elevated" />
              <div className="h-5 w-full animate-pulse rounded bg-elevated" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-elevated" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
