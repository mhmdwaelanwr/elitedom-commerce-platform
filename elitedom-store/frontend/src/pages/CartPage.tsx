import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { removeRemoteCartItem, updateRemoteCartItem } from "@/lib/api";
import { restoreSession } from "@/lib/auth-session";
import { cartItemCount, cartSubtotal, loadGuestCart, type GuestCartSnapshot } from "@/lib/cart-data";
import { purchasableQuantityLimit } from "@/lib/commerce-rules";
import "@/styles/checkout.css";

const copy = {
  en: {
    title: "Your cart", item: "item", items: "items", local: "In stock", onRequest: "Available on request", warranty: "warranty", remove: "Remove",
    summary: "Order summary", products: "Products", shipping: "Shipping", calculated: "Calculated at checkout",
    total: "Estimated pre-shipping total", continue: "Continue to checkout", secure: "Secure checkout · Encrypted connection",
    emptyTitle: "Your cart is ready for hardware.", emptyText: "Add a product from the catalogue and it will stay linked to your cart.",
    shop: "Shop hardware", error: "We could not load your cart.", retry: "Retry", mutationError: "We could not update this cart item. Try again.",
    decrease: "Decrease quantity", increase: "Increase quantity", loading: "Loading cart",
  },
  ar: {
    title: "سلة التسوق", item: "منتج", items: "منتجات", local: "متوفر", onRequest: "متاح حسب الطلب", warranty: "ضمان", remove: "إزالة",
    summary: "ملخص الطلب", products: "المنتجات", shipping: "الشحن", calculated: "يُحسب عند إتمام الطلب",
    total: "الإجمالي المبدئي قبل الشحن", continue: "متابعة لإتمام الطلب", secure: "إتمام طلب آمن · اتصال مشفر",
    emptyTitle: "السلة جاهزة للهاردوير.", emptyText: "أضف منتج من الكتالوج وهيفضل مرتبط بسلتك.",
    shop: "تسوّق الهاردوير", error: "تعذر تحميل السلة.", retry: "حاول تاني", mutationError: "تعذر تحديث المنتج في السلة. حاول تاني.",
    decrease: "قلّل الكمية", increase: "زوّد الكمية", loading: "جارٍ تحميل السلة",
  },
} as const;

function formatEgp(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value);
}

