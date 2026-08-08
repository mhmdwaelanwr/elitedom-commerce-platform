"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product, ProductSpec } from "@/types/store";

type DetailTab = "overview" | "specs" | "support";

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
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  const available = product.stockQty > 0 || product.dropshipEnabled;
  const maximum = Math.max(1, product.dropshipEnabled ? 100 : product.stockQty);
  const selectedImage = product.gallery[activeImage] ?? product.image;
  const isSaved = wishlist.includes(product.id);
  const keySpecs = useMemo(() => selectKeySpecs(product.specs, 4), [product.specs]);
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
      <div className="site-container py-5 sm:py-6">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted">
          <Link className="shrink-0 hover:text-foreground" href="/">{t("storefront", "home")}</Link>
          <span aria-hidden="true">/</span>
          <Link className="shrink-0 hover:text-foreground" href={`/shop?category=${product.category}`}>{product.categoryName}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>
      </div>

      <section className="border-y border-border bg-surface">
        <div className="site-container grid gap-9 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,.85fr)] lg:gap-14 lg:py-12">
          <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
              {product.gallery.length > 1 ? (
                <div className="order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:flex-col sm:overflow-visible">
                  {product.gallery.map((image, index) => (
                    <button
                      aria-label={`${t("storefront", "showImage")} ${index + 1}`}
                      aria-pressed={index === activeImage}
                      className={`focus-ring relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-[var(--ds-product-canvas)] transition sm:h-[4.5rem] sm:w-[4.5rem] ${index === activeImage ? "border-foreground" : "border-border hover:border-foreground/25"}`}
                      key={`${image}-${index}`}
                      onClick={() => setActiveImage(index)}
                      type="button"
                    >
                      <Image alt="" className="object-contain p-2" fill sizes="72px" src={image} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="order-1 sm:order-2">
                <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-[var(--ds-product-canvas)]">
                  <Image alt={product.name} className="object-contain p-8 sm:p-12 lg:p-14" fill priority sizes="(min-width: 1024px) 54vw, 100vw" src={selectedImage} />
                </div>
              </div>
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-bold text-muted">
              <span className="text-primary">{product.brand}</span>
              <span>{product.sku}</span>
              {product.rating > 0 ? <span>★ {product.rating.toFixed(1)} · {t("storefront", "customerRating")}</span> : null}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.04em] text-foreground sm:text-3xl xl:text-[2.2rem]">
              {product.name}
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted sm:text-[0.95rem] sm:leading-7">{product.description}</p>

            {keySpecs.length > 0 ? (
              <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-border py-5">
                {keySpecs.map((spec) => (
                  <div className="min-w-0" key={`${spec.label}-${spec.value}`}>
                    <dt className="text-[10px] font-black uppercase tracking-[0.09em] text-muted">{spec.label}</dt>
                    <dd className="mt-1 truncate text-sm font-black text-foreground" title={spec.value}>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-muted">{t("storefront", "priceVatIncluded")}</p>
                <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{formatPrice(product.priceEgp, currency, locale)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${product.stockQty > 0 ? "bg-[var(--ds-soft-success)] text-success" : product.dropshipEnabled ? "bg-[var(--ds-soft-warning)] text-warning" : "bg-[var(--ds-soft-danger)] text-danger"}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{stockLabel}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="inline-flex shrink-0 items-center overflow-hidden rounded-xl border border-border bg-surface">
                  <button aria-label={t("storefront", "decreaseQuantity")} className="grid h-11 w-10 place-items-center text-muted hover:bg-elevated hover:text-foreground" onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button">−</button>
                  <span className="w-8 text-center text-sm font-black text-foreground">{quantity}</span>
                  <button aria-label={t("storefront", "increaseQuantity")} className="grid h-11 w-10 place-items-center text-muted hover:bg-elevated hover:text-foreground disabled:opacity-40" disabled={!available || quantity >= maximum} onClick={() => setQuantity((current) => Math.min(maximum, current + 1))} type="button">+</button>
                </div>
                <button className="button-primary min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-45" disabled={!available} onClick={() => addToCart(product, quantity)} type="button">
                  <CartIcon /> {available ? t("storefront", "addToCart") : t("storefront", "currentlyUnavailable")}
                </button>
                <button aria-label={isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")} className={`focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${isSaved ? "border-danger bg-danger text-primary-contrast" : "border-border bg-surface text-muted hover:text-foreground"}`} onClick={handleWishlist} type="button"><HeartIcon filled={isSaved} /></button>
              </div>
              <button className="button-secondary mt-3 w-full disabled:opacity-45" disabled={!available} onClick={handleBuyNow} type="button">{t("storefront", "buyNow")}</button>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <MiniFact label={t("storefront", "fulfillment")} value={product.stockQty > 0 ? t("storefront", "localStock") : t("storefront", "dropship")} />
                <MiniFact label={t("storefront", "warrantyMonths")} value={`${product.warrantyMonths} ${t("storefront", "months")}`} />
                <MiniFact label={t("storefront", "securePayments")} value={t("storefront", "verifiedCatalogue")} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="site-container py-12 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            <TabButton active={detailTab === "overview"} label={product.categoryName} onClick={() => setDetailTab("overview")} />
            <TabButton active={detailTab === "specs"} label={t("storefront", "technicalDetails")} onClick={() => setDetailTab("specs")} />
            <TabButton active={detailTab === "support"} label={t("storefront", "warranty")} onClick={() => setDetailTab("support")} />
          </div>

          {detailTab === "overview" ? (
            <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <p className="section-kicker">{product.brand}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">{product.name}</h2>
                <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted sm:text-base">{product.longDescription ?? product.description}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-xs font-black text-foreground">{t("storefront", "needHelpDeciding")}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{t("storefront", "needHelpText")}</p>
                <Link className="button-secondary mt-4 w-full text-xs" href="/b2b">{t("storefront", "talkB2b")}</Link>
              </div>
            </div>
          ) : null}

          {detailTab === "specs" ? (
            <div className="py-8">
              <div className="flex items-end justify-between gap-4">
                <div><p className="section-kicker">{product.categoryName}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">{t("storefront", "technicalDetails")}</h2></div>
                <span className="hidden text-xs font-bold text-muted sm:block">{product.sku}</span>
              </div>
              {product.specs.length > 0 ? (
                <dl className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
                  {product.specs.map((spec, index) => (
                    <div className={`grid gap-1 px-4 py-4 text-sm sm:grid-cols-[minmax(10rem,.7fr)_minmax(0,1.3fr)] sm:gap-6 sm:px-6 ${index > 0 ? "border-t border-border" : ""}`} key={`${spec.label}-${spec.value}-${index}`}>
                      <dt className="font-semibold text-muted">{spec.label}</dt>
                      <dd className="font-black text-foreground">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="mt-6 text-sm text-muted">{product.description}</p>}
            </div>
          ) : null}

          {detailTab === "support" ? (
            <div className="grid gap-4 py-8 sm:grid-cols-3">
              <SupportCard title={t("storefront", "fulfillment")} text={product.stockQty > 0 ? t("storefront", "fulfilmentLocal") : t("storefront", "fulfilmentSupplier")} />
              <SupportCard title={t("storefront", "warrantyMonths")} text={`${product.warrantyMonths} ${t("storefront", "months")}`} />
              <SupportCard title={t("storefront", "securePayments")} text={t("storefront", "securePaymentsDetail")} />
              <div className="sm:col-span-3 flex flex-wrap gap-3 pt-2"><Link className="button-secondary" href="/warranty">{t("storefront", "warranty")}</Link><Link className="button-secondary" href="/b2b">{t("storefront", "talkB2b")}</Link></div>
            </div>
          ) : null}
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="border-y border-border bg-elevated/45 py-12 sm:py-16">
          <div className="site-container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="section-kicker">{t("storefront", "completeSetup")}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">{t("storefront", "youMightLike")}</h2></div>
              <Link className="text-sm font-black text-foreground hover:text-primary" href={`/shop?category=${product.category}`}>{t("storefront", "seeMore")} <span aria-hidden="true" className="rtl:rotate-180">→</span></Link>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{relatedProducts.map((item) => <StoreProductCard key={item.id} product={item} variant="home" />)}</div>
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--ds-header)] p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-muted">{product.name}</p><p className="truncate text-base font-black text-foreground">{formatPrice(product.priceEgp, currency, locale)}</p></div>
          <button className="button-primary min-h-10 shrink-0 px-4 py-2 text-xs disabled:opacity-45" disabled={!available} onClick={() => addToCart(product, 1)} type="button">{t("storefront", "addToCart")}</button>
        </div>
      </div>
    </main>
  );
}

function selectKeySpecs(specs: ProductSpec[], limit: number) {
  const priorities = ["processor", "cpu", "chip", "gpu", "graphics", "ram", "memory", "storage", "ssd", "screen", "display", "resolution", "refresh", "socket", "chipset", "power", "watt"];
  return [...specs].map((spec, index) => {
    const haystack = `${spec.code ?? ""} ${spec.label}`.toLowerCase();
    const match = priorities.findIndex((term) => haystack.includes(term));
    return { spec, index, score: match === -1 ? 100 + index : match };
  }).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map(({ spec }) => spec);
}
function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`focus-ring shrink-0 border-b-2 px-4 py-3 text-sm font-black transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"}`} onClick={onClick} type="button">{label}</button>; }
function MiniFact({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-1 line-clamp-2 text-[10px] font-bold leading-4 text-foreground">{value}</p></div>; }
function SupportCard({ title, text }: { title: string; text: string }) { return <article className="rounded-2xl border border-border bg-surface p-5"><p className="text-xs font-black text-foreground">{title}</p><p className="mt-2 text-sm leading-6 text-muted">{text}</p></article>; }
function HeartIcon({ filled }: { filled: boolean }) { return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="19" viewBox="0 0 24 24" width="19"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function CartIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>; }
