"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

type StoreProductCardProps = {
  product: Product;
  variant?: "grid" | "list";
  context?: "home" | "catalog";
};

export function StoreProductCard({ product, variant = "grid", context = "catalog" }: StoreProductCardProps) {
  const { addToCart, currency, toggleWishlist, wishlist } = useStore();
  const { locale, t } = usePreferences();
  const available = product.stockQty > 0 || product.dropshipEnabled;
  const isSaved = wishlist.includes(product.id);
  const isList = variant === "list";
  const isHome = context === "home" && !isList;
  const productHref = `/products/${encodeURIComponent(product.slug ?? product.id)}`;
  const visibleSpecs = product.specs.slice(0, isHome ? 1 : isList ? 5 : 4);
  const stockLabel = product.stockQty > 0
    ? t("storefront", "inStock")
    : product.dropshipEnabled
      ? t("storefront", "dropshipAvailable")
      : t("storefront", "outOfStock");

  if (isList) {
    return (
      <article className="group grid min-w-0 gap-5 rounded-[1.75rem] bg-surface p-3 transition hover:shadow-[0_8px_28px_-18px_var(--ds-shadow)] sm:grid-cols-[15rem_minmax(0,1fr)] sm:p-4">
        <ProductVisual product={product} productHref={productHref} isSaved={isSaved} onWishlist={() => toggleWishlist(product.id)} />
        <div className="flex min-w-0 flex-col py-2 pe-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-bold text-primary">{product.brand}</span>
            <span className="text-muted">{product.sku}</span>
            <span className={`font-bold ${available ? "text-success" : "text-danger"}`}>• {stockLabel}</span>
          </div>
          <Link className="focus-ring mt-2 rounded-lg text-xl font-bold leading-7 tracking-[-0.02em] text-foreground transition hover:text-primary" href={productHref}>
            {product.name}
          </Link>
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">{product.description}</p>
          {visibleSpecs.length > 0 ? (
            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSpecs.map((spec) => (
                <div className="min-w-0" key={`${spec.label}-${spec.value}`}>
                  <dt className="truncate text-[11px] text-muted">{spec.label}</dt>
                  <dd className="truncate text-sm font-bold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
            <div>
              <p className="text-xs text-muted">{t("storefront", "vatIncludedShort")}</p>
              <p className="mt-0.5 text-2xl font-bold tracking-[-0.035em] text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
            </div>
            <button className="button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!available} onClick={() => addToCart(product)} type="button">
              <CartPlusIcon />
              {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex min-w-0 flex-col">
      <ProductVisual product={product} productHref={productHref} isSaved={isSaved} onWishlist={() => toggleWishlist(product.id)} />

      <div className="flex min-w-0 flex-1 flex-col px-1 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-xs font-bold text-primary">{product.brand}</span>
          {!isHome ? (
            <span className={`shrink-0 text-[11px] font-bold ${available ? "text-success" : "text-danger"}`}>
              {stockLabel}
            </span>
          ) : product.rating > 0 ? (
            <span className="shrink-0 text-xs font-bold text-muted">★ {product.rating.toFixed(1)}</span>
          ) : null}
        </div>

        <Link className="focus-ring mt-1.5 line-clamp-2 rounded-lg text-[0.98rem] font-bold leading-6 tracking-[-0.015em] text-foreground transition hover:text-primary" href={productHref}>
          {product.name}
        </Link>

        {visibleSpecs.length > 0 ? (
          isHome ? (
            <p className="mt-1.5 line-clamp-1 text-xs text-muted">{visibleSpecs[0].value}</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-elevated p-3.5">
              {visibleSpecs.map((spec) => (
                <div className="min-w-0" key={`${spec.label}-${spec.value}`}>
                  <dt className="truncate text-[10px] text-muted">{spec.label}</dt>
                  <dd className="mt-0.5 truncate text-xs font-bold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            {!isHome ? <p className="text-[10px] text-muted">{t("storefront", "vatIncludedShort")}</p> : null}
            <p className={`${isHome ? "text-lg" : "text-xl"} truncate font-bold tracking-[-0.03em] text-foreground`}>
              {formatPrice(product.priceEgp, currency, locale)}
            </p>
          </div>
          <button
            aria-label={`${t("storefront", "addToCart")}: ${product.name}`}
            className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast transition hover:shadow-[0_4px_12px_-4px_var(--ds-shadow)] disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted"
            disabled={!available}
            onClick={() => addToCart(product)}
            type="button"
          >
            <CartPlusIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductVisual({
  product,
  productHref,
  isSaved,
  onWishlist,
}: {
  product: Product;
  productHref: string;
  isSaved: boolean;
  onWishlist: () => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="product-canvas relative aspect-[4/3] overflow-hidden rounded-[1.75rem] sm:aspect-square">
      <Link aria-label={`${t("storefront", "details")}: ${product.name}`} className="focus-ring absolute inset-0 block rounded-[1.75rem]" href={productHref}>
        <Image
          alt={product.name}
          className="object-contain p-7 transition duration-300 ease-out group-hover:scale-[1.035] sm:p-8"
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          src={product.image}
        />
      </Link>
      {product.featured ? (
        <span className="absolute start-3 top-3 rounded-full bg-surface px-3 py-1.5 text-[10px] font-bold text-primary shadow-sm">
          {t("storefront", "featured")}
        </span>
      ) : null}
      <button
        aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${product.name}`}
        className={`focus-ring absolute end-3 top-3 grid h-10 w-10 place-items-center rounded-full transition ${
          isSaved ? "bg-primary text-primary-contrast" : "bg-surface text-muted shadow-sm hover:text-primary"
        }`}
        onClick={onWishlist}
        type="button"
      >
        <HeartIcon filled={isSaved} />
      </button>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="18" viewBox="0 0 24 24" width="18"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CartPlusIcon() {
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><path d="M13 10h4M15 8v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}