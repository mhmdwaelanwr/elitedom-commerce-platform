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
  const maximum = Math.max(1, product.dropshipEnabled ? 100 : product.stockQty);
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
    <div className="pb-16 sm:pb-20">
      <div className="site-container py-5 sm:py-7">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted sm:text-sm">
          <Link className="focus-ring shrink-0 rounded-md hover:text-foreground" href="/">
            {t("storefront", "home")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            className="focus-ring shrink-0 rounded-md hover:text-foreground"
            href={`/shop?category=${product.category}`}
          >
            {product.categoryName}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>
      </div>

      <section className="border-y border-border bg-surface">
        <div className="site-container grid gap-8 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,.85fr)] lg:gap-12 lg:py-12">
          <div className="min-w-0">
            <div className="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)]">
              {product.gallery.length > 1 ? (
                <div className="order-2 flex gap-2 overflow-x-auto pb-1 md:order-1 md:flex-col md:overflow-visible">
                  {product.gallery.map((image, index) => (
                    <button
                      aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                      aria-pressed={index === activeImage}
                      className={`focus-ring relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-background transition ${
                        index === activeImage
                          ? "border-primary shadow-sm ring-2 ring-primary/15"
                          : "border-border hover:border-primary"
                      }`}
                      key={`${image}-${index}`}
                      onClick={() => setActiveImage(index)}
                      type="button"
                    >
                      <Image alt="" className="object-contain p-2" fill sizes="80px" src={image} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="order-1 md:order-2">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-background">
                  <div className="absolute start-4 top-4 z-10 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-surface/95 px-3 py-1.5 text-[11px] font-bold text-foreground shadow-sm">
                      {product.brand}
                    </span>
                    {product.featured ? (
                      <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-contrast shadow-sm">
                        {t("storefront", "featured")}
                      </span>
                    ) : null}
                  </div>
                  <Image
                    alt={product.name}
                    className="object-contain p-7 sm:p-12"
                    fill
                    priority
                    sizes="(min-width: 1024px) 56vw, 100vw"
                    src={selectedImage}
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-[9rem] lg:self-start">
            <div className="border-b border-border pb-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold">
                <span className="text-primary">{product.brand}</span>
                <span className="text-muted">{product.sku}</span>
                {product.rating > 0 ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <span aria-hidden="true">★</span>
                    {product.rating.toFixed(1)} {t("storefront", "customerRating")}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl xl:text-4xl">
                {product.name}
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted sm:text-base sm:leading-7">
                {product.description}
              </p>

              {product.specs.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {product.specs.slice(0, 4).map((specification) => (
                    <span
                      className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-foreground"
                      key={`${specification.label}-${specification.value}`}
                    >
                      <span className="text-muted">{specification.label}:</span> {specification.value}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="py-5">
              <p className="text-xs font-semibold text-muted">{t("storefront", "priceVatIncluded")}</p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                <p className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  {formatPrice(product.priceEgp, currency, locale)}
                </p>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    product.stockQty > 0
                      ? "bg-success/10 text-success"
                      : product.dropshipEnabled
                        ? "bg-warning/10 text-warning"
                        : "bg-danger/10 text-danger"
                  }`}
                >
                  {stockLabel}
                </span>
              </div>
            </div>

            <div className="grid gap-3 border-y border-border py-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <PurchaseFact
                label={t("storefront", "fulfillment")}
                value={product.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")}
              />
              <PurchaseFact
                label={t("storefront", "warrantyMonths")}
                value={`${product.warrantyMonths} ${t("storefront", "months")}`}
              />
              <PurchaseFact label={t("storefront", "securePayments")} value={t("storefront", "securePaymentsDetail")} />
            </div>

            <div className="pt-5">
              <div className="flex gap-3">
                <div className="inline-flex shrink-0 items-center overflow-hidden rounded-xl border border-border bg-background">
                  <button
                    aria-label={t("storefront", "decreaseQuantity")}
                    className="focus-ring grid h-12 w-11 place-items-center text-lg text-muted transition hover:bg-elevated hover:text-foreground"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    −
                  </button>
                  <span className="w-9 text-center text-sm font-black text-foreground">{quantity}</span>
                  <button
                    aria-label={t("storefront", "increaseQuantity")}
                    className="focus-ring grid h-12 w-11 place-items-center text-lg text-muted transition hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!available || quantity >= maximum}
                    onClick={() => setQuantity((current) => Math.min(maximum, current + 1))}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <button
                  className="button-primary min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!available}
                  onClick={() => addToCart(product, quantity)}
                  type="button"
                >
                  {available ? t("storefront", "addToCart") : t("storefront", "currentlyUnavailable")}
                </button>
                <button
                  aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
                  className={`focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition ${
                    isSaved
                      ? "border-danger bg-danger text-primary-contrast"
                      : "border-border bg-background text-muted hover:border-primary hover:text-primary"
                  }`}
                  onClick={handleWishlist}
                  type="button"
                >
                  <HeartIcon filled={isSaved} />
                </button>
              </div>

              <button
                className="button-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!available}
                onClick={handleBuyNow}
                type="button"
              >
                {t("storefront", "buyNow")}
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="site-container py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="border-b border-border pb-5">
              <p className="section-kicker">{product.categoryName}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {t("storefront", "technicalDetails")}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                {product.longDescription ?? product.description}
              </p>
            </div>

            <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="grid grid-cols-[minmax(8rem,.65fr)_minmax(0,1fr)] border-b border-border bg-elevated px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted sm:grid-cols-2">
                <span>{t("storefront", "technicalDetails")}</span>
                <span>{product.name}</span>
              </div>
              {product.specs.length > 0 ? (
                <dl className="divide-y divide-border">
                  {product.specs.map((specification) => (
                    <div
                      className="grid grid-cols-[minmax(8rem,.65fr)_minmax(0,1fr)] gap-4 px-5 py-4 text-sm sm:grid-cols-2"
                      key={`${specification.label}-${specification.value}`}
                    >
                      <dt className="font-medium text-muted">{specification.label}</dt>
                      <dd className="font-semibold text-foreground">{specification.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="p-6 text-sm leading-6 text-muted">{product.description}</p>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-[9rem]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <SupportIcon />
            </span>
            <h2 className="mt-5 text-lg font-black text-foreground">{t("storefront", "needHelpDeciding")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{t("storefront", "needHelpText")}</p>
            <Link className="button-primary mt-5 w-full" href="/b2b">
              {t("storefront", "talkB2b")}
            </Link>
            <Link className="button-secondary mt-2 w-full" href="/warranty">
              {t("storefront", "warranty")}
            </Link>
          </aside>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="border-y border-border bg-elevated py-12 sm:py-16">
          <div className="site-container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-kicker">{t("storefront", "completeSetup")}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {t("storefront", "youMightLike")}
                </h2>
              </div>
              <Link
                className="focus-ring rounded-lg text-sm font-bold text-primary hover:underline"
                href={`/shop?category=${product.category}`}
              >
                {t("storefront", "seeMore")}
              </Link>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((item) => (
                <StoreProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PurchaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-foreground">{value}</p>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="20" viewBox="0 0 24 24" width="20">
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H2.5v5H7v-5H4Zm16 0h1.5v5H17v-5h3ZM17 18c-.3 2-2.1 3-5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
