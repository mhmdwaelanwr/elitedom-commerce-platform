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
      <div className="site-container grid min-h-[58vh] place-items-center py-14 text-center">
        <div className="max-w-lg">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <CartIcon />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("storefront", "cartEmptyTitle")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{t("storefront", "cartEmptyText")}</p>
          <Link className="button-primary mt-6" href="/shop">{t("storefront", "exploreProducts")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-7 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted sm:text-sm">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <Chevron />
        <span className="text-foreground">{t("storefront", "cart")}</span>
      </nav>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <p className="section-kicker">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{t("storefront", "shoppingCart")}</h1>
        </div>
        <p className="rounded-md bg-elevated px-3 py-1.5 text-xs font-bold text-muted">
          {cartCount} {cartCount === 1 ? t("storefront", "item") : t("storefront", "items")}
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section aria-label={t("storefront", "shoppingCart")} className="grid gap-3">
          {cart.map((item) => {
            const maximum = item.product.dropshipEnabled ? 100 : Math.max(1, item.product.stockQty);
            const isSaved = wishlist.includes(item.product.id);
            const fulfilment = item.product.dropshipEnabled && item.product.stockQty === 0
              ? t("storefront", "dropship")
              : t("storefront", "localStock");
            const productHref = `/products/${encodeURIComponent(item.product.slug ?? item.product.id)}`;

            return (
              <article className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5" key={item.product.id}>
                <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-[7rem_minmax(0,1fr)_11rem] lg:items-center">
                  <Link className="focus-ring relative aspect-square overflow-hidden rounded-lg border border-border bg-elevated" href={productHref}>
                    <Image alt={item.product.name} className="object-contain p-2.5" fill sizes="112px" src={item.product.image} />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                      <span className="text-primary">{item.product.brand}</span>
                      <span>•</span>
                      <span>{fulfilment}</span>
                    </div>
                    <Link className="focus-ring mt-1.5 line-clamp-2 block rounded-md text-base font-bold leading-6 text-foreground hover:text-primary" href={productHref}>
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">{item.product.sku}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                      <button className="focus-ring rounded-md text-danger hover:brightness-110" onClick={() => removeFromCart(item.product.id)} type="button">
                        {t("storefront", "remove")}
                      </button>
                      <button
                        className="focus-ring rounded-md text-primary hover:brightness-110"
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

                  <div className="grid gap-3 border-t border-border pt-4 sm:col-start-2 lg:col-start-auto lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
                    <p className="text-lg font-black text-foreground">{formatPrice(item.product.priceEgp * item.quantity, currency, locale)}</p>
                    <p className="text-[11px] text-muted">{formatPrice(item.product.priceEgp, currency, locale)} × {item.quantity}</p>
                    <QuantityControl
                      decreaseLabel={`${t("storefront", "decreaseQuantity")}: ${item.product.name}`}
                      increaseLabel={`${t("storefront", "increaseQuantity")}: ${item.product.name}`}
                      maximum={maximum}
                      onChange={(value) => updateQuantity(item.product.id, value)}
                      quantity={item.quantity}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="h-fit xl:sticky xl:top-36">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-foreground">{t("storefront", "orderEstimate")}</h2>
            <dl className="mt-5 grid gap-3 text-sm">
              <SummaryRow label={t("storefront", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
              <SummaryRow label={t("storefront", "deliveryCairo")} value={formatPrice(totals.shipping, currency, locale)} />
              <SummaryRow label={t("storefront", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
              <div className="mt-1 flex items-end justify-between gap-4 border-t border-border pt-4">
                <dt className="font-black text-foreground">{t("storefront", "estimatedTotal")}</dt>
                <dd className="text-2xl font-black tracking-tight text-foreground">{formatPrice(totals.total, currency, locale)}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted">{t("storefront", "finalShippingNote")}</p>
            <Link className="button-primary mt-5 flex w-full" href="/checkout">
              {t("storefront", "continueCheckout")}
              <Arrow />
            </Link>
            <Link className="focus-ring mt-3 block rounded-md py-2 text-center text-sm font-bold text-primary hover:brightness-110" href="/shop">
              {t("storefront", "continueShopping")}
            </Link>
          </div>

          <div className="mt-3 grid gap-2 rounded-xl border border-border bg-elevated/55 p-4 text-xs text-muted">
            <TrustRow icon="shield" text={t("storefront", "securePaymentsDetail")} />
            <TrustRow icon="truck" text={t("storefront", "freeShippingDetail")} />
            <TrustRow icon="support" text={t("storefront", "verifiedWarrantyDetail")} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuantityControl({
  decreaseLabel,
  increaseLabel,
  maximum,
  onChange,
  quantity,
}: {
  decreaseLabel: string;
  increaseLabel: string;
  maximum: number;
  onChange: (value: number) => void;
  quantity: number;
}) {
  return (
    <div className="inline-flex h-9 w-fit items-center rounded-lg border border-border bg-surface">
      <button aria-label={decreaseLabel} className="focus-ring grid h-full w-9 place-items-center rounded-s-lg text-muted hover:bg-elevated hover:text-foreground" onClick={() => onChange(quantity - 1)} type="button">−</button>
      <span className="w-8 text-center text-sm font-black text-foreground">{quantity}</span>
      <button aria-label={increaseLabel} className="focus-ring grid h-full w-9 place-items-center rounded-e-lg text-muted hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35" disabled={quantity >= maximum} onClick={() => onChange(quantity + 1)} type="button">+</button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-semibold text-foreground">{value}</dd></div>;
}

function TrustRow({ icon, text }: { icon: "shield" | "truck" | "support"; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-primary"><TrustIcon icon={icon} /></span>
      <span className="leading-5">{text}</span>
    </div>
  );
}

function Chevron() {
  return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function Arrow() {
  return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CartIcon() {
  return <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 24 24" width="28"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /><circle cx="10" cy="20" fill="currentColor" r="1.2" /><circle cx="18" cy="20" fill="currentColor" r="1.2" /></svg>;
}

function TrustIcon({ icon }: { icon: "shield" | "truck" | "support" }) {
  if (icon === "truck") return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (icon === "shield") return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M5 13v-2a7 7 0 0 1 14 0v2M5 13H3v5h4v-5H5Zm14 0h2v5h-4v-5h2ZM17 18c0 2-2 3-5 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
