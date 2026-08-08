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

  return (
    <article
      className={`group relative flex overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-lg ${
        isList ? "flex-col sm:flex-row" : "h-full flex-col"
      }`}
    >
      <Link
        aria-label={`${t("storefront", "details")}: ${product.name}`}
        className={`focus-ring relative block shrink-0 overflow-hidden bg-elevated/65 ${
          isList ? "aspect-[16/10] sm:min-h-64 sm:w-72 sm:aspect-auto" : "aspect-[1.08/1]"
        }`}
        href={productHref}
      >
        <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
          <StockBadge available={available} dropship={product.stockQty <= 0 && product.dropshipEnabled} label={stockLabel} />
          {product.featured ? (
            <span className="rounded-md border border-primary/20 bg-surface/95 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary shadow-sm">
              {t("storefront", "featured")}
            </span>
          ) : null}
        </div>
        <Image
          alt={product.name}
          className="object-contain p-7 transition duration-300 group-hover:scale-[1.025]"
          fill
          sizes={isList ? "(min-width: 640px) 288px, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
          src={product.image}
        />
      </Link>

      <button
        aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${product.name}`}
        className={`focus-ring absolute end-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-lg border shadow-sm transition ${
          isSaved
            ? "border-danger bg-danger text-primary-contrast"
            : "border-border bg-surface/95 text-muted hover:border-primary hover:text-primary"
        }`}
        onClick={() => toggleWishlist(product.id)}
        type="button"
      >
        <HeartIcon filled={isSaved} />
      </button>

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? "p-6" : "p-4 sm:p-5"}`}>
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
          <span className="truncate uppercase tracking-[0.08em] text-primary">{product.brand}</span>
          <span className="shrink-0 text-muted">
            {product.rating > 0 ? `★ ${product.rating.toFixed(1)}` : `✓ ${t("storefront", "verifiedCatalogue")}`}
          </span>
        </div>

        <Link
          className={`focus-ring mt-2 rounded-md font-bold leading-6 text-foreground transition hover:text-primary ${
            isList ? "text-lg sm:text-xl" : "line-clamp-2 min-h-12 text-[15px]"
          }`}
          href={productHref}
        >
          {product.name}
        </Link>

        <p className={`mt-2 text-sm leading-5 text-muted ${isList ? "line-clamp-3 max-w-3xl" : "line-clamp-2"}`}>
          {product.description}
        </p>

        {product.specs.length > 0 ? (
          <dl className={`mt-4 grid gap-1.5 ${isList ? "sm:grid-cols-2" : ""}`}>
            {product.specs.slice(0, isList ? 4 : 3).map((spec) => (
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 pb-1.5 text-[11px] last:border-b-0" key={`${spec.label}-${spec.value}`}>
                <dt className="truncate text-muted">{spec.label}</dt>
                <dd className="truncate font-semibold text-foreground">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {t("storefront", "vatIncludedShort")}
              </p>
              <p className="mt-0.5 truncate text-xl font-black tracking-tight text-foreground">
                {formatPrice(product.priceEgp, currency, locale)}
              </p>
            </div>

            <button
              className="button-primary shrink-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-muted disabled:shadow-none"
              disabled={!available}
              onClick={() => addToCart(product)}
              type="button"
            >
              <CartPlusIcon />
              <span className="hidden sm:inline">
                {available ? t("storefront", "addToCart") : t("storefront", "unavailable")}
              </span>
            </button>
          </div>

          {isList ? (
            <Link className="focus-ring mt-3 inline-flex rounded-md text-sm font-bold text-primary hover:brightness-110" href={productHref}>
              {t("storefront", "details")}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StockBadge({
  available,
  dropship,
  label,
}: {
  available: boolean;
  dropship: boolean;
  label: string;
}) {
  const style = available
    ? dropship
      ? "border-warning/30 bg-surface/95 text-warning"
      : "border-success/30 bg-surface/95 text-success"
    : "border-danger/30 bg-surface/95 text-danger";

  return (
    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold shadow-sm ${style}`}>
      {label}
    </span>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="17" viewBox="0 0 24 24" width="17"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CartPlusIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7M12 9v5m-2.5-2.5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
