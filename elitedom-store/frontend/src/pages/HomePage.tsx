import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "@/components/store/ProductCard";
import { SocialDock } from "@/components/store/SocialDock";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader, type StoreLocale } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { fetchRichCatalog } from "@/lib/catalog-api";
import type { Product } from "@/types/store";
import "@/styles/storefront.css";

const content = {
  en: {
    eyebrow: "ELITEDOM / CURATED PERFORMANCE",
    title: <>Performance,<br />without the noise.</>,
    mobileTitle: <>Build your PC,<br />your way.</>,
    intro: "PC hardware with clear Egyptian pricing, live availability states, and the technical detail you need to compare confidently.",
    mobileIntro: "Clear pricing, live availability and useful technical detail.",
    build: "Shop all hardware",
    shop: "View featured product",
    trust: ["Live availability", "Card, wallet or cash", "Arabic & English storefront"],
    heroStock: "Local stock",
    heroWarranty: "Local warranty",
    categories: [
      ["GPUs", "/catalog?q=GPU"],
      ["CPUs", "/catalog?q=CPU"],
      ["Motherboards", "/catalog?q=Motherboard"],
      ["RAM & SSD", "/catalog?q=RAM%20SSD"],
      ["Displays", "/catalog?q=Monitor"],
      ["PC builds", "/catalog?q=PC%20build"],
      ["Peripherals", "/catalog?q=Peripheral"],
      ["Networking", "/catalog?q=Networking"],
    ],
    curatedEyebrow: "CURATED THIS WEEK",
    curatedTitle: "Hardware worth your attention.",
    mobileCuratedTitle: "Good places to start.",
    mobileCuratedIntro: "The essentials first. Full technical depth stays inside each product.",
    viewAll: "View all hardware",
    outcomeTitle: "Shop by what you want to do.",
    outcomes: [
      ["01", "Gaming hardware", "Compare graphics, processors and displays by the specifications that matter."],
      ["02", "Creator setups", "Discover components, fast storage and displays for production workflows."],
      ["03", "Business hardware", "Build an RFQ for workstations, networking and procurement requirements."],
    ],
    b2bEyebrow: "FOR TEAMS & BUSINESS",
    b2bTitle: "Procure hardware without the spreadsheet chaos.",
    b2bText: "RFQ workflows, bulk pricing, workstations, networking, tracked fulfilment and one accountable partner.",
    b2bCta: "Request a business quote",
    b2bMetric: "for a complete procurement request",
    loading: "Loading live catalogue…",
    unavailable: "Live catalogue is temporarily unavailable. The storefront shell is ready and will reconnect automatically on refresh.",
  },
  ar: {
    eyebrow: "ELITEDOM / أداء مختار بعناية",
    title: <>أداء قوي،<br />من غير زحمة.</>,
    mobileTitle: <>ابني جهازك<br />على مزاجك.</>,
    intro: "هاردوير بأسعار واضحة بالجنيه المصري، وحالة توافر محدثة، وتفاصيل تقنية تساعدك تقارن بثقة.",
    mobileIntro: "أسعار واضحة، حالة توافر محدثة، ومواصفات مفيدة.",
    build: "تسوق كل الهاردوير",
    shop: "شوف المنتج المختار",
    trust: ["حالة توافر واضحة", "بطاقة أو محفظة أو كاش", "متجر عربي وإنجليزي"],
    heroStock: "مخزون محلي",
    heroWarranty: "ضمان محلي",
    categories: [
      ["كروت الشاشة", "/catalog?q=GPU"],
      ["المعالجات", "/catalog?q=CPU"],
      ["اللوحات الأم", "/catalog?q=Motherboard"],
      ["RAM & SSD", "/catalog?q=RAM%20SSD"],
      ["الشاشات", "/catalog?q=Monitor"],
      ["تجميعات PC", "/catalog?q=PC%20build"],
      ["الإكسسوارات", "/catalog?q=Peripheral"],
      ["الشبكات", "/catalog?q=Networking"],
    ],
    curatedEyebrow: "مختارات الأسبوع",
    curatedTitle: "قطع تستاهل اهتمامك.",
    mobileCuratedTitle: "اختيارات تستاهل تبدأ منها",
    mobileCuratedIntro: "المهم بس في الأول، والتفاصيل الكاملة جوه المنتج.",
    viewAll: "عرض كل المنتجات",
    outcomeTitle: "اختار حسب استخدامك.",
    outcomes: [
      ["01", "هاردوير الألعاب", "قارن كروت الشاشة والمعالجات والشاشات بالمواصفات المهمة فعلًا."],
      ["02", "تجهيز صُنّاع المحتوى", "اكتشف القطع والتخزين السريع والشاشات المناسبة لشغلك."],
      ["03", "هاردوير الشركات", "جهّز طلب عرض سعر لمحطات العمل والشبكات واحتياجات التوريد."],
    ],
    b2bEyebrow: "للفرق والشركات",
    b2bTitle: "جهّز احتياجات شركتك من غير دوشة الجداول.",
    b2bText: "RFQ، تسعير كميات، Workstations وNetworking، مع متابعة توريد واضحة وشريك واحد مسؤول.",
    b2bCta: "اطلب عرض سعر للشركات",
    b2bMetric: "لطلب توريد كامل في مكان واحد",
    loading: "بنحمّل الكتالوج المباشر…",
    unavailable: "الكتالوج المباشر غير متاح مؤقتًا. واجهة المتجر جاهزة وهتحاول الاتصال تاني مع تحديث الصفحة.",
  },
} as const;

