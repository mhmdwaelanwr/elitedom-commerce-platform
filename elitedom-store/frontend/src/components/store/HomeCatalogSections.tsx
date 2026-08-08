"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { fetchRichCatalog } from "@/lib/catalog-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

export function HomeCatalogSections() {
  const { locale, t } = usePreferences();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetchRichCatalog({ locale, limit: 18 })
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
      <section className="site-container py-12 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-7 text-center sm:p-9">
          <p className="section-kicker">{t("storefront", "liveCatalogueUnavailable")}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">{t("storefront", "reconnectingInventory")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{error}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "retryCatalogue")}</Link>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="site-container py-12 sm:py-16">
        <div className="rounded-2xl border border-dashed border-border bg-surface p-9 text-center text-sm text-muted">
          {t("storefront", "noPublishedProducts")}
        </div>
      </section>
    );
  }

  const featured = products.filter((product) => product.featured).slice(0, 4);
  const available = products.filter((product) => product.stockQty > 0 || product.dropshipEnabled).slice(0, 4);
  const firstRow = featured.length >= 4 ? featured : products.slice(0, 4);
  const secondRow = available.length >= 4 ? available : products.slice(4, 8);

  return (
    <>
      <ProductSection eyebrow={t("storefront", "justLanded")} products={firstRow} title={t("storefront", "newArrivals")} />
      {secondRow.length > 0 ? (
        <ProductSection eyebrow={t("storefront", "readyToOrder")} muted products={secondRow} title={t("storefront", "availableNow")} />
      ) : null}
    </>
  );
}

function ProductSection({
  eyebrow,
  title,
  products,
  muted = false,
}: {
  eyebrow: string;
  title: string;
  products: Product[];
  muted?: boolean;
}) {
  const { t } = usePreferences();
  return (
    <section className={muted ? "border-y border-border bg-elevated/45 py-12 sm:py-16" : "py-12 sm:py-16"}>
      <div className="site-container">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-foreground sm:text-3xl">{title}</h2>
          </div>
          <Link className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-black text-foreground hover:text-primary" href="/shop">
            {t("storefront", "viewAllProducts")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <StoreProductCard key={product.id} product={product} variant="home" />)}
        </div>
      </div>
    </section>
  );
}

function CatalogSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="site-container py-12 sm:py-16">
      <div className="mb-7 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-elevated" />
        <div className="h-8 w-64 max-w-[70vw] animate-pulse rounded bg-elevated" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="overflow-hidden rounded-[1.15rem] border border-border bg-surface" key={index}>
            <div className="aspect-[5/4] animate-pulse bg-elevated" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-elevated" />
              <div className="h-5 w-full animate-pulse rounded bg-elevated" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-elevated" />
              <div className="h-px w-full bg-border" />
              <div className="h-7 w-1/2 animate-pulse rounded bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
