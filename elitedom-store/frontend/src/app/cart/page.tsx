"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function CartPage() {
  const { locale, t } = usePreferences();
  const { cart, cartCount, currency, notify, removeFromCart, toggleWishlist, updateQuantity, wishlist } = useStore();
  const totals = getCheckoutTotals(cart, GOVERNORATES[0]);

  if (cart.length === 0) {
    return (
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-primary" aria-hidden="true"><BagIcon /></span>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-foreground">{t("storefront", "cartEmptyTitle")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("storefront", "cartEmptyText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "exploreProducts")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted">
        <Link className="focus-ring rounded-full hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("storefront", "cart")}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-primary">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("storefront", "shoppingCart")}</h1>
        </div>
        <p className="text-sm text-muted">{cartCount} {cartCount === 1 ? t("storefront", "item") : t("storefront", "items")}</p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-14">
        <section aria-label={t("storefront", "shoppingCart")}>
          <ul className="divide-y divide-border border-y border-border">
            {cart.map((item) => {
              const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
              const isSaved = wishlist.includes(item.product.id);
              const fulfilment = item.product.dropshipEnabled && item.product.stockQty === 0 ? t("storefront", "dropship") : t("storefront", "localStock");

              return (
                <li className="grid gap-5 py-6 sm:grid-cols-[7rem_minmax(0,1fr)]" key={item.product.id}>
                  <Link className="focus-ring relative aspect-square overflow-hidden rounded-2xl bg-elevated" href={`/products/${encodeURIComponent(item.product.slug ?? item.product.id)}`}>
                    <Image alt={item.product.name} className="object-contain p-3" fill sizes="112px" src={item.product.image} />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 max-w-2xl">
                        <p className="text-xs font-medium text-muted">{item.product.brand} · {fulfilment}</p>
                        <Link className="focus-ring mt-1 line-clamp-2 rounded-lg text-base font-bold leading-6 text-foreground hover:text-primary" href={`/products/${encodeURIComponent(item.product.slug ?? item.product.id)}`}>{item.product.name}</Link>
                        <p className="mt-2 text-sm font-bold text-foreground">{formatPrice(item.product.priceEgp, currency, locale)}</p>
                      </div>
                      <p className="text-lg font-bold text-foreground">{formatPrice(item.product.priceEgp * item.quantity, currency, locale)}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="inline-flex h-10 items-center rounded-full border border-border bg-surface">
                        <button aria-label={`${t("storefront", "decreaseQuantity")}: ${item.product.name}`} className="focus-ring grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-elevated hover:text-foreground" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} type="button">−</button>
                        <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                        <button aria-label={`${t("storefront", "increaseQuantity")}: ${item.product.name}`} className="focus-ring grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-elevated hover:text-foreground disabled:opacity-40" disabled={item.quantity >= maximum} onClick={() => updateQuantity(item.product.id, item.quantity + 1)} type="button">+</button>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-bold">
                        <button className="focus-ring rounded-full px-3 py-2 text-muted transition hover:bg-elevated hover:text-danger" onClick={() => removeFromCart(item.product.id)} type="button">{t("storefront", "remove")}</button>
                        <button className="focus-ring rounded-full px-3 py-2 text-primary transition hover:bg-[var(--ds-primary-soft)]" onClick={() => { toggleWishlist(item.product.id); notify(isSaved ? t("storefront", "removedFromWishlist") : t("storefront", "savedToWishlist"), "info"); }} type="button">
                          {isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link className="focus-ring mt-5 inline-flex rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href="/shop">{t("storefront", "continueShopping")}</Link>
        </section>

        <aside className="h-fit rounded-2xl bg-elevated p-6 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-foreground">{t("storefront", "orderEstimate")}</h2>
          <dl className="mt-6 grid gap-3 text-sm">
            <SummaryRow label={t("storefront", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
            <SummaryRow label={t("storefront", "deliveryCairo")} value={formatPrice(totals.shipping, currency, locale)} />
            <SummaryRow label={t("storefront", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-4">
              <dt className="font-bold text-foreground">{t("storefront", "estimatedTotal")}</dt>
              <dd className="text-xl font-bold text-foreground">{formatPrice(totals.total, currency, locale)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">{t("storefront", "finalShippingNote")}</p>
          <Link className="button-primary mt-6 flex w-full" href="/checkout">{t("storefront", "continueCheckout")}</Link>
        </aside>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>;
}

function BagIcon() {
  return <svg fill="none" height="26" viewBox="0 0 24 24" width="26"><path d="M5 8h14l-1 12H6L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}