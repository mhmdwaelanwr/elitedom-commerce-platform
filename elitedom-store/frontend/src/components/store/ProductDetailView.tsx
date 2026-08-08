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
  const maximum = product.dropshipEnabled ? 100 : Math.max(1, product.stockQty);
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
    notify(isSaved ? t("storefront", "removedFromWishlist") : t("storefront", "savedToWishlist"), "info");
  }

  return (
    <>
      <div className="site-container pb-24 pt-6 sm:pb-12 sm:pt-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted sm:text-sm">
          <Link className="focus-ring rounded-md hover:text-foreground" href="/">{t("storefront", "home")}</Link>
          <Chevron />
          <Link className="focus-ring rounded-md hover:text-foreground" href={`/shop?category=${product.category}`}>{product.categoryName}</Link>
          <Chevron />
          <span className="min-w-0 max-w-[32rem] truncate text-foreground">{product.name}</span>
        </nav>

        <section className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(23rem,0.75fr)] xl:gap-9">
          <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
              {product.gallery.length > 1 ? (
                <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
                  {product.gallery.map((image, index) => (
                    <button
                      aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                      aria-pressed={index === activeImage}
                      className={`focus-ring relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-surface transition sm:h-20 sm:w-20 ${index === activeImage ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/50"}`}
                      key={`${image}-${index}`}
                      onClick={() => setActiveImage(index)}
                      type="button"
                    >
                      <Image alt="" className="object-contain p-1.5" fill sizes="80px" src={image} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="order-1 relative aspect-square overflow-hidden rounded-2xl border border-border bg-elevated/65 sm:order-2">
                <Image
                  alt={product.name}
                  className="object-contain p-7 sm:p-12"
                  fill
                  priority
                  sizes="(min-width: 1280px) 58vw, 100vw"
                  src={selectedImage}
                />
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4 sm:px-6">
                <p className="section-kicker">{t("storefront", "technicalDetails")}</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  {product.name}
                </h2>
              </div>

              {product.specs.length > 0 ? (
                <dl className="divide-y divide-border">
                  {product.specs.map((spec) => (
                    <div className="grid grid-cols-[minmax(7rem,0.45fr)_minmax(0,1fr)] gap-5 px-5 py-3.5 text-sm sm:px-6" key={`${spec.label}-${spec.value}`}>
                      <dt className="font-medium text-muted">{spec.label}</dt>
                      <dd className="font-semibold text-foreground">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="px-6 py-5 text-sm leading-6 text-muted">{product.description}</p>
              )}
            </div>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-40 xl:h-fit">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="rounded-md bg-elevated px-2.5 py-1 text-primary">{product.brand}</span>
                <span className="rounded-md bg-elevated px-2.5 py-1 text-warning">
                  ★ {product.rating.toFixed(1)} {t("storefront", "customerRating")}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black leading-tight tracking-[-0.025em] text-foreground sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted">{product.description}</p>

              <div className="mt-5 border-y border-border py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{t("storefront", "priceVatIncluded")}</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${product.stockQty > 0 ? "bg-success" : product.dropshipEnabled ? "bg-warning" : "bg-danger"}`} />
                  <span className={product.stockQty > 0 ? "text-success" : product.dropshipEnabled ? "text-warning" : "text-danger"}>{stockLabel}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <QuantityControl
                  available={available}
                  maximum={maximum}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  decreaseLabel={t("storefront", "decreaseQuantity")}
                  increaseLabel={t("storefront", "increaseQuantity")}
                />
                <button
                  aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
                  className={`focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-lg border transition ${isSaved ? "border-danger bg-danger text-primary-contrast" : "border-border bg-surface text-muted hover:border-primary hover:text-primary"}`}
                  onClick={handleWishlist}
                  type="button"
                >
                  <HeartIcon filled={isSaved} />
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-45" disabled={!available} onClick={() => addToCart(product, quantity)} type="button">
                  <CartIcon />
                  {available ? t("storefront", "addToCart") : t("storefront", "currentlyUnavailable")}
                </button>
                <button className="button-secondary w-full disabled:cursor-not-allowed disabled:opacity-45" disabled={!available} onClick={handleBuyNow} type="button">
                  {t("storefront", "buyNow")}
                </button>
              </div>

              <dl className="mt-5 grid divide-y divide-border border-t border-border text-sm">
                <DetailRow label={t("storefront", "sku")} value={product.sku} />
                <DetailRow label={t("storefront", "warrantyMonths")} value={`${product.warrantyMonths} ${t("storefront", "months")}`} />
                <DetailRow label={t("storefront", "fulfillment")} value={product.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")} />
              </dl>
            </div>

            <div className="mt-3 rounded-xl border border-border bg-elevated/55 p-5">
              <p className="font-black text-foreground">{t("storefront", "needHelpDeciding")}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{t("storefront", "needHelpText")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="button-secondary" href="/b2b">{t("storefront", "talkB2b")}</Link>
                <Link className="focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-primary" href="/warranty">{t("storefront", "warranty")}</Link>
              </div>
            </div>
          </aside>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="mt-14 border-t border-border pt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="section-kicker">{t("storefront", "completeSetup")}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">{t("storefront", "youMightLike")}</h2>
              </div>
              <Link className="focus-ring rounded-md text-sm font-bold text-primary hover:brightness-110" href={`/shop?category=${product.category}`}>
                {t("storefront", "seeMore")}
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((item) => <StoreProductCard key={item.id} product={item} />)}
            </div>
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 shadow-2xl sm:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{product.name}</p>
            <p className="truncate text-base font-black text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
          </div>
          <button className="button-primary shrink-0 disabled:opacity-45" disabled={!available} onClick={() => addToCart(product, quantity)} type="button">
            <CartIcon />
            {t("storefront", "addToCart")}
          </button>
        </div>
      </div>
    </>
  );
}

function QuantityControl({
  available,
  maximum,
  quantity,
  setQuantity,
  decreaseLabel,
  increaseLabel,
}: {
  available: boolean;
  maximum: number;
  quantity: number;
  setQuantity: (value: number | ((current: number) => number)) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="inline-flex h-11 items-center rounded-lg border border-border bg-surface">
      <button aria-label={decreaseLabel} className="focus-ring grid h-full w-10 place-items-center rounded-s-lg text-lg text-muted hover:bg-elevated hover:text-foreground" onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button">−</button>
      <span className="w-9 text-center text-sm font-black text-foreground">{quantity}</span>
      <button aria-label={increaseLabel} className="focus-ring grid h-full w-10 place-items-center rounded-e-lg text-lg text-muted hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35" disabled={!available || quantity >= maximum} onClick={() => setQuantity((current) => Math.min(maximum, current + 1))} type="button">+</button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Chevron() {
  return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="18" viewBox="0 0 24 24" width="18"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