export function CartPage() {
  const [locale, setLocale] = useStoreLocale();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<GuestCartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const text = copy[locale];

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const currentSession = await restoreSession();
      setSnapshot(await loadGuestCart(locale, currentSession));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((currentSession) => loadGuestCart(locale, currentSession))
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [locale]);

  async function updateQuantity(itemId: number | undefined, quantity: number) {
    if (!snapshot || pendingItemId !== null || !itemId || quantity < 1 || quantity > 100) return;
    const previousSnapshot = snapshot;
    setPendingItemId(itemId);
    setMutationError(null);
    setSnapshot({
      ...snapshot,
      items: snapshot.items.map((item) => item.serverItemId === itemId ? { ...item, quantity } : item),
    });
    try {
      await updateRemoteCartItem(itemId, quantity, snapshot.sessionId, snapshot.session);
      window.dispatchEvent(new CustomEvent("elitedom:cart-updated"));
    } catch {
      setSnapshot(previousSnapshot);
      setMutationError(text.mutationError);
    } finally {
      setPendingItemId(null);
    }
  }

  async function removeItem(itemId: number | undefined) {
    if (!snapshot || pendingItemId !== null || !itemId) return;
    const previousSnapshot = snapshot;
    setPendingItemId(itemId);
    setMutationError(null);
    setSnapshot({ ...snapshot, items: snapshot.items.filter((item) => item.serverItemId !== itemId) });
    try {
      await removeRemoteCartItem(itemId, snapshot.sessionId, snapshot.session);
      window.dispatchEvent(new CustomEvent("elitedom:cart-updated"));
    } catch {
      setSnapshot(previousSnapshot);
      setMutationError(text.mutationError);
    } finally {
      setPendingItemId(null);
    }
  }

  const items = snapshot?.items ?? [];
  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  const cartMutationPending = pendingItemId !== null;

  return (
    <div className="el-checkout-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main>
          <section className="el-cart-intro"><h1>{text.title}</h1>{!loading && !error ? <p>{count} {count === 1 ? text.item : text.items}</p> : null}</section>
          {loading ? <div aria-busy="true" aria-label={text.loading} className="el-cart-loading"><div /><div /><div /></div> : null}
          {!loading && error ? <div className="el-cart-empty"><StoreIcon name="returns" size={30} /><h2>{text.error}</h2><button onClick={() => void reload()} type="button">{text.retry}</button></div> : null}
          {!loading && !error && items.length === 0 ? <div className="el-cart-empty"><StoreIcon name="cart" size={34} /><h2>{text.emptyTitle}</h2><p>{text.emptyText}</p><Link to="/catalog">{text.shop} <StoreIcon name="arrow" size={15} /></Link></div> : null}
          {!loading && !error && items.length > 0 ? (
            <div className="el-cart-layout">
              <section className="el-cart-items" aria-label={text.title}>
                {mutationError ? <p aria-live="assertive" className="el-cart-mutation-error" role="alert">{mutationError}</p> : null}
                {items.map((item) => {
                  const quantityLimit = purchasableQuantityLimit(item.product.stockQty, item.product.dropshipEnabled);
                  const canIncrease = item.quantity < quantityLimit;
                  return (
                    <article className="el-cart-item" key={item.serverItemId ?? item.product.id}>
                      <div className="el-cart-item__media"><img alt={item.product.name} onError={(event) => { event.currentTarget.hidden = true; }} src={item.product.image} /></div>
                      <div className="el-cart-item__info">
                        <Link dir="auto" to={`/products/${encodeURIComponent(item.product.id)}`}>{item.product.name}</Link>
                        <p dir="auto">{item.product.specs.slice(0, 2).map((spec) => spec.value).join(" · ") || item.product.categoryName}</p>
                        <span className={item.product.dropshipEnabled && item.product.stockQty <= 0 ? "el-cart-item__availability is-on-request" : "el-cart-item__availability is-in-stock"}>{item.product.dropshipEnabled && item.product.stockQty <= 0 ? text.onRequest : text.local}{item.product.warrantyMonths > 0 ? ` · ${item.product.warrantyMonths}m ${text.warranty}` : ""}</span>
                        <button disabled={cartMutationPending} onClick={() => void removeItem(item.serverItemId)} type="button">{text.remove}</button>
                      </div>
                      <strong className="el-cart-item__price" dir="ltr">{formatEgp(item.product.priceEgp * item.quantity, locale)} EGP</strong>
                      <div className="el-cart-quantity">
                        <button aria-label={text.decrease} disabled={cartMutationPending || item.quantity <= 1} onClick={() => void updateQuantity(item.serverItemId, item.quantity - 1)} type="button"><StoreIcon name="minus" size={16} /></button>
                        <span>{item.quantity}</span>
                        <button aria-label={text.increase} disabled={cartMutationPending || !canIncrease} onClick={() => void updateQuantity(item.serverItemId, item.quantity + 1)} type="button"><StoreIcon name="plus" size={16} /></button>
                      </div>
                    </article>
                  );
                })}
              </section>
              <aside className="el-order-summary el-order-summary--cart">
                <h2>{text.summary}</h2>
                <SummaryRow label={text.products} value={`${formatEgp(subtotal, locale)} EGP`} />
                <SummaryRow label={text.shipping} value={text.calculated} />
                <div className="el-summary-divider" />
                <SummaryRow emphasis label={text.total} value={`${formatEgp(subtotal, locale)} EGP`} />
                <button className="el-summary-primary" disabled={cartMutationPending} onClick={() => navigate("/checkout")} type="button">{text.continue}</button>
                <p className="el-summary-security">{text.secure}</p>
              </aside>
            </div>
          ) : null}
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? "el-summary-row is-emphasis" : "el-summary-row"}><span>{label}</span><strong>{value}</strong></div>;
}