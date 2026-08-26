import { Link } from "react-router-dom";
import { StoreIcon } from "@/components/store/StoreIcon";
import type { StoreLocale } from "@/components/store/StoreHeader";
import type { Product } from "@/types/store";

type ProductCardProps = {
  product: Product;
  locale: StoreLocale;
  compareSelected?: boolean;
  onCompareToggle?: () => void;
};

function formatEgp(value: number, locale: StoreLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}

function decisionSpec(product: Product, locale: StoreLocale) {
  const values = product.specs.slice(0, 3).map((spec) => spec.value).filter(Boolean);
  if (values.length > 0) return values.join(" · ");
  if (product.warrantyMonths > 0) {
    return locale === "ar"
      ? `${product.categoryName} · ضمان ${product.warrantyMonths} شهر`
      : `${product.categoryName} · ${product.warrantyMonths}-month warranty`;
  }
  return product.categoryName;
}

export function ProductCard({ product, locale, compareSelected = false, onCompareToggle }: ProductCardProps) {
  const inStock = product.stockQty > 0;
  const labels = locale === "ar"
    ? { badge: "مختار", stock: inStock ? "متوفر" : "حسب الطلب", view: "عرض التفاصيل", compare: compareSelected ? "إزالة من المقارنة" : "أضف للمقارنة" }
    : { badge: "FEATURED", stock: inStock ? "In stock" : "On request", view: "View details", compare: compareSelected ? "Remove from compare" : "Add to compare" };

  return (
    <article className="el-product-card">
      <div className="el-product-card__media">
        <img
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.parentElement?.classList.add("is-media-unavailable");
          }}
          src={product.image}
        />
        {product.featured ? <span className="el-product-card__badge">{labels.badge}</span> : null}
        {onCompareToggle ? <button aria-label={`${labels.compare}: ${product.name}`} aria-pressed={compareSelected} className="el-product-card__compare" onClick={onCompareToggle} type="button"><StoreIcon name="compare" size={18} /></button> : null}
      </div>
      <p className="el-product-card__brand" dir="auto">{product.brand} / {product.categoryName}</p>
      <h3 dir="auto"><Link to={`/products/${encodeURIComponent(product.id)}`}>{product.name}</Link></h3>
      <p className="el-product-card__spec" dir="auto">{decisionSpec(product, locale)}</p>
      <div className="el-product-card__price-row">
        <strong>{formatEgp(product.priceEgp, locale)} EGP</strong>
        <span className={inStock ? "is-in-stock" : "is-on-request"}>{labels.stock}</span>
      </div>
      <Link className="el-outline-button el-product-card__cta" to={`/products/${encodeURIComponent(product.id)}`}>
        <span>{labels.view}</span>
        <StoreIcon name="arrow" size={16} />
      </Link>
    </article>
  );
}