function formatEgp(value: number, locale: StoreLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value);
}

export function HomePage() {
  const [locale, setLocale] = useState<StoreLocale>(() => {
    const saved = window.localStorage.getItem("elitedom-locale");
    return saved === "ar" ? "ar" : "en";
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.localStorage.setItem("elitedom-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    let active = true;
    fetchRichCatalog({ locale, limit: 100 })
      .then((catalog) => {
        if (!active) return;
        setProducts(catalog);
        setCatalogError(false);
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setCatalogError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [locale]);

  const copy = content[locale];
  const heroProduct = useMemo(() => {
    const featured = products.filter((product) => product.featured);
    return featured.find((product) => product.stockQty > 0)
      ?? featured.find((product) => product.dropshipEnabled)
      ?? featured[0]
      ?? products.find((product) => product.stockQty > 0)
      ?? products[0];
  }, [products]);
  const curatedProducts = useMemo(() => {
    const featured = products.filter((product) => product.featured && product.id !== heroProduct?.id);
    const fallback = products.filter((product) => product.id !== heroProduct?.id);
    return [...featured, ...fallback.filter((product) => !featured.some((item) => item.id === product.id))].slice(0, 3);
  }, [heroProduct?.id, products]);
  const liveCategories = useMemo(() => {
    const unique = new Map<string, string>();
    products.forEach((product) => {
      if (product.category !== "uncategorized" && !unique.has(product.category)) unique.set(product.category, product.categoryName);
    });
    return unique.size > 0
      ? [...unique.entries()].slice(0, 8).map(([slug, label]) => [label, `/catalog?category=${encodeURIComponent(slug)}`] as const)
      : copy.categories;
  }, [copy.categories, products]);
  const mobileCategories = liveCategories.slice(0, 5);

  const heroActions = (
    <>
      <Link className="el-primary-button" to="/catalog">
        <span>{copy.build}</span>
        <StoreIcon name="package" size={17} />
      </Link>
      <Link className="el-outline-button" to={heroProduct ? `/products/${encodeURIComponent(heroProduct.id)}` : "/catalog"}>
        <span>{copy.shop}</span>
        <StoreIcon name="arrow" size={17} />
      </Link>
    </>
  );

  return (
    <div className="el-storefront" data-locale={locale}>
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        <main>
          <section className="el-hero" id="top">
            <div className="el-hero__copy">
              <p className="el-eyebrow">{copy.eyebrow}</p>
              <h1 className="el-hero__title el-hero__title--desktop">{copy.title}</h1>
              <h1 className="el-hero__title el-hero__title--mobile">{copy.mobileTitle}</h1>
              <p className="el-hero__intro el-hero__intro--desktop">{copy.intro}</p>
              <p className="el-hero__intro el-hero__intro--mobile">{copy.mobileIntro}</p>
              <div className="el-hero__actions el-hero__actions--desktop">{heroActions}</div>
              <div className="el-trust-row el-trust-row--desktop">
                <span><StoreIcon name="check" size={14} />{copy.trust[0]}</span>
                <span><StoreIcon name="payment" size={14} />{copy.trust[1]}</span>
                <span><StoreIcon name="delivery" size={14} />{copy.trust[2]}</span>
              </div>
            </div>

            <div className="el-hero__stage">
              <div className="el-hero__ambient" />
              {heroProduct ? (
                <img
                  alt={heroProduct.name}
                  className="el-hero__product"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                    event.currentTarget.parentElement?.classList.add("is-media-unavailable");
                  }}
                  src={heroProduct.image}
                />
              ) : (
                <div className="el-hero__media-placeholder" aria-hidden="true" />
              )}
              <span className="el-hero__spec">
                {heroProduct ? `${heroProduct.name} · ${heroProduct.specs[0]?.value ?? heroProduct.categoryName}` : "CURATED HARDWARE"}
              </span>
              <div className="el-hero__meta">
                <span><i />{heroProduct?.stockQty ? copy.heroStock : heroProduct?.dropshipEnabled ? (locale === "ar" ? "حسب الطلب" : "On request") : (locale === "ar" ? "تحقق من التوافر" : "Check availability")}</span>
                {heroProduct && heroProduct.warrantyMonths > 0 ? <span><i />{heroProduct.warrantyMonths}m {copy.heroWarranty}</span> : null}
              </div>
              {heroProduct ? <Link className="el-hero__commerce" to={`/products/${encodeURIComponent(heroProduct.id)}`}><span><small>{locale === "ar" ? "المنتج المختار" : "Featured product"}</small><strong dir="auto">{heroProduct.name}</strong></span><b dir="ltr">{formatEgp(heroProduct.priceEgp, locale)} EGP</b></Link> : null}
            </div>

            <div className="el-hero__actions el-hero__actions--mobile">{heroActions}</div>
          </section>

          <section aria-label={locale === "ar" ? "فئات المنتجات" : "Product categories"} className="el-category-rail el-category-rail--desktop" id="categories">
            {liveCategories.map(([category, href], index) => (
              <Link className={index === 0 ? "is-active" : undefined} key={category} to={href}>{category}</Link>
            ))}
          </section>

          <section aria-label={locale === "ar" ? "فئات المنتجات على الموبايل" : "Mobile product categories"} className="el-category-rail el-category-rail--mobile">
            {mobileCategories.map(([category, href], index) => (
              <Link className={index === 0 ? "is-active" : undefined} key={category} to={href}>{category}</Link>
            ))}
          </section>

          <section className="el-curated" id="curated">
            <div className="el-section-header">
              <div>
                <p className="el-eyebrow el-curated__desktop-only">{copy.curatedEyebrow}</p>
                <h2 className="el-curated__desktop-only">{copy.curatedTitle}</h2>
                <h2 className="el-curated__mobile-title">{copy.mobileCuratedTitle}</h2>
                <p className="el-curated__mobile-intro">{copy.mobileCuratedIntro}</p>
              </div>
              <Link className="el-curated__desktop-only" to="/catalog">{copy.viewAll} <StoreIcon name="arrow" size={15} /></Link>
            </div>

            {loading ? <div className="el-data-state">{copy.loading}</div> : null}
            {!loading && catalogError ? <div className="el-data-state el-data-state--warning">{copy.unavailable}</div> : null}
            {!loading && curatedProducts.length > 0 ? (
              <div className="el-product-rail">
                {curatedProducts.map((product) => <ProductCard key={product.id} locale={locale} product={product} />)}
              </div>
            ) : null}
          </section>

          <section className="el-outcomes" id="outcomes">
            <h2>{copy.outcomeTitle}</h2>
            <div className="el-outcome-grid">
              {copy.outcomes.map(([number, title, description]) => (
                <article className="el-outcome-card" key={number}>
                  <span className="el-outcome-card__accent" />
                  <span className="el-outcome-card__number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="el-b2b-editorial">
            <div className="el-b2b-editorial__metric">
              <strong>1 RFQ</strong>
              <span>{copy.b2bMetric}</span>
            </div>
            <div className="el-b2b-editorial__copy">
              <p className="el-eyebrow">{copy.b2bEyebrow}</p>
              <h2>{copy.b2bTitle}</h2>
              <p>{copy.b2bText}</p>
              <Link to="/business">{copy.b2bCta} <StoreIcon name="arrow" size={15} /></Link>
            </div>
          </section>
        </main>

        <SocialDock locale={locale} />
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}