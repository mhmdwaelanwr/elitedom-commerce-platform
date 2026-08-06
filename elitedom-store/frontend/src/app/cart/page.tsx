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
      <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div>
          <div className="mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-elevated text-3xl">🛒</div>
          <h1 className="mt-5 text-3xl font-black text-foreground">{t("storefront", "cartEmptyTitle")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{t("storefront", "cartEmptyText")}</p>
          <Link className="button-primary mt-6" href="/shop">
            {t("storefront", "exploreProducts")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">
          {t("storefront", "home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("storefront", "cart")}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-2 text-3xl font-black text-foreground">{t("storefront", "shoppingCart")}</h1>
        </div>
        <p className="text-sm text-muted">
          {cartCount} {cartCount === 1 ? t("storefront", "item") : t("storefront", "items")}
        </p>
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_7rem] gap-4 border-b border-border bg-elevated px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted md:grid">
            <span>{t("storefront", "product")}</span>
            <span>{t("storefront", "price")}</span>
            <span>{t("storefront", "quantity")}</span>
            <span>{t("storefront", "total")}</span>
          </div>
          <ul className="divide-y divide-border">
            {cart.map((item) => {
              const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
              const isSaved = wishlist.includes(item.product.id);
              const fulfilment = item.product.dropshipEnabled && item.product.stockQty === 0
                ? t("storefront", "dropship")
                : t("storefront", "localStock");

              return (
                <li className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_8rem_9rem_7rem] md:items-center md:px-6 md:py-5" key={item.product.id}>
                  <div className="flex min-w-0 gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-elevated">
                      <Image alt={item.product.name} className="object-contain p-2" fill sizes="80px" src={item.product.image} />
                    </div>
                    <div className="min-w-0">
                      <Link className="focus-ring line-clamp-2 rounded-md font-bold text-foreground hover:text-primary" href={`/products/${item.product.id}`}>
                        {item.product.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{item.product.sku} · {fulfilment}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                        <button
                          className="focus-ring rounded-md text-muted hover:text-danger"
                          onClick={() => removeFromCart(item.product.id)}
                          type="button"
                        >
                          {t("storefront", "remove")}
                        </button>
                        <button
                          className="focus-ring rounded-md text-primary hover:brightness-110"
                          onClick={() => {
                            toggleWishlist(item.product.id);
                            notify(
                              isSaved
                                ? t("storefront", "removedFromWishlist")
                                : t("storefront", "savedToWishlist"),
                              "info",
                            );
                          }}
                          type="button"
                        >
                          {isSaved ? t("storefront", "removeFromWishlist") : t("storefront", "saveToWishlist")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-foreground">
                    <span className="me-2 text-xs text-muted md:hidden">{t("storefront", "price")}:</span>
                    {formatPrice(item.product.priceEgp, currency, locale)}
                  </p>

                  <div className="inline-flex w-fit items-center rounded-lg border border-border bg-elevated">
                    <button
                      aria-label={`${t("storefront", "decreaseQuantity")}: ${item.product.name}`}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-s-lg text-muted hover:bg-surface hover:text-foreground"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      type="button"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                    <button
                      aria-label={`${t("storefront", "increaseQuantity")}: ${item.product.name}`}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-e-lg text-muted hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={item.quantity >= maximum}
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>

                  <p className="text-sm font-black text-foreground">
                    <span className="me-2 text-xs font-normal text-muted md:hidden">{t("storefront", "total")}:</span>
                    {formatPrice(item.product.priceEgp * item.quantity, currency, locale)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-28">
          <h2 className="text-lg font-bold text-foreground">{t("storefront", "orderEstimate")}</h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <SummaryRow label={t("storefront", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
            <SummaryRow label={t("storefront", "deliveryCairo")} value={formatPrice(totals.shipping, currency, locale)} />
            <SummaryRow label={t("storefront", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
              <dt className="font-bold text-foreground">{t("storefront", "estimatedTotal")}</dt>
              <dd className="text-xl font-black text-primary">{formatPrice(totals.total, currency, locale)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">{t("storefront", "finalShippingNote")}</p>
          <Link className="button-primary mt-6 flex w-full" href="/checkout">
            {t("storefront", "continueCheckout")}
          </Link>
          <Link className="focus-ring mt-4 block rounded-md text-center text-sm font-bold text-primary hover:brightness-110" href="/shop">
            {t("storefront", "continueShopping")}
          </Link>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
