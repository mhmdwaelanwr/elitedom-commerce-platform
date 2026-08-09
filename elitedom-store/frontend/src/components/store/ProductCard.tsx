import { Link } from "react-router-dom";
import { StoreIcon } from "@/components/store/StoreIcon";
import type { StoreLocale } from "@/components/store/StoreHeader";
import type { Product } from "@/types/store";

type ProductCardProps = {
  product: Product;
  locale: StoreLocale;
};

function formatEgp(value: number, locale: StoreLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}

function decisionSpec(product: Product) {
  const values = product.specs.slice(0, 3).map((spec) => spec.value).filter(Boolean);
  if (values.length > 0) return values.join(" · ");
  return `${product.categoryName} · ${product.warrantyMonths}-month warranty`;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const inStock = product.stockQty > 0;
  const labels = locale === "ar"
    ? { badge: "مختار", stock: inStock ? "متوفر" : "حسب الطلب", view: "عرض التفاصيل" }
    : { badge: "NEW DROP", stock: inStock ? "In stock" : "On request", view: "View details" };

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
        <span className="el-product-card__badge">{labels.badge}</span>
      </div>
      <p className="el-product-card__brand">{product.brand} / {product.categoryName}</p>
      <h3>{product.name}</h3>
      <p className="el-product-card__spec">{decisionSpec(product)}</p>
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
