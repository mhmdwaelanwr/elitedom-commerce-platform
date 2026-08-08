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
  const visibleSpecs = product.specs.slice(0, isHome ? 1 : isList ? 4 : 3);
  const stockLabel = product.stockQty > 0
    ? t("storefront", "inStock")
    : product.dropshipEnabled
      ? t("storefront", "dropshipAvailable")
      : t("storefront", "outOfStock");

  if (isList) {
    return (
      <article className="grid min-w-0 gap-6 rounded-2xl bg-elevated p-6 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
          <Link aria-label={`${t("storefront", "details")}: ${product.name}`} className="focus-ring absolute inset-0 rounded-xl" href={productHref}>
            <Image alt={product.name} className="object-contain p-6 transition-transform duration-200 hover:scale-[1.02]" fill sizes="224px" src={product.image} />
          </Link>
          <WishlistButton isSaved={isSaved} label={product.name} onClick={() => toggleWishlist(product.id)} />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-bold text-primary">{product.brand}</span>
            <span className={`font-medium ${available ? "text-success" : "text-danger"}`}>{stockLabel}</span>
          </div>
          <Link className="focus-ring mt-2 rounded-lg text-xl font-bold leading-7 text-foreground transition hover:text-primary" href={productHref}>{product.name}</Link>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{product.description}</p>

          {visibleSpecs.length > 0 ? (
            <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
              {visibleSpecs.map((spec) => (
                <div className="min-w-0" key={`${spec.label}-${spec.value}`}>
                  <dt className="truncate text-xs text-muted">{spec.label}</dt>
                  <dd className="truncate text-sm font-medium text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
            <div>
              <p className="text-xs text-muted">{t("storefront", "vatIncludedShort")}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
            </div>
            <button className="button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!available} onClick={() => addToCart(product)} type="button">
              {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl bg-elevated p-6">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <div>
          {product.featured ? (
            <span className="inline-flex rounded-full bg-[var(--ds-primary-soft)] px-2.5 py-1 text-[11px] font-bold text-primary">
              {t("storefront", "featured")}
            </span>
          ) : product.stockQty > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {stockLabel}
            </span>
          ) : null}
        </div>
        <WishlistButton isSaved={isSaved} label={product.name} onClick={() => toggleWishlist(product.id)} inline />
      </div>

      <Link aria-label={`${t("storefront", "details")}: ${product.name}`} className="focus-ring relative my-5 block aspect-square overflow-hidden rounded-xl bg-surface" href={productHref}>
        <Image
          alt={product.name}
          className="object-contain p-7 transition-transform duration-200 hover:scale-[1.025]"
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          src={product.image}
        />
      </Link>

      <div className="flex flex-1 flex-col">
        <p className="text-xs font-medium text-muted">{product.brand}</p>
        <Link className="focus-ring mt-1 line-clamp-2 rounded-lg text-base font-bold leading-6 text-foreground transition hover:text-primary" href={productHref}>{product.name}</Link>

        {visibleSpecs.length > 0 ? (
          isHome ? (
            <p className="mt-2 line-clamp-1 text-sm text-muted">{visibleSpecs[0].value}</p>
          ) : (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
              {visibleSpecs.map((spec) => spec.value).join(" · ")}
            </p>
          )
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("storefront", "vatIncludedShort")}</p>
            <p className="mt-1 truncate text-lg font-bold text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
          </div>
          <button
            className="focus-ring shrink-0 rounded-full px-1 py-2 text-sm font-bold text-primary transition hover:text-[var(--ds-primary-hover)] disabled:cursor-not-allowed disabled:text-muted"
            disabled={!available}
            onClick={() => addToCart(product)}
            type="button"
          >
            {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
          </button>
        </div>
      </div>
    </article>
  );
}

function WishlistButton({ isSaved, label, onClick, inline = false }: { isSaved: boolean; label: string; onClick: () => void; inline?: boolean }) {
  const { t } = usePreferences();
  return (
    <button
      aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${label}`}
      className={`focus-ring grid h-9 w-9 place-items-center rounded-full transition ${inline ? "" : "absolute end-3 top-3"} ${isSaved ? "bg-primary text-primary-contrast" : "bg-surface text-muted hover:text-primary"}`}
      onClick={onClick}
      type="button"
    >
      <HeartIcon filled={isSaved} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="18" viewBox="0 0 24 24" width="18"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}