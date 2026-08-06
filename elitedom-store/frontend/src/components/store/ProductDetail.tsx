"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { useStore } from "@/components/store/StoreProvider";
import { fetchCatalog, fetchProduct } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const { locale, t } = usePreferences();
  const { addToCart, currency, notify, setCartOpen, toggleWishlist, wishlist } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setProduct(null);
    setRelatedProducts([]);
    setActiveImage(0);
    setQuantity(1);

    void fetchProduct(productId)
      .then(async (nextProduct) => {
        if (!active) return;
        if (!nextProduct) {
          setError(t("storefront", "productNoLongerAvailable"));
          return;
        }

        setProduct(nextProduct);
        try {
          const catalogue = await fetchCatalog();
          if (active) {
            setRelatedProducts(
              catalogue
                .filter((item) => item.category === nextProduct.category && item.id !== nextProduct.id)
                .slice(0, 3),
            );
          }
        } catch {
          // Related products are optional and must not block the page.
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t("storefront", "productLoadError"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, t]);

  if (isLoading) return <ProductSkeleton />;
  if (error || !product) {
    return <ProductUnavailable message={error ?? t("storefront", "productNoLongerAvailable")} />;
  }

  const currentProduct = product;
  const available = currentProduct.stockQty > 0 || currentProduct.dropshipEnabled;
  const maximum = currentProduct.dropshipEnabled ? 100 : currentProduct.stockQty;
  const selectedImage = currentProduct.gallery[activeImage] ?? currentProduct.image;
  const isSaved = wishlist.includes(currentProduct.id);
  const stockLabel = currentProduct.stockQty > 0
    ? `${currentProduct.stockQty} ${t("storefront", "readyToShip")}`
    : currentProduct.dropshipEnabled
      ? t("storefront", "supplierDeliveryAvailable")
      : t("storefront", "currentlyUnavailable");

  function handleBuyNow() {
    if (!available) return;
    addToCart(currentProduct, quantity);
    setCartOpen(false);
    router.push("/checkout");
  }

  function handleWishlist() {
    toggleWishlist(currentProduct.id);
    notify(
      isSaved ? t("storefront", "removedFromWishlist") : t("storefront", "savedToWishlist"),
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
        <Link className="focus-ring rounded-md hover:text-foreground" href={`/shop?category=${currentProduct.category}`}>
          {currentProduct.categoryName}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="max-w-full truncate text-foreground">{currentProduct.name}</span>
      </nav>

      <section className="mt-7 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-elevated">
            <Image
              alt={currentProduct.name}
              className="object-contain p-8 sm:p-12"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              src={selectedImage}
            />
          </div>
          {currentProduct.gallery.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {currentProduct.gallery.map((image, index) => (
                <button
                  aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                  aria-pressed={index === activeImage}
                  className={`focus-ring relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-surface p-1 ${index === activeImage ? "border-primary ring-2 ring-primary/25" : "border-border"}`}
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
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{currentProduct.brand}</span>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
              ★ {currentProduct.rating.toFixed(1)} {t("storefront", "customerRating")}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black text-foreground sm:text-4xl">{currentProduct.name}</h1>
          <p className="mt-4 leading-7 text-muted">{currentProduct.description}</p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
            <p className="text-3xl font-black text-foreground">
              {formatPrice(currentProduct.priceEgp, currency, locale)}
            </p>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{stockLabel}</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex items-center rounded-xl border border-border bg-surface">
              <button
                aria-label={t("storefront", "decreaseQuantity")}
                className="focus-ring h-12 w-12"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                type="button"
              >
                −
              </button>
              <span className="w-10 text-center font-bold">{quantity}</span>
              <button
                aria-label={t("storefront", "increaseQuantity")}
                className="focus-ring h-12 w-12 disabled:opacity-40"
                disabled={!available || quantity >= maximum}
                onClick={() => setQuantity((current) => Math.min(maximum, current + 1))}
                type="button"
              >
                +
              </button>
            </div>
            <button
              className="button-primary flex-1 disabled:opacity-50"
              disabled={!available}
              onClick={() => addToCart(currentProduct, quantity)}
              type="button"
            >
              {t("storefront", "addToCart")}
            </button>
            <button className="button-secondary" disabled={!available} onClick={handleBuyNow} type="button">
              {t("storefront", "buyNow")}
            </button>
            <button
              aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
              className="button-secondary"
              onClick={handleWishlist}
              type="button"
            >
              {isSaved ? "♥" : "♡"}
            </button>
          </div>

          <dl className="mt-7 grid gap-3 rounded-2xl border border-border bg-surface p-5 text-sm">
            <DetailRow label={t("storefront", "sku")} value={currentProduct.sku} />
            <DetailRow
              label={t("storefront", "warrantyMonths")}
              value={`${currentProduct.warrantyMonths} ${t("storefront", "months")}`}
            />
            <DetailRow
              label={t("storefront", "fulfillment")}
              value={currentProduct.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")}
            />
          </dl>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-black text-foreground">{t("storefront", "technicalDetails")}</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
          {currentProduct.specs.length > 0 ? (
            <dl className="divide-y divide-border">
              {currentProduct.specs.map((spec) => (
                <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm" key={`${spec.label}-${spec.value}`}>
                  <dt className="text-muted">{spec.label}</dt>
                  <dd className="font-semibold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="p-6 text-sm text-muted">{currentProduct.description}</p>
          )}
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-2xl font-black text-foreground">{t("storefront", "youMightLike")}</h2>
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

function ProductSkeleton() {
  return <div className="site-container min-h-[55vh] animate-pulse py-14" />;
}

function ProductUnavailable({ message }: { message: string }) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[55vh] place-items-center py-14 text-center">
      <div>
        <h1 className="text-2xl font-black text-foreground">{t("storefront", "productUnavailable")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
        <Link className="button-primary mt-6" href="/shop">
          {t("storefront", "returnToCatalogue")}
        </Link>
      </div>
    </div>
  );
}
