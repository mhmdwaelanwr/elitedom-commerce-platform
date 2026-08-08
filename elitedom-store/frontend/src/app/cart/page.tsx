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
      <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center">
        <section className="w-full max-w-lg">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <BagIcon />
          </span>
          <p className="section-kicker mt-7">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("storefront", "cartEmptyTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted sm:text-base">
            {t("storefront", "cartEmptyText")}
          </p>
          <Link className="button-primary mt-7" href="/shop">
            {t("storefront", "exploreProducts")}
            <ArrowIcon />
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">
          {t("storefront", "home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("storefront", "cart")}</span>
      </nav>

      <header className="mt-6 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">{t("storefront", "reviewSelection")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("storefront", "shoppingCart")}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {cartCount} {cartCount === 1 ? t("storefront", "item") : t("storefront", "items")}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-muted">
          <LockIcon />
          {t("checkout", "eyebrow")}
        </div>
      </header>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] xl:gap-10">
        <div className="min-w-0">
          <section aria-label={t("storefront", "shoppingCart")}>
            <ul className="grid gap-3">
              {cart.map((item) => {
                const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
                const isSaved = wishlist.includes(item.product.id);
                const fulfilment =
                  item.product.dropshipEnabled && item.product.stockQty === 0
                    ? t("storefront", "dropship")
                    : t("storefront", "localStock");
                const productHref = `/products/${item.product.slug ?? item.product.id}`;

                return (
                  <li
                    className="group rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/35 sm:p-5"
                    key={item.product.id}
                  >
                    <div className="grid gap-5 sm:grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-center">
                      <Link
                        aria-label={item.product.name}
                        className="focus-ring relative aspect-square overflow-hidden rounded-xl bg-elevated"
                        href={productHref}
                      >
                        <Image
                          alt={item.product.name}
                          className="object-contain p-3 transition duration-200 group-hover:scale-[1.03]"
                          fill
                          sizes="112px"
                          src={item.product.image}
                        />
                      </Link>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                          <span className="text-primary">{item.product.brand}</span>
                          <span aria-hidden="true" className="text-border">•</span>
                          <span className="text-muted">{item.product.sku}</span>
                          <span className="rounded-full bg-[var(--ds-soft-success)] px-2 py-1 text-success">
                            {fulfilment}
                          </span>
                        </div>
                        <Link
                          className="focus-ring mt-2 block max-w-2xl rounded-md text-base font-black leading-6 text-foreground hover:text-primary sm:text-lg"
                          href={productHref}
                        >
                          {item.product.name}
                        </Link>

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                          <QuantityControl
                            disabledIncrement={item.quantity >= maximum}
                            name={item.product.name}
                            onDecrease={() => updateQuantity(item.product.id, item.quantity - 1)}
                            onIncrease={() => updateQuantity(item.product.id, item.quantity + 1)}
                            quantity={item.quantity}
                          />
                          <button
                            className="focus-ring rounded-md text-xs font-bold text-muted transition hover:text-primary"
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
                            {isSaved
                              ? t("storefront", "removeFromWishlist")
                              : t("storefront", "saveToWishlist")}
                          </button>
                          <button
                            className="focus-ring rounded-md text-xs font-bold text-muted transition hover:text-danger"
                            onClick={() => removeFromCart(item.product.id)}
                            type="button"
                          >
                            {t("storefront", "remove")}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-5 border-t border-border pt-4 sm:col-span-2 lg:col-span-1 lg:min-w-40 lg:flex-col lg:items-end lg:border-0 lg:pt-0 lg:text-end">
                        <div>
                          <p className="text-xs text-muted">{t("storefront", "price")}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatPrice(item.product.priceEgp, currency, locale)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">{t("storefront", "total")}</p>
                          <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                            {formatPrice(item.product.priceEgp * item.quantity, currency, locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label={t("checkout", "securityNote")}>
            <TrustItem icon={<TruckIcon />} title={t("storefront", "deliveryCairo")} />
            <TrustItem icon={<ShieldIcon />} title={t("storefront", "warranty")} />
            <TrustItem icon={<ReceiptIcon />} title={t("storefront", "pricesIncludeVat")} />
          </section>

          <Link className="focus-ring mt-7 inline-flex items-center gap-2 rounded-md text-sm font-black text-primary hover:underline" href="/shop">
            <span aria-hidden="true" className="rtl:rotate-180">←</span>
            {t("storefront", "continueShopping")}
          </Link>
        </div>

        <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:sticky lg:top-28">
          <div className="border-b border-border px-6 py-5">
            <p className="section-kicker">{t("checkout", "orderSummary")}</p>
            <h2 className="mt-1 text-xl font-black text-foreground">{t("storefront", "orderEstimate")}</h2>
          </div>
          <div className="p-6">
            <dl className="grid gap-3.5 text-sm">
              <SummaryRow label={t("storefront", "products")} value={formatPrice(totals.subtotal, currency, locale)} />
              <SummaryRow label={t("storefront", "deliveryCairo")} value={formatPrice(totals.shipping, currency, locale)} />
              <SummaryRow label={t("storefront", "vat14")} value={formatPrice(totals.vat, currency, locale)} />
            </dl>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm font-black text-foreground">{t("storefront", "estimatedTotal")}</span>
                <span className="text-2xl font-black tracking-tight text-foreground">
                  {formatPrice(totals.total, currency, locale)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{t("storefront", "finalShippingNote")}</p>
            </div>

            <Link className="button-primary mt-6 flex w-full justify-center" href="/checkout">
              {t("storefront", "continueCheckout")}
              <ArrowIcon />
            </Link>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-elevated p-3.5 text-xs leading-5 text-muted">
              <span className="mt-0.5 shrink-0 text-success"><ShieldIcon /></span>
              <span>{t("checkout", "securityNote")}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuantityControl({
  disabledIncrement,
  name,
  onDecrease,
  onIncrease,
  quantity,
}: {
  disabledIncrement: boolean;
  name: string;
  onDecrease: () => void;
  onIncrease: () => void;
  quantity: number;
}) {
  const { t } = usePreferences();
  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-border bg-background">
      <button
        aria-label={`${t("storefront", "decreaseQuantity")}: ${name}`}
        className="focus-ring grid h-full w-10 place-items-center rounded-s-lg text-base text-muted transition hover:bg-elevated hover:text-foreground"
        onClick={onDecrease}
        type="button"
      >
        −
      </button>
      <span className="min-w-9 px-1 text-center text-sm font-black text-foreground">{quantity}</span>
      <button
        aria-label={`${t("storefront", "increaseQuantity")}: ${name}`}
        className="focus-ring grid h-full w-10 place-items-center rounded-e-lg text-base text-muted transition hover:bg-elevated hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
        disabled={disabledIncrement}
        onClick={onIncrease}
        type="button"
      >
        +
      </button>
    </div>
  );
}

function TrustItem({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="text-xs font-bold leading-5 text-foreground">{title}</span>
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

function BagIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="34" viewBox="0 0 24 24" width="34">
      <path d="M5 8h14l-1 12H6L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
