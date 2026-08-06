"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

export function ProductDetailView({
  product,
  relatedProducts,
}: {
  product: Product;
  relatedProducts: Product[];
}) {
  const router = useRouter();
  const { locale, t } = usePreferences();
  const { addToCart, currency, notify, setCartOpen, toggleWishlist, wishlist } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const available = product.stockQty > 0 || product.dropshipEnabled;
  const maximum = product.dropshipEnabled ? 100 : product.stockQty;
  const selectedImage = product.gallery[activeImage] ?? product.image;
  const isSaved = wishlist.includes(product.id);
  const stockLabel = product.stockQty > 0
    ? `${product.stockQty} ${t("storefront", "readyToShip")}`
    : product.dropshipEnabled
      ? t("storefront", "supplierDeliveryAvailable")
      : t("storefront", "currentlyUnavailable");

  function handleBuyNow() {
    if (!available) return;
    addToCart(product, quantity);
    setCartOpen(false);
    router.push("/checkout");
  }

  function handleWishlist() {
    toggleWishlist(product.id);
    notify(
      isSaved
        ? t("storefront", "removedFromWishlist")
        : t("storefront", "savedToWishlist"),
      "info",
    );
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">
          {t("storefront", "home")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="focus-ring rounded-md hover:text-foreground" href={`/shop?category=${product.category}`}>
          {product.categoryName}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="max-w-full truncate text-foreground">{product.name}</span>
      </nav>

      <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.9fr)] lg:gap-12">
        <div>
          <div className="group relative aspect-square overflow-hidden rounded-3xl border border-border bg-elevated">
            <Image
              alt={product.name}
              className="object-contain p-8 transition duration-500 group-hover:scale-105 sm:p-12"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src={selectedImage}
            />
          </div>
          {product.gallery.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {product.gallery.map((image, index) => (
                <button
                  aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                  aria-pressed={index === activeImage}
                  className={`focus-ring relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-surface p-1 transition ${index === activeImage ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary"}`}
                  key={`${image}-${index}`}
                  onClick={() => setActiveImage(index)}
                  type="button"
                >
                  <Image alt="" className="object-contain p-1" fill sizes="80px" src={image} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{product.brand}</span>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
              ★ {product.rating.toFixed(1)} {t("storefront", "customerRating")}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-base leading-7 text-muted">{product.description}</p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("storefront", "priceVatIncluded")}
              </p>
              <p className="mt-1 text-3xl font-black text-foreground">
                {formatPrice(product.priceEgp, currency, locale)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${product.stockQty > 0 ? "bg-success/10 text-success" : product.dropshipEnabled ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>
              {stockLabel}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex items-center rounded-xl border border-border bg-surface">
              <button
                aria-label={t("storefront", "decreaseQuantity")}
                className="focus-ring grid h-12 w-12 place-items-center rounded-s-xl text-lg text-muted hover:bg-elevated hover:text-foreground"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                type="button"
              >
                −
              </button>
              <span className="w-10 text-center font-bold text-foreground">{quantity}</span>
              <button
                aria-label={t("storefront", "increaseQuantity")}
                className="focus-ring grid h-12 w-12 place-items-center rounded-e-xl text-lg text-muted hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!available || quantity >= maximum}
                onClick={() => setQuantity((current) => Math.min(maximum, current + 1))}
                type="button"
              >
                +
              </button>
            </div>
            <button
              className="button-primary min-w-40 flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!available}
              onClick={() => addToCart(product, quantity)}
              type="button"
            >
              {available ? t("storefront", "addToCart") : t("storefront", "currentlyUnavailable")}
            </button>
            <button
              className="button-secondary min-w-32 flex-1 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              disabled={!available}
              onClick={handleBuyNow}
              type="button"
            >
              {t("storefront", "buyNow")}
            </button>
            <button
              aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
              className={`focus-ring grid h-12 w-12 place-items-center rounded-xl border transition ${isSaved ? "border-danger bg-danger text-primary-contrast" : "border-border bg-surface text-muted hover:border-primary hover:text-primary"}`}
              onClick={handleWishlist}
              type="button"
            >
              <HeartIcon filled={isSaved} />
            </button>
          </div>

          <dl className="mt-7 grid gap-3 rounded-2xl border border-border bg-surface p-5 text-sm">
            <DetailRow label={t("storefront", "sku")} value={product.sku} />
            <DetailRow
              label={t("storefront", "warrantyMonths")}
              value={`${product.warrantyMonths} ${t("storefront", "months")}`}
            />
            <DetailRow
              label={t("storefront", "fulfillment")}
              value={product.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")}
            />
          </dl>
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-2xl font-black text-foreground">{t("storefront", "technicalDetails")}</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
            {product.specs.length > 0 ? (
              <dl className="divide-y divide-border">
                {product.specs.map((spec) => (
                  <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm" key={`${spec.label}-${spec.value}`}>
                    <dt className="font-medium text-muted">{spec.label}</dt>
                    <dd className="font-semibold text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="p-6 text-sm text-muted">{product.description}</p>
            )}
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <h2 className="font-bold text-foreground">{t("storefront", "needHelpDeciding")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("storefront", "needHelpText")}</p>
          <Link className="button-secondary mt-5 w-full" href="/b2b">
            {t("storefront", "talkB2b")}
          </Link>
          <Link className="focus-ring mt-4 block rounded-md text-center text-sm font-bold text-primary hover:brightness-110" href="/warranty">
            {t("storefront", "warranty")}
          </Link>
        </aside>
      </section>

      {relatedProducts.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{t("storefront", "completeSetup")}</p>
              <h2 className="mt-2 text-2xl font-black text-foreground">{t("storefront", "youMightLike")}</h2>
            </div>
            <Link className="focus-ring rounded-md text-sm font-bold text-primary hover:brightness-110" href={`/shop?category=${product.category}`}>
              {t("storefront", "seeMore")}
            </Link>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((item) => <StoreProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="19" viewBox="0 0 24 24" width="19">
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
