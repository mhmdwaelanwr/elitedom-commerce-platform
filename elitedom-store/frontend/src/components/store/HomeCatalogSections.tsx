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
    setLoading(true);
    setError(null);
    void fetchRichCatalog({ locale, limit: 24 })
      .then((result) => {
        if (active) setProducts(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : t("storefront", "catalogueLoadError"),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale, t]);

  if (loading) {
    return (
      <section aria-busy="true" aria-label={t("storefront", "checkingAvailability")} className="site-container py-14 sm:py-16">
        <div className="mb-8 h-8 w-64 animate-pulse rounded-lg bg-elevated" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface" key={index}>
              <div className="aspect-square animate-pulse bg-elevated" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-20 animate-pulse rounded bg-elevated" />
                <div className="h-5 w-full animate-pulse rounded bg-elevated" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-elevated" />
                <div className="h-11 w-full animate-pulse rounded-xl bg-elevated" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="site-container py-14 sm:py-16">
        <div className="rounded-3xl border border-warning bg-surface p-8 text-center shadow-lg">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-elevated text-warning" aria-hidden="true">!</span>
          <p className="section-kicker mt-4">{t("storefront", "liveCatalogueUnavailable")}</p>
          <h2 className="mt-3 text-2xl font-black text-foreground">{t("storefront", "reconnectingInventory")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">{error}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "retryCatalogue")}</Link>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="site-container py-14 sm:py-16">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center text-muted shadow-sm">
          {t("storefront", "noPublishedProducts")}
        </div>
      </section>
    );
  }

  const arrivals = products.slice(0, 4);
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const available = products
    .filter((product) => product.stockQty > 0 || product.dropshipEnabled)
    .slice(0, 4);
  const arrow = direction === "rtl" ? "←" : "→";

  return (
    <>
      <ProductSection
        arrow={arrow}
        eyebrow={t("storefront", "justLanded")}
        title={t("storefront", "newArrivals")}
        products={featured.length > 0 ? featured : arrivals}
        viewAll={t("storefront", "viewAllProducts")}
      />
      <ProductSection
        arrow={arrow}
        eyebrow={t("storefront", "readyToOrder")}
        title={t("storefront", "availableNow")}
        products={available.length > 0 ? available : arrivals}
        viewAll={t("storefront", "viewAllProducts")}
        muted
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
    <section className={muted ? "border-y border-border bg-elevated/60 py-14 sm:py-16" : "site-container py-14 sm:py-16"}>
      <div className={muted ? "site-container" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">{title}</h2>
          </div>
          <Link className="focus-ring rounded-lg text-sm font-black text-primary hover:brightness-110" href="/shop">
            {viewAll} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <StoreProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
