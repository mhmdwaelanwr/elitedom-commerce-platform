"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { fetchCatalog } from "@/lib/api";
import type { Product } from "@/types/store";

export function HomeCatalogSections() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchCatalog()
      .then((result) => {
        if (active) setProducts(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Catalogue unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <section className="site-container py-16"><div className="h-80 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" /></section>;
  }
  if (error) {
    return (
      <section className="site-container py-16">
        <div className="rounded-3xl border border-amber-400/25 bg-amber-950/20 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[.18em] text-amber-300">Live catalogue unavailable</p>
          <h2 className="mt-3 text-2xl font-black text-white">We are reconnecting to inventory.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">{error}</p>
          <Link className="button-primary mt-6 inline-flex" href="/shop">Try the catalogue again</Link>
        </div>
      </section>
    );
  }
  if (products.length === 0) {
    return (
      <section className="site-container py-16">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-300">
          No published products yet. Publish products from Odoo or the staff catalogue.
        </div>
      </section>
    );
  }

  const arrivals = products.slice(0, 4);
  const available = products
    .filter((product) => product.stockQty > 0 || product.dropshipEnabled)
    .slice(0, 4);

  return (
    <>
      <ProductSection
        eyebrow="Just landed"
        title="New arrivals from the live catalogue"
        products={arrivals}
      />
      <ProductSection
        eyebrow="Ready to order"
        title="Available now"
        products={available.length > 0 ? available : arrivals}
        muted
      />
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
  return (
    <section className={muted ? "border-y border-slate-800 bg-slate-900/35 py-16" : "site-container py-16"}>
      <div className={muted ? "site-container" : ""}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{title}</h2>
          </div>
          <Link className="text-sm font-black text-sky-300 hover:text-white" href="/shop">View all products →</Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <StoreProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
