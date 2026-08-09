import { Link } from "react-router-dom";
import { StoreIcon } from "@/components/store/StoreIcon";
import type { StoreLocale } from "@/components/store/StoreHeader";
import { cartItemCount, cartSubtotal } from "@/lib/cart-data";
import type { CartItem, Product } from "@/types/store";

function formatEgp(value: number, locale: StoreLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function SearchOverlay({
  locale,
  query,
  products,
  loading,
  onQueryChange,
  onClose,
  onSearchAll,
}: {
  locale: StoreLocale;
  query: string;
  products: Product[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSearchAll: () => void;
}) {
  const ar = locale === "ar";
  const quick = ar ? "نتائج سريعة" : "QUICK RESULTS";
  const all = ar ? "ابحث في كل الهاردوير" : "Search all hardware";
  const placeholder = ar ? "ابحث عن هاردوير" : "Search hardware";
  const empty = ar ? "مفيش نتائج سريعة للبحث ده." : "No quick results for this search.";

  return (
    <section aria-label={ar ? "اقتراحات البحث" : "Search suggestions"} className="el-search-overlay" role="dialog">
      <div className="el-search-overlay__field">
        <StoreIcon name="search" size={18} />
        <input
          aria-label={placeholder}
          autoFocus
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter") onSearchAll();
          }}
          placeholder={placeholder}
          type="search"
          value={query}
        />
        <button aria-label={ar ? "إغلاق البحث" : "Close search"} className="el-panel-close" onClick={onClose} type="button">×</button>
      </div>
      <p className="el-surface-kicker">{quick}</p>
      <div className="el-search-overlay__results" aria-live="polite">
        {loading ? <div className="el-search-overlay__loading"><span /><span /><span /></div> : null}
        {!loading && products.length === 0 ? <p className="el-search-overlay__empty">{empty}</p> : null}
        {!loading ? products.slice(0, 3).map((product) => (
          <Link className="el-search-result" key={product.id} onClick={onClose} to={`/products/${encodeURIComponent(product.id)}`}>
            <span>
              <strong dir="auto">{product.name}</strong>
              <small>{formatEgp(product.priceEgp, locale)} EGP · {product.stockQty > 0 ? (ar ? "متوفر" : "In stock") : product.dropshipEnabled ? (ar ? "حسب الطلب" : "On request") : (ar ? "غير متوفر" : "Unavailable")}</small>
            </span>
            <StoreIcon name="arrow" size={18} />
          </Link>
        )) : null}
      </div>
      <button className="el-search-overlay__all" onClick={onSearchAll} type="button">
        <span>{all}</span><StoreIcon name="arrow" size={18} />
      </button>
    </section>
  );
}

export function MegaMenu({ locale, featured, onClose }: { locale: StoreLocale; featured?: Product; onClose: () => void }) {
  const ar = locale === "ar";
  const groups = ar ? [
    ["المكونات", [["كروت الشاشة", "/catalog?q=GPU"], ["المعالجات", "/catalog?q=CPU"], ["اللوحات الأم", "/catalog?q=Motherboard"], ["RAM و SSD", "/catalog?q=SSD"], ["مزودات الطاقة", "/catalog?q=PSU"]]],
    ["الأنظمة", [["تجميعات Gaming", "/catalog?q=Gaming"], ["Creator Workstations", "/catalog?q=Creator"], ["أجهزة الشركات", "/business"], ["تجميعة مخصصة", "/business/rfq"]]],
    ["الشاشات والملحقات", [["الشاشات", "/catalog?q=Monitor"], ["كيبورد وماوس", "/catalog?q=Keyboard"], ["الصوتيات", "/catalog?q=Audio"], ["الشبكات", "/catalog?q=Networking"]]],
    ["الخدمات", [["الضمان والدعم", "/account/warranty"], ["التوصيل والتتبع", "/account/orders"], ["الصيانة", "/business"], ["مشتريات الشركات", "/business"]]],
  ] as const : [
    ["COMPONENTS", [["GPUs", "/catalog?q=GPU"], ["CPUs", "/catalog?q=CPU"], ["Motherboards", "/catalog?q=Motherboard"], ["RAM & SSD", "/catalog?q=SSD"], ["Power supplies", "/catalog?q=PSU"]]],
    ["SYSTEMS", [["Gaming builds", "/catalog?q=Gaming"], ["Creator workstations", "/catalog?q=Creator"], ["Business PCs", "/business"], ["Custom PC builder", "/business/rfq"]]],
    ["DISPLAY & GEAR", [["Monitors", "/catalog?q=Monitor"], ["Keyboards & mice", "/catalog?q=Keyboard"], ["Audio", "/catalog?q=Audio"], ["Networking", "/catalog?q=Networking"]]],
    ["SERVICES", [["Warranty & support", "/account/warranty"], ["Delivery & tracking", "/account/orders"], ["Repairs", "/business"], ["B2B procurement", "/business"]]],
  ] as const;

  return (
    <section aria-label={ar ? "قائمة الهاردوير" : "Hardware menu"} className="el-mega-menu">
      <div className="el-mega-menu__top"><p>{ar ? "تسوق الهاردوير" : "SHOP HARDWARE"}</p><button aria-label={ar ? "إغلاق" : "Close"} className="el-panel-close" onClick={onClose} type="button">×</button></div>
      <div className="el-mega-menu__grid">
        {groups.map(([title, links]) => (
          <div className="el-mega-menu__group" key={title}>
            <strong>{title}</strong>
            {links.map(([label, href]) => <Link key={label} onClick={onClose} to={href}>{label}</Link>)}
          </div>
        ))}
        <Link className="el-mega-menu__feature" onClick={onClose} to={featured ? `/products/${encodeURIComponent(featured.id)}` : "/catalog"}>
          <span>{ar ? "اختيار مميز" : "FEATURED DROP"}</span>
          <strong dir="auto">{featured?.name ?? (ar ? "اكتشف أحدث الهاردوير" : "Explore current hardware")}</strong>
          <small>{featured ? `${formatEgp(featured.priceEgp, locale)} EGP · ${featured.stockQty > 0 ? (ar ? "متوفر" : "In stock") : (ar ? "حسب الطلب" : "On request")}` : (ar ? "أسعار ومخزون من الكتالوج الحالي" : "Live catalogue pricing and availability")}</small>
          <b>{ar ? "استكشف" : "Explore"} <StoreIcon name="arrow" size={15} /></b>
        </Link>
      </div>
    </section>
  );
}

