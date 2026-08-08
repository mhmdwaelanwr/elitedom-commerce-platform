"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product, ProductSpec } from "@/types/store";

type ProductCardVariant = "home" | "grid" | "list";

type StoreProductCardProps = {
  product: Product;
  variant?: ProductCardVariant;
};

export function StoreProductCard({ product, variant = "grid" }: StoreProductCardProps) {
  const { addToCart, currency, toggleWishlist, wishlist } = useStore();
  const { locale, t } = usePreferences();
  const available = product.stockQty > 0 || product.dropshipEnabled;
  const isSaved = wishlist.includes(product.id);
  const isList = variant === "list";
  const isHome = variant === "home";
  const productHref = `/products/${encodeURIComponent(product.slug ?? product.id)}`;
  const keySpecs = selectKeySpecs(product.specs, isHome ? 1 : 4);

  const stockLabel = product.stockQty > 0
    ? `${product.stockQty} ${t("storefront", "inStock")}`
    : product.dropshipEnabled
      ? t("storefront", "dropshipAvailable")
      : t("storefront", "outOfStock");

  return (
    <article
      className={`group relative flex min-w-0 overflow-hidden rounded-[1.15rem] border border-border bg-surface transition duration-200 hover:border-[color-mix(in_srgb,var(--ds-text)_24%,var(--ds-border))] hover:shadow-[0_18px_45px_-32px_var(--ds-shadow)] ${
        isList ? "flex-col sm:flex-row" : "h-full flex-col"
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-[var(--ds-product-canvas)] ${
          isList ? "aspect-[16/10] sm:w-72 sm:aspect-auto" : isHome ? "aspect-[5/4]" : "aspect-[4/3]"
        }`}
      >
        <Link
          aria-label={`${t("storefront", "details")}: ${product.name}`}
          className="focus-ring absolute inset-0 block"
          href={productHref}
        >
          <Image
            alt={product.name}
            className={`object-contain transition duration-300 group-hover:scale-[1.018] ${isHome ? "p-7 sm:p-8" : "p-5 sm:p-7"}`}
            fill
            sizes={isList ? "(min-width: 640px) 288px, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
            src={product.image}
          />
        </Link>

        {!isHome ? (
          <span
            className={`absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
              product.stockQty > 0
                ? "border-success/20 bg-[var(--ds-soft-success)] text-success"
                : product.dropshipEnabled
                  ? "border-warning/20 bg-[var(--ds-soft-warning)] text-warning"
                  : "border-danger/20 bg-[var(--ds-soft-danger)] text-danger"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {stockLabel}
          </span>
        ) : null}

        <button
          aria-label={`${isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}: ${product.name}`}
          className={`focus-ring absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border shadow-sm transition ${
            isSaved
              ? "border-danger bg-danger text-primary-contrast"
              : "border-border bg-surface/95 text-muted hover:border-foreground/25 hover:text-foreground"
          }`}
          onClick={() => toggleWishlist(product.id)}
          type="button"
        >
          <HeartIcon filled={isSaved} />
        </button>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${isList ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-muted">{product.brand}</span>
          {!isHome && product.rating > 0 ? (
            <span className="shrink-0 text-[11px] font-bold text-muted">★ {product.rating.toFixed(1)}</span>
          ) : null}
        </div>

        <Link
          className={`focus-ring mt-2 rounded-md font-black tracking-[-0.018em] text-foreground transition hover:text-primary ${
            isList
              ? "text-lg leading-7 sm:text-xl"
              : isHome
                ? "line-clamp-2 min-h-11 text-[0.95rem] leading-[1.4rem]"
                : "line-clamp-2 min-h-12 text-[0.96rem] leading-6"
          }`}
          href={productHref}
        >
          {product.name}
        </Link>

        {isList ? (
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">{product.description}</p>
        ) : null}

        {keySpecs.length > 0 ? (
          <dl className={`${isHome ? "mt-3" : "mt-4"} grid gap-1.5`}>
            {keySpecs.map((spec, index) => (
              <div
                className={`min-w-0 ${
                  isHome
                    ? "text-xs text-muted"
                    : "grid grid-cols-[minmax(4.5rem,.72fr)_minmax(0,1.28fr)] gap-2 text-[11px] leading-4"
                }`}
                key={`${spec.label}-${spec.value}-${index}`}
              >
                {isHome ? (
                  <dd className="truncate font-semibold text-muted">{spec.value}</dd>
                ) : (
                  <>
                    <dt className="truncate text-muted">{spec.label}</dt>
                    <dd className="truncate font-bold text-foreground" title={spec.value}>{spec.value}</dd>
                  </>
                )}
              </div>
            ))}
          </dl>
        ) : isHome ? (
          <p className="mt-3 line-clamp-1 text-xs text-muted">{product.categoryName}</p>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted">{t("storefront", "vatIncludedShort")}</p>
              <p className={`${isHome ? "text-lg" : "text-xl"} mt-0.5 truncate font-black tracking-[-0.03em] text-foreground`}>
                {formatPrice(product.priceEgp, currency, locale)}
              </p>
            </div>

            {!isHome ? (
              <button
                aria-label={`${t("storefront", "addToCart")}: ${product.name}`}
                className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted"
                disabled={!available}
                onClick={() => addToCart(product)}
                type="button"
              >
                <CartPlusIcon />
              </button>
            ) : (
              <Link
                aria-label={`${t("storefront", "details")}: ${product.name}`}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition hover:border-primary hover:text-primary"
                href={productHref}
              >
                <ArrowIcon />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function selectKeySpecs(specs: ProductSpec[], limit: number) {
  const priorities = [
    "processor", "cpu", "chip", "gpu", "graphics", "video", "ram", "memory",
    "storage", "ssd", "capacity", "screen", "display", "resolution", "refresh",
    "socket", "chipset", "watt", "power", "size",
  ];

  return [...specs]
    .map((spec, index) => {
      const haystack = `${spec.code ?? ""} ${spec.label}`.toLowerCase();
      const priority = priorities.findIndex((term) => haystack.includes(term));
      return { spec, index, score: priority === -1 ? 100 + index : priority };
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ spec }) => spec);
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
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M13 10h4M15 8v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="10" cy="20" fill="currentColor" r="1.2" />
      <circle cx="18" cy="20" fill="currentColor" r="1.2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
