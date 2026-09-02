import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { addRemoteCartItem } from "@/lib/api";
import { restoreSession } from "@/lib/auth-session";
import { fetchRichCatalog, fetchRichProduct } from "@/lib/catalog-api";
import { getGuestCartSessionId } from "@/lib/guest-cart";
import { purchasableQuantityLimit } from "@/lib/commerce-rules";
import type { Product } from "@/types/store";
import "@/styles/commerce.css";

type PageState =
  | { status: "loading"; product?: undefined }
  | { status: "ready"; product: Product }
  | { status: "missing"; product?: undefined }
  | { status: "error"; product?: undefined };

type CartState = "idle" | "adding" | "added" | "error";

const copy = {
  en: {
    media: "PRODUCT MEDIA",
    breadcrumb: "Product breadcrumb",
    store: "Store",
    inStock: "In stock — local availability",
    onRequest: "Available on request",
    outOfStock: "Currently out of stock",
    priceNote: "Shipping and final charges are confirmed during checkout.",
    add: "Add to cart",
    adding: "Adding…",
    added: "Added to cart",
    unavailable: "Currently unavailable",
    buy: "Buy now",
    warranty: "local warranty",
    delivery: "Shipping is calculated during checkout",
    technical: "Technical details",
    overview: "Overview",
    specs: "Technical specifications",
    support: "Warranty & support",
    deliveryTab: "Delivery",
    compatibility: "Compatibility depends on the complete build. Confirm PSU, case clearance and platform before checkout.",
    related: "Related products",
    error: "We could not load this product.",
    missing: "This product is no longer available in the catalogue.",
    retry: "Retry",
    back: "Back to catalogue",
    cartError: "Could not update the cart. Try again.",
    decrease: "Decrease quantity",
    increase: "Increase quantity",
    loading: "Loading product",
  },
  ar: {
    media: "صور المنتج",
    breadcrumb: "مسار المنتج",
    store: "المتجر",
    inStock: "متوفر في المخزن المحلي",
    onRequest: "متاح حسب الطلب",
    outOfStock: "غير متوفر حاليًا",
    priceNote: "يتم تأكيد الشحن والتكلفة النهائية أثناء إتمام الطلب.",
    add: "أضف للسلة",
    adding: "جارٍ الإضافة…",
    added: "تمت الإضافة للسلة",
    unavailable: "غير متوفر حاليًا",
    buy: "اشترِ الآن",
    warranty: "ضمان محلي",
    delivery: "يتم حساب الشحن أثناء إتمام الطلب",
    technical: "التفاصيل التقنية",
    overview: "نظرة عامة",
    specs: "المواصفات التقنية",
    support: "الضمان والدعم",
    deliveryTab: "التوصيل",
    compatibility: "التوافق يعتمد على التجميعة كاملة. راجع مزود الطاقة ومساحة الكيسة والمنصة قبل إتمام الطلب.",
    related: "منتجات مرتبطة",
    error: "تعذر تحميل المنتج.",
    missing: "المنتج ده مش متاح حاليًا في الكتالوج.",
    retry: "حاول تاني",
    back: "ارجع للكتالوج",
    cartError: "تعذر تحديث السلة. حاول تاني.",
    decrease: "قلّل الكمية",
    increase: "زوّد الكمية",
    loading: "جارٍ تحميل المنتج",
  },
} as const;

function formatEgp(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}

