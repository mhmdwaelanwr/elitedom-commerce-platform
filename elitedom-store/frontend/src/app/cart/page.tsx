"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function CartPage() {
  const { locale, t } = usePreferences();
  const {
    cart,
    cartCount,
    currency,
    notify,
    removeFromCart,
    toggleWishlist,
    updateQuantity,
    wishlist,
  } = useStore();
  const totals = getCheckoutTotals(cart, GOVERNORATES[0]);

  if (cart.length === 0) {
    return (
      <main className="site-container grid min-h-[62vh] place-items-center py-14 text-center">
        <section className="w-full max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-foreground">
            <CartIcon />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-foreground">{t("storefront", "cartEmptyTitle")}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">{t("storefront", "cartEmptyText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "exploreProducts")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link className="hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{t("storefront", "cart")}</span>
      </nav>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="section-kicker">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{t("storefront", "shoppingCart")}</h1>
        </div>
        <p className="text-sm font-bold text-muted">
          {cartCount} {cartCount === 1 ? t("storefront", "item") : t("storefront", "items")}
        </p>
      </header>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <section aria-label={t("storefront", "shoppingCart")} className="min-w-0">
          <ul className="grid gap-3">
            {cart.map((item) => {
              const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
              const isSaved = wishlist.includes(item.product.id);
              const fulfilment = item.product.dropshipEnabled && item.product.stockQty === 0
                ? t("storefront", "dropship")
                : t("storefront", "localStock");
              const keySpec = item.product.specs[0]?.value;

              return (
                <li className="rounded-2xl border border-border bg-surface p-4 sm:p-5" key={item.product.id}>
                  <div className="grid gap-5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center">
                    <Link
                      className="relative aspect-square w-full max-w-[7rem] overflow-hidden rounded-xl bg-[var(--ds-product-canvas)]"
                      href={`/products/${encodeURIComponent(item.product.slug ?? item.product.id)}`}
                    >
                      <Image alt={item.product.name} className="object-contain p-3" fill sizes="112px" src={item.product.image} />
                    </Link>

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted">{item.product.brand}</p>
                      <Link
                        className="mt-1 block max-w-2xl text-base font-black leading-6 tracking-[-0.015em] text-foreground hover:text-primary"
                        href={`/products/${encodeURIComponent(item.product.slug ?? item.product.id)}`}
                      >
                        {item.product.name}
                      </Link>
                      <p className="mt-2 text-xs text-muted">
                        {item.product.sku} · {fulfilment}{keySpec ? ` · ${keySpec}` : ""}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-black">
                        <button
                          className="focus-ring rounded-md text-muted hover:text-danger"
                          onClick={() => removeFromCart(item.product.id)}
                          type="button"
                        >
                          {t("storefront", "remove")}
                        </button>
                        <button
                          className="focus-ring rounded-md text-muted hover:text-primary"
                          onClick={() => {
                            toggleWishlist(item.product.id);
                            notify(isSaved ? t("storefront", "removedFromWishlist") : t("storefront", "savedToWishlist"), "info");
                          }}
                          type="button"
                        >
                          {isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-4 border-t border-border pt-4 sm:block sm:min-w-40 sm:border-t-0 sm:pt-0 sm:text-end">
                      <div>
                        <p className="text-[10px] font-bold text-muted">{t("storefront", "price")}</p>
                        <p className="mt-1 text-base font-black text-foreground">{formatPrice(item.product.priceEgp * item.quantity, currency, locale)}</p>
                      </div>
                      <div className="mt-3 inline-flex items-center overflow-hidden rounded-xl border border-border bg-background">
                        <button
                          aria-label={`${t("storefront", "decreaseQuantity")}: ${item.product.name}`}
                          className="grid h-9 w-9 place-items-center text-muted hover:bg-elevated hover:text-foreground"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          type="button"
                        >−</button>
                        <span className="w-8 text-center text-sm font-black text-foreground">{item.quantity}</span>
                        <button
                          aria-label={`${t("storefront", "increaseQuantity")}: ${item.product.name}`}
                          className="grid h-9 w-9 place-items-center text-muted hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                          disabled={item.quantity >= maximum}
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          type="button"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link className="mt-5 inline-flex items-center gap-2 text-sm font-black text-muted hover:text-foreground" href="/shop">
            <span aria-hidden="true" className="rtl:rotate-180">←</span> {t("storefront", "continueShopping")}
          </Link>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:sticky lg:top-32">
          <h2 className="text-lg font-black tracking-[-0.02em] text-foreground">{t("storefront", "orderEstimate")}</h2>
          <div className="mt-5 flex items-end justify-between gap-4 border-b border-border pb-5">
            <span className="text-sm font-bold text-muted">{t("storefront", "estimatedTotal")}</span>
            <span className="text-2xl font-black tracking-[-0.035em] text-foreground">{formatPrice(totals.total, currency, locale)}</span>
          </div>

          <details className="group border-b border-border py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-black text-foreground">
              <span>{t("storefront", "details")}</span>
              <span className="text-muted transition group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>
            <dl className="mt-4 grid gap-3 text-xs">
              <SummaryRow label={t("storefront", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
              <SummaryRow label={t("storefront", "deliveryCairo")} value={formatPrice(totals.shipping, currency, locale)} />
              <SummaryRow label={t("storefront", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
            </dl>
          </details>

          <p className="mt-4 text-xs leading-5 text-muted">{t("storefront", "finalShippingNote")}</p>
          <Link className="button-primary mt-5 flex w-full" href="/checkout">
            {t("storefront", "continueCheckout")} <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        </aside>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-black text-foreground">{value}</dd></div>;
}

function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="25" viewBox="0 0 24 24" width="25"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}