export function MobileMenu({ locale, onLocaleChange, onClose }: { locale: StoreLocale; onLocaleChange: (locale: StoreLocale) => void; onClose: () => void }) {
  const ar = locale === "ar";
  const rows = ar ? [
    ["grid", "التصنيفات", "/catalog"],
    ["package", "تجميعات PC", "/catalog?q=PC%20build"],
    ["star", "العروض", "/catalog?sort=price-asc"],
    ["clipboard", "الأعمال وطلبات الأسعار", "/business"],
    ["delivery", "تتبع الطلب", "/account/orders"],
    ["account", "حسابي", "/account"],
  ] as const : [
    ["grid", "Categories", "/catalog"],
    ["package", "PC builds", "/catalog?q=PC%20build"],
    ["star", "Deals", "/catalog?sort=price-asc"],
    ["clipboard", "Business & RFQ", "/business"],
    ["delivery", "Track order", "/account/orders"],
    ["account", "My account", "/account"],
  ] as const;

  return (
    <section aria-modal="true" className="el-mobile-menu-panel" dir={ar ? "rtl" : "ltr"} role="dialog">
      <div className="el-mobile-menu-panel__top"><span>{ar ? "القائمة" : "MENU"}</span><button aria-label={ar ? "إغلاق" : "Close"} className="el-panel-close" onClick={onClose} type="button">×</button></div>
      <nav aria-label={ar ? "القائمة الرئيسية" : "Main menu"}>
        {rows.map(([icon, label, href]) => (
          <Link key={label} onClick={onClose} to={href}>
            <span><StoreIcon name={icon === "grid" ? "filter" : icon} size={20} />{label}</span><StoreIcon name="chevron" size={18} />
          </Link>
        ))}
      </nav>
      <div className="el-mobile-menu-panel__footer">
        <button onClick={() => { onLocaleChange(ar ? "en" : "ar"); onClose(); }} type="button">{ar ? "English" : "العربية"}</button>
        <span>Egypt · EGP</span>
      </div>
    </section>
  );
}

