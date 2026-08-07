"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

type StoreProductCardProps = { product: Product; variant?: "grid" | "list" };

export function StoreProductCard({ product, variant = "grid" }: StoreProductCardProps) {
  const { addToCart, currency, toggleWishlist, wishlist } = useStore();
  const { locale, t } = usePreferences();
  const available = product.stockQty > 0 || product.dropshipEnabled;
  const isSaved = wishlist.includes(product.id);
  const isList = variant === "list";
  const productHref = `/products/${encodeURIComponent(product.slug ?? product.id)}`;
  const stockLabel = product.stockQty > 0
    ? `${product.stockQty} ${t("storefront", "inStock")}`
    : product.dropshipEnabled
      ? t("storefront", "dropshipAvailable")
      : t("storefront", "outOfStock");

  return (
    <article className={`group relative flex overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-xl ${isList ? "flex-col sm:flex-row" : "h-full flex-col"}`}>
      <div className="absolute start-3 top-3 z-10">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${product.stockQty > 0 ? "bg-success text-primary-contrast" : product.dropshipEnabled ? "bg-warning text-primary-contrast" : "bg-danger text-primary-contrast"}`}>
          {stockLabel}
        </span>
      </div>
      <button
        aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${product.name}`}
        className={`focus-ring absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${isSaved ? "border-danger bg-danger text-primary-contrast" : "border-border bg-surface/90 text-muted hover:border-primary hover:text-primary"}`}
        onClick={() => toggleWishlist(product.id)}
        type="button"
      >
        <HeartIcon filled={isSaved} />
      </button>
      <Link
        aria-label={`${t("storefront", "details")}: ${product.name}`}
        className={`focus-ring relative block shrink-0 overflow-hidden bg-elevated ${isList ? "aspect-[16/10] sm:min-h-64 sm:w-64 sm:aspect-auto" : "aspect-square"}`}
        href={productHref}
      >
        <Image
          alt={product.name}
          className="object-contain p-7 transition duration-500 group-hover:scale-105"
          fill
          sizes={isList ? "(min-width: 640px) 256px, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
          src={product.image}
        />
      </Link>
      <div className={`flex min-w-0 flex-1 flex-col p-5 ${isList ? "sm:p-6" : ""}`}>
        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
          <span className="truncate text-primary">{product.brand}</span>
          <span className="shrink-0 text-success">
            {product.rating > 0 ? `★ ${product.rating.toFixed(1)}` : `✓ ${t("storefront", "verifiedCatalogue")}`}
          </span>
        </div>
        <Link
          className={`focus-ring mt-2 rounded-md font-bold leading-6 text-foreground hover:text-primary ${isList ? "text-lg sm:text-xl" : "line-clamp-2 min-h-12 text-base"}`}
          href={productHref}
        >
          {product.name}
        </Link>
        <p className={`mt-2 text-sm leading-5 text-muted ${isList ? "line-clamp-3 max-w-3xl" : "line-clamp-2"}`}>
          {product.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {product.specs.slice(0, isList ? 4 : 2).map((spec) => (
            <span className="rounded-md bg-elevated px-2 py-1 text-[10px] font-medium text-muted" key={`${spec.label}-${spec.value}`}>
              {spec.label}: {spec.value}
            </span>
          ))}
        </div>
        <div className={`mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4 ${isList ? "sm:mt-5" : ""}`}>
          <div>
            <p className="text-[11px] font-medium text-muted">{t("storefront", "vatIncludedShort")}</p>
            <p className="mt-0.5 text-lg font-black text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isList ? (
              <Link className="focus-ring hidden rounded-md text-sm font-bold text-primary hover:brightness-110 sm:inline" href={productHref}>
                {t("storefront", "details")}
              </Link>
            ) : null}
            <button
              className="button-primary shrink-0 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-muted disabled:shadow-none"
              disabled={!available}
              onClick={() => addToCart(product)}
              type="button"
            >
              {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="18" viewBox="0 0 24 24" width="18"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
