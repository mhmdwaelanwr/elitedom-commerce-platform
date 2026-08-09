import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { addRemoteCartItem } from "@/lib/api";
import { restoreSession } from "@/lib/auth-session";
import { fetchRichCatalog, fetchRichProduct } from "@/lib/catalog-api";
import { getGuestCartSessionId } from "@/lib/guest-cart";
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
    inStock: "In stock — local availability",
    onRequest: "Available on request",
    vat: "VAT included · Secure payments · Installment options may be available",
    add: "Add to cart",
    adding: "Adding…",
    added: "Added to cart",
    buy: "Buy now",
    warranty: "local warranty",
    delivery: "Tracked nationwide delivery",
    returns: "30-day return eligibility applies",
    technical: "Technical depth, when you want it.",
    overview: "Overview",
    specs: "Technical specifications",
    support: "Warranty & support",
    deliveryTab: "Delivery",
    compatibility: "Compatibility depends on the complete build. Confirm PSU, case clearance and platform before checkout.",
    related: "Compare similar products.",
    error: "We could not load this product.",
    missing: "This product is no longer available in the catalogue.",
    retry: "Retry",
    back: "Back to catalogue",
    cartError: "Could not update the cart. Try again.",
  },
  ar: {
    media: "صور المنتج",
    inStock: "متوفر — توافر محلي",
    onRequest: "متاح حسب الطلب",
    vat: "السعر شامل الضريبة · دفع آمن · قد تتوفر خيارات تقسيط",
    add: "أضف للسلة",
    adding: "جارٍ الإضافة…",
    added: "تمت الإضافة للسلة",
    buy: "اشترِ الآن",
    warranty: "ضمان محلي",
    delivery: "توصيل متتبع لكل المحافظات",
    returns: "تطبق أهلية الإرجاع خلال 30 يومًا",
    technical: "التفاصيل التقنية، وقت ما تحتاجها.",
    overview: "نظرة عامة",
    specs: "المواصفات التقنية",
    support: "الضمان والدعم",
    deliveryTab: "التوصيل",
    compatibility: "التوافق يعتمد على التجميعة كاملة. راجع مزود الطاقة ومساحة الكيسة والمنصة قبل إتمام الطلب.",
    related: "قارن بمنتجات مشابهة.",
    error: "تعذر تحميل المنتج.",
    missing: "المنتج ده مش متاح حاليًا في الكتالوج.",
    retry: "حاول تاني",
    back: "ارجع للكتالوج",
    cartError: "تعذر تحديث السلة. حاول تاني.",
  },
} as const;

function formatEgp(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 0,
  }).format(value);
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
          if (active) setRelated(products.filter((item) => item.id !== product.id).slice(0, 3));
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

  async function addToCart() {
    if (!product || cartState === "adding") return false;
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
    if (added) navigate("/cart");
  }

  return (
    <div className="el-commerce-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        {state.status === "loading" ? <PdpSkeleton /> : null}
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
          <main>
            <div className="el-pdp-crumb">STORE / {product.categoryName} / {product.brand} / {product.sku}</div>
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
                      <button className={selectedImage === index ? "is-active" : ""} key={`${image}-${index}`} onClick={() => setSelectedImage(index)} type="button">
                        <img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={image} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="el-pdp-purchase">
                <p className="el-commerce-crumb">{product.brand} / {product.categoryName} / SKU {product.sku}</p>
                <h1>{product.name}</h1>
                <p className="el-pdp-description">{product.longDescription ?? product.description}</p>

                <div className="el-pdp-key-specs">
                  {keySpecs.map((spec) => (
                    <div key={spec.code ?? spec.label}>
                      <span>{spec.label}</span>
                      <strong>{spec.value}</strong>
                    </div>
                  ))}
                </div>

                <p className={product.stockQty > 0 ? "el-stock-status is-in-stock" : "el-stock-status"}>
                  <i /> {product.stockQty > 0 ? text.inStock : text.onRequest}
                </p>
                <strong className="el-pdp-price">{formatEgp(product.priceEgp, locale)} EGP</strong>
                <p className="el-pdp-vat">{text.vat}</p>

                <div className="el-purchase-actions">
                  <div className="el-quantity-control">
                    <button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button"><StoreIcon name="minus" size={16} /></button>
                    <span>{quantity}</span>
                    <button aria-label="Increase quantity" disabled={quantity >= Math.max(1, product.stockQty || 10)} onClick={() => setQuantity((value) => value + 1)} type="button"><StoreIcon name="plus" size={16} /></button>
                  </div>
                  <button className="el-add-cart-button" disabled={cartState === "adding"} onClick={addToCart} type="button">
                    <StoreIcon name="cart" size={18} />
                    {cartState === "adding" ? text.adding : cartState === "added" ? text.added : text.add}
                  </button>
                  <button className="el-buy-now-button" disabled={cartState === "adding"} onClick={buyNow} type="button">{text.buy} <StoreIcon name="arrow" size={18} /></button>
                </div>
                {cartState === "error" ? <p className="el-cart-error">{text.cartError}</p> : null}

                <div className="el-pdp-service-notes">
                  <span><StoreIcon name="warranty" size={14} /> {product.warrantyMonths}m {text.warranty}</span>
                  <span><StoreIcon name="delivery" size={14} /> {text.delivery}</span>
                  <span><StoreIcon name="returns" size={14} /> {text.returns}</span>
                </div>
              </div>
            </section>

            <section className="el-pdp-technical">
              <h2>{text.technical}</h2>
              <div className="el-pdp-tabs" aria-label="Product information sections">
                <span>{text.overview}</span>
                <span className="is-active">{text.specs}</span>
                <span>{text.support}</span>
                <span>{text.deliveryTab}</span>
              </div>
              <div className="el-spec-table">
                {product.specs.length ? product.specs.map((spec) => (
                  <div key={spec.code ?? spec.label}><span>{spec.label}</span><strong>{spec.value}</strong></div>
                )) : <div><span>SKU</span><strong>{product.sku}</strong></div>}
                <div><span>{locale === "ar" ? "الضمان" : "Warranty"}</span><strong>{product.warrantyMonths} months</strong></div>
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

function PdpSkeleton() {
  return (
    <main className="el-pdp-skeleton" aria-label="Loading product">
      <div />
      <div />
    </main>
  );
}