export function MiniCart({ locale, items, loading, onClose }: { locale: StoreLocale; items: CartItem[]; loading: boolean; onClose: () => void }) {
  const ar = locale === "ar";
  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  return (
    <section aria-modal="true" className="el-mini-cart" dir={ar ? "rtl" : "ltr"} role="dialog">
      <div className="el-mini-cart__top"><h2>{ar ? `سلتك · ${count} قطعة` : `Your cart · ${count} items`}</h2><button aria-label={ar ? "إغلاق السلة" : "Close cart"} className="el-panel-close" onClick={onClose} type="button">×</button></div>
      <div className="el-mini-cart__items" aria-live="polite">
        {loading ? Array.from({ length: 3 }, (_, index) => <div className="el-mini-cart__skeleton" key={index} />) : null}
        {!loading && items.length === 0 ? <p className="el-mini-cart__empty">{ar ? "السلة فاضية دلوقتي." : "Your cart is empty."}</p> : null}
        {!loading ? items.slice(0, 3).map((item) => (
          <Link className="el-mini-cart__item" key={item.serverItemId ?? item.product.id} onClick={onClose} to={`/products/${encodeURIComponent(item.product.id)}`}>
            <span className="el-mini-cart__media"><img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={item.product.image} /></span>
            <span className="el-mini-cart__copy"><strong dir="auto">{item.product.name}</strong><small>{ar ? "الكمية" : "Qty"} {item.quantity}</small></span>
            <b>{formatEgp(item.product.priceEgp * item.quantity, locale)} EGP</b>
          </Link>
        )) : null}
      </div>
      <div className="el-mini-cart__subtotal"><span>{ar ? "الإجمالي الفرعي" : "Subtotal"}</span><strong>{formatEgp(subtotal, locale)} EGP</strong></div>
      <div className="el-mini-cart__actions"><Link className="el-surface-secondary" onClick={onClose} to="/cart">{ar ? "عرض السلة" : "View cart"}</Link><Link className="el-surface-primary" onClick={onClose} to="/checkout">{ar ? "إتمام الطلب" : "Checkout"}</Link></div>
    </section>
  );
}

export function CompareTray({ locale, products, onRemove, onCompare }: { locale: StoreLocale; products: Product[]; onRemove: (productId: string) => void; onCompare: () => void }) {
  const ar = locale === "ar";
  return (
    <aside aria-label={ar ? "قائمة المقارنة" : "Compare tray"} className="el-compare-tray" id="el-compare-tray">
      <strong>{ar ? "مقارنة" : "Compare"} · {products.length}/4</strong>
      <div className="el-compare-tray__items">
        {products.map((product) => <span className="el-compare-chip" key={product.id}><StoreIcon name="compare" size={17} /><b dir="auto">{product.name}</b><button aria-label={`${ar ? "إزالة" : "Remove"} ${product.name}`} onClick={() => onRemove(product.id)} type="button">×</button></span>)}
      </div>
      <button className="el-surface-primary" disabled={products.length < 2} onClick={onCompare} type="button">{ar ? "قارن الآن" : "Compare now"}</button>
    </aside>
  );
}

export function CompareDialog({ locale, products, onClose }: { locale: StoreLocale; products: Product[]; onClose: () => void }) {
  const ar = locale === "ar";
  const specs = Array.from(new Set(products.flatMap((product) => product.specs.slice(0, 6).map((spec) => spec.label)))).slice(0, 6);
  return (
    <section aria-modal="true" className="el-compare-dialog" dir={ar ? "rtl" : "ltr"} role="dialog">
      <div className="el-compare-dialog__top"><div><p>{ar ? "مقارنة الهاردوير" : "HARDWARE COMPARISON"}</p><h2>{ar ? "اختياراتك جنب بعض" : "Your selections, side by side"}</h2></div><button aria-label={ar ? "إغلاق المقارنة" : "Close comparison"} className="el-panel-close" onClick={onClose} type="button">×</button></div>
      <div className="el-compare-dialog__grid" style={{ "--compare-columns": products.length } as React.CSSProperties}>
        {products.map((product) => <article key={product.id}><div className="el-compare-dialog__media"><img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={product.image} /></div><h3 dir="auto">{product.name}</h3><strong>{formatEgp(product.priceEgp, locale)} EGP</strong><small>{product.stockQty > 0 ? (ar ? "متوفر" : "In stock") : product.dropshipEnabled ? (ar ? "حسب الطلب" : "On request") : (ar ? "غير متوفر" : "Unavailable")}</small></article>)}
      </div>
      <div className="el-compare-dialog__specs">
        {specs.map((label) => <div key={label}><strong dir="auto">{label}</strong>{products.map((product) => <span dir="auto" key={product.id}>{product.specs.find((spec) => spec.label === label)?.value ?? "—"}</span>)}</div>)}
      </div>
    </section>
  );
}

export type ToastTone = "success" | "error" | "info";
export type StoreToast = { tone: ToastTone; title: string; message: string };

export function FeedbackToast({ toast, onClose }: { toast: StoreToast; onClose: () => void }) {
  const icon = toast.tone === "success" ? "check" : toast.tone === "info" ? "shield" : "returns";
  return (
    <div aria-atomic="true" className={`el-feedback-toast is-${toast.tone}`} role="status">
      <span className="el-feedback-toast__icon"><StoreIcon name={icon} size={20} /></span>
      <span><strong>{toast.title}</strong><small>{toast.message}</small></span>
      <button aria-label="Close" className="el-panel-close" onClick={onClose} type="button">×</button>
    </div>
  );
}