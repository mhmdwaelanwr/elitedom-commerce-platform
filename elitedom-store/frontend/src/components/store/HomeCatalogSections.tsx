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
          if (active) setError(reason instanceof Error ? reason.message : t("storefront", "catalogueLoadError"));
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

  if (loading) return <CatalogSkeleton label={t("storefront", "checkingAvailability")} />;

  if (error) {
    return (
      <section className="site-container py-14 sm:py-20">
        <div className="mx-auto max-w-2xl rounded-[2rem] bg-elevated px-6 py-10 text-center sm:px-10">
          <p className="section-kicker">{t("storefront", "liveCatalogueUnavailable")}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-foreground">{t("storefront", "reconnectingInventory")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{error}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "retryCatalogue")}</Link>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="site-container py-14 sm:py-20">
        <div className="rounded-[2rem] bg-elevated p-8 text-center text-sm text-muted">{t("storefront", "noPublishedProducts")}</div>
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
        products={available.length > 0 ? available : arrivals}
        title={t("storefront", "availableNow")}
        viewAll={t("storefront", "viewAllProducts")}
        tonal
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
  tonal = false,
}: {
  arrow: string;
  eyebrow: string;
  title: string;
  products: Product[];
  viewAll: string;
  tonal?: boolean;
}) {
  return (
    <section className={tonal ? "bg-surface py-14 sm:py-20" : "py-14 sm:py-20"}>
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="section-kicker">{eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{title}</h2>
          </div>
          <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-primary transition hover:bg-[var(--ds-primary-soft)]" href="/shop">
            {viewAll} <span aria-hidden="true">{arrow}</span>
          </Link>
        </div>
        <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <StoreProductCard context="home" key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

function CatalogSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="site-container py-14 sm:py-20">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-elevated" />
        <div className="h-9 w-72 max-w-[70vw] animate-pulse rounded-full bg-elevated" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <div className="aspect-square animate-pulse rounded-[1.75rem] bg-elevated" />
            <div className="mt-4 space-y-2 px-1">
              <div className="h-3 w-20 animate-pulse rounded-full bg-elevated" />
              <div className="h-5 w-full animate-pulse rounded-full bg-elevated" />
              <div className="h-5 w-2/3 animate-pulse rounded-full bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}