function relatedScore(candidate: Product, source: Product) {
  let score = 0;
  if (candidate.brand && candidate.brand === source.brand) score += 4;
  if (candidate.stockQty > 0) score += 3;
  else if (candidate.dropshipEnabled) score += 1;
  if (candidate.featured) score += 1;

  const sourceSpecs = new Set(source.specs.map((spec) => `${spec.label}:${spec.value}`.toLowerCase()));
  const sharedSpecs = candidate.specs.filter((spec) => sourceSpecs.has(`${spec.label}:${spec.value}`.toLowerCase())).length;
  return score + Math.min(sharedSpecs, 3);
}

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const [locale, setLocale] = useStoreLocale();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartState, setCartState] = useState<CartState>("idle");
  const text = copy[locale];

  useEffect(() => {
    let active = true;
    fetchRichProduct(productId, locale)
      .then(async (product) => {
        if (!active) return;
        if (!product) {
          setState({ status: "missing" });
          return;
        }
        setSelectedImage(0);
        setQuantity(1);
        setCartState("idle");
        setState({ status: "ready", product });
        try {
          const products = await fetchRichCatalog({
            locale,
            category: product.category !== "uncategorized" ? product.category : undefined,
            limit: 12,
          });
          if (active) {
            setRelated(
              products
                .filter((item) => item.id !== product.id)
                .sort((first, second) => {
                  const scoreDifference = relatedScore(second, product) - relatedScore(first, product);
                  if (scoreDifference !== 0) return scoreDifference;
                  return Math.abs(first.priceEgp - product.priceEgp) - Math.abs(second.priceEgp - product.priceEgp);
                })
                .slice(0, 3),
            );
          }
        } catch {
          if (active) setRelated([]);
        }
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => { active = false; };
  }, [locale, productId]);

  const product = state.status === "ready" ? state.product : undefined;
  const gallery = product?.gallery.length ? product.gallery : product ? [product.image] : [];
  const keySpecs = useMemo(() => product?.specs.slice(0, 4) ?? [], [product]);
  const isInStock = Boolean(product && product.stockQty > 0);
  const canPurchase = Boolean(product && (isInStock || product.dropshipEnabled));
  const maximumQuantity = product ? purchasableQuantityLimit(product.stockQty, product.dropshipEnabled) : 1;

  async function addToCart() {
    if (!product || !canPurchase || cartState === "adding") return false;
    setCartState("adding");
    try {
      const session = await restoreSession();
      await addRemoteCartItem(
        { productId: product.id, quantity },
        session ? undefined : getGuestCartSessionId(),
        session ?? undefined,
      );
      setCartState("added");
      window.dispatchEvent(new CustomEvent("elitedom:cart-updated"));
      return true;
    } catch {
      setCartState("error");
      return false;
    }
  }

  async function buyNow() {
    const added = await addToCart();
    if (added) navigate("/checkout");
  }

  return (
    <div className="el-commerce-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        {state.status === "loading" ? <PdpSkeleton label={text.loading} /> : null}
        {state.status === "error" || state.status === "missing" ? (
          <main className="el-pdp-state">
            <StoreIcon name={state.status === "missing" ? "search" : "returns"} size={32} />
            <h1>{state.status === "missing" ? text.missing : text.error}</h1>
            <div>
              {state.status === "error" ? <button onClick={() => window.location.reload()} type="button">{text.retry}</button> : null}
              <button onClick={() => navigate("/catalog")} type="button">{text.back}</button>
            </div>
          </main>
        ) : null}

        {product ? (
          <main className="el-pdp-content">
            <nav aria-label={text.breadcrumb} className="el-pdp-crumb">
              <Link to="/">{text.store}</Link>
              <span aria-hidden="true">/</span>
              <Link to={`/catalog?category=${encodeURIComponent(product.category)}`}>{product.categoryName}</Link>
              <span aria-hidden="true">/</span>
              <span dir="auto">{product.sku}</span>
            </nav>
            <section className="el-pdp-hero">
              <div className="el-pdp-media-column">
                <div className="el-pdp-main-media">
                  {gallery[selectedImage] ? (
                    <img
                      alt={product.name}
                      onError={(event) => { event.currentTarget.hidden = true; }}
                      src={gallery[selectedImage]}
                    />
                  ) : null}
                  <span>{text.media} / {String(selectedImage + 1).padStart(2, "0")}</span>
                </div>
                {gallery.length > 1 ? (
                  <div className="el-pdp-thumbnails">
                    {gallery.slice(0, 6).map((image, index) => (
                      <button
                        aria-label={`${text.media} ${index + 1}`}
                        aria-pressed={selectedImage === index}
                        className={selectedImage === index ? "is-active" : ""}
                        key={`${image}-${index}`}
                        onClick={() => setSelectedImage(index)}
                        type="button"
                      >
                        <img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={image} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="el-pdp-purchase">
                <p className="el-commerce-crumb" dir="auto">{product.brand} / {product.categoryName} / SKU {product.sku}</p>
                <h1 dir="auto">{product.name}</h1>
                <p className="el-pdp-description" dir="auto">{product.longDescription ?? product.description}</p>

                <div className="el-pdp-key-specs">
                  {keySpecs.map((spec) => (
                    <div key={spec.code ?? spec.label}>
                      <span dir="auto">{spec.label}</span>
                      <strong dir="auto">{spec.value}</strong>
                    </div>
                  ))}
                </div>

                <p
                  aria-live="polite"
                  className={isInStock ? "el-stock-status is-in-stock" : product.dropshipEnabled ? "el-stock-status is-on-request" : "el-stock-status is-out-of-stock"}
                >
                  <StoreIcon name={isInStock ? "check" : product.dropshipEnabled ? "clock" : "returns"} size={16} />
                  {isInStock ? text.inStock : product.dropshipEnabled ? text.onRequest : text.outOfStock}
                </p>
                <strong className="el-pdp-price" dir="ltr">{formatEgp(product.priceEgp, locale)} EGP</strong>
                <p className="el-pdp-vat">{text.priceNote}</p>

                <div className="el-purchase-actions">
                  <div className="el-quantity-control">
                    <button aria-label={text.decrease} disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button"><StoreIcon name="minus" size={16} /></button>
                    <span>{quantity}</span>
                    <button aria-label={text.increase} disabled={quantity >= maximumQuantity} onClick={() => setQuantity((value) => Math.min(maximumQuantity, value + 1))} type="button"><StoreIcon name="plus" size={16} /></button>
                  </div>
                  <button className="el-add-cart-button" disabled={!canPurchase || cartState === "adding"} onClick={addToCart} type="button">
                    <StoreIcon name="cart" size={18} />
                    {!canPurchase ? text.unavailable : cartState === "adding" ? text.adding : cartState === "added" ? text.added : text.add}
                  </button>
                  <button className="el-buy-now-button" disabled={!canPurchase || cartState === "adding"} onClick={buyNow} type="button">{text.buy} <StoreIcon name="arrow" size={18} /></button>
                </div>
                {cartState === "error" ? <p aria-live="assertive" className="el-cart-error" role="alert">{text.cartError}</p> : null}

                <div className="el-pdp-service-notes">
                  {product.warrantyMonths > 0 ? <span><StoreIcon name="warranty" size={14} /> {product.warrantyMonths}m {text.warranty}</span> : null}
                  <span><StoreIcon name="delivery" size={14} /> {text.delivery}</span>
                </div>
              </div>
            </section>

            <section className="el-pdp-technical">
              <h2>{text.technical}</h2>
              <p className="el-pdp-technical__intro">{text.specs}</p>
              <div className="el-spec-table">
                {product.specs.length ? product.specs.map((spec) => (
                  <div key={spec.code ?? spec.label}><span dir="auto">{spec.label}</span><strong dir="auto">{spec.value}</strong></div>
                )) : <div><span>SKU</span><strong>{product.sku}</strong></div>}
                {product.warrantyMonths > 0 ? <div><span>{locale === "ar" ? "الضمان" : "Warranty"}</span><strong dir="auto">{product.warrantyMonths} {locale === "ar" ? "شهر" : "months"}</strong></div> : null}
              </div>
              <div className="el-compatibility-strip"><span>{text.compatibility}</span><button onClick={() => navigate("/catalog")} type="button">{text.back} <StoreIcon name="arrow" size={14} /></button></div>
            </section>

            {related.length > 0 ? (
              <section className="el-pdp-related">
                <h2>{text.related}</h2>
                <div className="el-pdp-related-grid">{related.map((item) => <ProductCard key={item.id} locale={locale} product={item} />)}</div>
              </section>
            ) : null}
          </main>
        ) : null}

        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function PdpSkeleton({ label }: { label: string }) {
  return (
    <main aria-busy="true" aria-label={label} className="el-pdp-skeleton">
      <div />
      <div />
    </main>
  );
}