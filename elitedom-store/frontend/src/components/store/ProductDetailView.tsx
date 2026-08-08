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

type DetailTab = "overview" | "specs" | "support";

export function ProductDetailView({ product, relatedProducts }: { product: Product; relatedProducts: Product[] }) {
  const router = useRouter();
  const { locale, t } = usePreferences();
  const { addToCart, currency, notify, setCartOpen, toggleWishlist, wishlist } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

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
    notify(isSaved ? t("storefront", "removedFromWishlist") : t("storefront", "savedToWishlist"), "info");
  }

  return (
    <main className="pb-20">
      <div className="site-container py-5">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted">
          <Link className="focus-ring rounded-full hover:text-foreground" href="/">{t("storefront", "home")}</Link>
          <span aria-hidden="true">/</span>
          <Link className="focus-ring shrink-0 rounded-full hover:text-foreground" href={`/shop?category=${product.category}`}>{product.categoryName}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>
      </div>

      <section className="site-container grid gap-10 pb-12 pt-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,.92fr)] lg:gap-14 lg:pb-16 lg:pt-6">
        <div className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-elevated">
            <div className="absolute start-5 top-5 z-10 flex flex-wrap gap-2">
              {product.featured ? (
                <span className="rounded-full bg-[var(--ds-primary-soft)] px-3 py-1.5 text-xs font-bold text-primary">{t("storefront", "featured")}</span>
              ) : null}
              {!available ? (
                <span className="rounded-full bg-[var(--ds-danger-soft)] px-3 py-1.5 text-xs font-bold text-danger">{t("storefront", "outOfStock")}</span>
              ) : null}
            </div>
            <Image alt={product.name} className="object-contain p-9 sm:p-14" fill priority sizes="(min-width: 1024px) 55vw, 100vw" src={selectedImage} />
          </div>

          {product.gallery.length > 1 ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {product.gallery.map((image, index) => (
                <button
                  aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                  aria-pressed={index === activeImage}
                  className={`focus-ring relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-elevated transition ${index === activeImage ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"}`}
                  key={`${image}-${index}`}
                  onClick={() => setActiveImage(index)}
                  type="button"
                >
                  <Image alt="" className="object-contain p-2" fill sizes="80px" src={image} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-bold text-primary">{product.brand}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[2.75rem]">{product.name}</h1>
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">{product.description}</p>

          {product.specs.length > 0 ? (
            <dl className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {product.specs.slice(0, 4).map((specification) => (
                <div key={`${specification.label}-${specification.value}`}>
                  <dt className="text-xs text-muted">{specification.label}</dt>
                  <dd className="mt-1 text-sm font-bold text-foreground">{specification.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-7 border-t border-border pt-6">
            <p className="text-xs text-muted">{t("storefront", "priceVatIncluded")}</p>
            <p className="mt-1 text-3xl font-bold tracking-[-0.025em] text-foreground sm:text-4xl">{formatPrice(product.priceEgp, currency, locale)}</p>
            <p className={`mt-3 inline-flex items-center gap-2 text-sm font-bold ${available ? "text-success" : "text-danger"}`}>
              <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
              {stockLabel}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex h-12 items-center rounded-full border border-border bg-surface">
              <button aria-label={t("storefront", "decreaseQuantity")} className="focus-ring grid h-12 w-11 place-items-center rounded-full text-lg text-muted hover:bg-elevated" onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button">−</button>
              <span className="w-8 text-center text-sm font-bold text-foreground">{quantity}</span>
              <button aria-label={t("storefront", "increaseQuantity")} className="focus-ring grid h-12 w-11 place-items-center rounded-full text-lg text-muted hover:bg-elevated disabled:opacity-40" disabled={!available || quantity >= maximum} onClick={() => setQuantity((current) => Math.min(maximum, current + 1))} type="button">+</button>
            </div>
            <button className="button-primary min-w-44 flex-1 disabled:cursor-not-allowed disabled:opacity-50" disabled={!available} onClick={() => addToCart(product, quantity)} type="button">
              {available ? t("storefront", "addToCart") : t("storefront", "currentlyUnavailable")}
            </button>
            <button aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")} className={`focus-ring grid h-12 w-12 place-items-center rounded-full border ${isSaved ? "border-primary bg-primary text-primary-contrast" : "border-border text-muted hover:text-primary"}`} onClick={handleWishlist} type="button">
              <HeartIcon filled={isSaved} />
            </button>
          </div>

          <button className="button-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={!available} onClick={handleBuyNow} type="button">{t("storefront", "buyNow")}</button>

          <div className="mt-7 grid gap-3 border-t border-border pt-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <PurchaseFact label={t("storefront", "fulfillment")} value={product.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")} />
            <PurchaseFact label={t("storefront", "warrantyMonths")} value={`${product.warrantyMonths} ${t("storefront", "months")}`} />
            <PurchaseFact label={t("storefront", "securePayments")} value={t("storefront", "securePaymentsDetail")} />
          </div>
        </aside>
      </section>

      <section className="bg-elevated py-12 sm:py-16">
        <div className="site-container">
          <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label={t("storefront", "technicalDetails")}>
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>{t("storefront", "overview")}</TabButton>
            <TabButton active={activeTab === "specs"} onClick={() => setActiveTab("specs")}>{t("storefront", "technicalDetails")}</TabButton>
            <TabButton active={activeTab === "support"} onClick={() => setActiveTab("support")}>{t("storefront", "warranty")}</TabButton>
          </div>

          <div className="mt-8 rounded-2xl bg-surface p-6 sm:p-8 lg:p-10">
            {activeTab === "overview" ? (
              <div className="max-w-3xl">
                <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">{product.name}</h2>
                <p className="mt-4 text-sm leading-7 text-muted sm:text-base">{product.longDescription ?? product.description}</p>
              </div>
            ) : null}

            {activeTab === "specs" ? (
              product.specs.length > 0 ? (
                <dl className="divide-y divide-border">
                  {product.specs.map((specification) => (
                    <div className="grid gap-2 py-4 sm:grid-cols-[minmax(10rem,.7fr)_minmax(0,1.3fr)] sm:gap-8" key={`${specification.label}-${specification.value}`}>
                      <dt className="text-sm text-muted">{specification.label}</dt>
                      <dd className="text-sm font-medium text-foreground">{specification.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm leading-7 text-muted">{product.description}</p>
              )
            ) : null}

            {activeTab === "support" ? (
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("storefront", "warranty")}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted">{product.warrantyMonths} {t("storefront", "months")} · {t("storefront", "verifiedWarrantyDetail")}</p>
                  <Link className="button-secondary mt-5" href="/warranty">{t("storefront", "warrantyRma")}</Link>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("storefront", "needHelpDeciding")}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted">{t("storefront", "needHelpText")}</p>
                  <Link className="button-primary mt-5" href="/b2b">{t("storefront", "talkB2b")}</Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="site-container py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-primary">{t("storefront", "completeSetup")}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-foreground">{t("storefront", "youMightLike")}</h2>
            </div>
            <Link className="focus-ring rounded-full px-4 py-2 text-sm font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href={`/shop?category=${product.category}`}>{t("storefront", "seeMore")}</Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.slice(0, 4).map((item) => <StoreProductCard context="home" key={item.id} product={item} />)}
          </div>
        </section>
      ) : null}

      {available ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-3 lg:hidden">
          <div className="site-container flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted">{product.name}</p>
              <p className="text-base font-bold text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p>
            </div>
            <button className="button-primary shrink-0" onClick={() => addToCart(product, quantity)} type="button">{t("storefront", "addToCart")}</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PurchaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button className={`focus-ring shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`} onClick={onClick} role="tab" aria-selected={active} type="button">{children}</button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="19" viewBox="0 0 24 24" width="19"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}