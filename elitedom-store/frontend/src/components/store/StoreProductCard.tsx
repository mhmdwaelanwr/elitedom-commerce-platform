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
};

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

  const stockClass = product.stockQty > 0
    ? "status-success"
    : product.dropshipEnabled
      ? "status-warning"
      : "status-danger";

  return (
    <article
      className={`commerce-card commerce-card-hover group relative flex min-w-0 overflow-hidden ${
        isList ? "flex-col sm:flex-row" : "h-full flex-col"
      }`}
    >
      <div className={`relative shrink-0 bg-background ${isList ? "aspect-[16/10] sm:w-64 sm:aspect-auto" : "aspect-[4/3]"}`}>
        <Link
          aria-label={`${t("storefront", "details")}: ${product.name}`}
          className="focus-ring absolute inset-0 block"
          href={productHref}
        >
          <Image
            alt={product.name}
            className="object-contain p-5 transition duration-300 group-hover:scale-[1.025] sm:p-6"
            fill
            sizes={isList ? "(min-width: 640px) 256px, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
            src={product.image}
          />
        </Link>

        <span className={`absolute start-3 top-3 z-10 rounded-md border px-2 py-1 text-[10px] font-black ${stockClass}`}>
          {stockLabel}
        </span>

        <button
          aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${product.name}`}
          className={`focus-ring absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg border shadow-sm transition ${
            isSaved
              ? "border-danger bg-danger text-primary-contrast"
              : "border-border bg-surface text-muted hover:border-primary hover:text-primary"
          }`}
          onClick={() => toggleWishlist(product.id)}
          type="button"
        >
          <HeartIcon filled={isSaved} />
        </button>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11px] font-black uppercase tracking-wide text-primary">{product.brand}</span>
          <span className="shrink-0 text-xs font-bold text-muted">
            {product.rating > 0 ? `★ ${product.rating.toFixed(1)}` : `✓ ${t("storefront", "verifiedCatalogue")}`}
          </span>
        </div>

        <Link
          className={`focus-ring mt-2 rounded-md font-black leading-6 tracking-[-0.01em] text-foreground transition hover:text-primary ${
            isList ? "text-lg sm:text-xl" : "line-clamp-2 min-h-12 text-[0.95rem]"
          }`}
          href={productHref}
        >
          {product.name}
        </Link>

        {isList ? (
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">{product.description}</p>
        ) : null}

        <div className="mt-3 flex min-h-12 flex-wrap content-start gap-1.5">
          {product.specs.slice(0, isList ? 5 : 3).map((spec) => (
            <span
              className="rounded-md border border-border bg-elevated px-2 py-1 text-[10px] font-semibold text-muted"
              key={`${spec.label}-${spec.value}`}
            >
              {spec.value}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <div className="border-t border-border pt-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted">{t("storefront", "vatIncludedShort")}</p>
                <p className="mt-0.5 truncate text-xl font-black tracking-[-0.025em] text-foreground">
                  {formatPrice(product.priceEgp, currency, locale)}
                </p>
              </div>
              <button
                className="button-primary min-h-10 shrink-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-muted disabled:shadow-none"
                disabled={!available}
                onClick={() => addToCart(product)}
                type="button"
              >
                <CartPlusIcon />
                <span className={isList ? "" : "hidden sm:inline"}>
                  {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
                </span>
              </button>
            </div>
            {isList ? (
              <Link className="focus-ring mt-3 inline-flex rounded-md text-xs font-black text-primary hover:underline" href={productHref}>
                {t("storefront", "details")}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="17" viewBox="0 0 24 24" width="17">
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CartPlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M13 10h4M15 8v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="10" cy="20" fill="currentColor" r="1.2" />
      <circle cx="18" cy="20" fill="currentColor" r="1.2" />
    </svg>
  );
}
