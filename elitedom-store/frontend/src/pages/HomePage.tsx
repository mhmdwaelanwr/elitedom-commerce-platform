import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "@/components/store/ProductCard";
import { SocialDock } from "@/components/store/SocialDock";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader, type StoreLocale } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { fetchCatalog } from "@/lib/api";
import type { Product } from "@/types/store";
import "@/styles/storefront.css";

const content = {
  en: {
    eyebrow: "ELITEDOM / CURATED PERFORMANCE",
    title: <>Performance,<br />without the noise.</>,
    mobileTitle: <>Build your PC,<br />your way.</>,
    intro: "Premium PC hardware with clear Egyptian pricing, real local availability, and the technical depth when you actually need it.",
    mobileIntro: "Original hardware, clear pricing, and technical detail exactly when you need it.",
    build: "Shop all hardware",
    shop: "Shop GPUs",
    trust: ["Local warranty", "Secure payments", "Nationwide delivery"],
    heroStock: "Local stock",
    heroWarranty: "Local warranty",
    heroProof: [["EGP", "Clear local pricing"], ["24–48h", "Cairo dispatch"], ["1:1", "Build guidance"]],
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
    mobileCategories: [
      ["GPU", "/catalog?q=GPU"],
      ["CPU", "/catalog?q=CPU"],
      ["PC builds", "/catalog?q=PC%20build"],
      ["SSD", "/catalog?q=SSD"],
      ["Displays", "/catalog?q=Monitor"],
    ],
    curatedEyebrow: "CURATED THIS WEEK",
    curatedTitle: "Hardware worth your attention.",
    mobileCuratedTitle: "Good places to start.",
    mobileCuratedIntro: "The essentials first. Full technical depth stays inside each product.",
    viewAll: "View all hardware",
    outcomeTitle: "Shop by what you want to do.",
    outcomes: [
      ["01", "4K gaming", "High-refresh builds around RTX 50 Series", "144+ FPS"],
      ["02", "Creator setup", "GPU acceleration, fast scratch, accurate displays", "Studio ready"],
      ["03", "Workstations", "Reliability, ECC options and procurement support", "B2B support"],
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
    intro: "هاردوير احترافي بأسعار واضحة بالجنيه المصري، توافر محلي حقيقي، والتفاصيل التقنية تظهر وقت ما تحتاجها.",
    mobileIntro: "قطع أصلية، أسعار واضحة، وتفاصيل تقنية تظهر وقت ما تحتاجها.",
    build: "تسوق كل الهاردوير",
    shop: "تسوق كروت الشاشة",
    trust: ["ضمان محلي", "دفع آمن", "توصيل لكل المحافظات"],
    heroStock: "مخزون محلي",
    heroWarranty: "ضمان محلي",
    heroProof: [["EGP", "تسعير محلي واضح"], ["24–48h", "شحن القاهرة"], ["1:1", "مساعدة في التجميع"]],
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
    mobileCategories: [
      ["GPU", "/catalog?q=GPU"],
      ["CPU", "/catalog?q=CPU"],
      ["تجميعات PC", "/catalog?q=PC%20build"],
      ["SSD", "/catalog?q=SSD"],
      ["شاشات", "/catalog?q=Monitor"],
    ],
    curatedEyebrow: "مختارات الأسبوع",
    curatedTitle: "قطع تستاهل اهتمامك.",
    mobileCuratedTitle: "اختيارات تستاهل تبدأ منها",
    mobileCuratedIntro: "المهم بس في الأول، والتفاصيل الكاملة جوه المنتج.",
    viewAll: "عرض كل المنتجات",
    outcomeTitle: "اختار حسب استخدامك.",
    outcomes: [
      ["01", "ألعاب 4K", "تجميعات High-refresh مبنية حوالين RTX 50 Series", "144+ FPS"],
      ["02", "تجهيز صُنّاع المحتوى", "تسريع GPU، تخزين سريع، وشاشات دقيقة", "جاهز للاستوديو"],
      ["03", "محطات عمل", "اعتمادية، خيارات ECC، ودعم توريد للشركات", "دعم للشركات"],
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
    fetchCatalog()
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
  }, []);

  const copy = content[locale];
  const heroProduct = useMemo(
    () => products.find((product) => /5080/i.test(product.name)) ?? products[0],
    [products],
  );
  const curatedProducts = useMemo(() => {
    if (products.length <= 3) return products;
    const preferred = products.filter((product) => /5080|5070|9070/i.test(product.name));
    return (preferred.length >= 3 ? preferred : products).slice(0, 3);
  }, [products]);

  const heroActions = (
    <>
      <Link className="el-primary-button" to="/catalog">
        <span>{copy.build}</span>
        <StoreIcon name="package" size={17} />
      </Link>
      <Link className="el-outline-button" to="/catalog?q=GPU">
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
                <span><StoreIcon name="warranty" size={14} />{copy.trust[0]}</span>
                <span><StoreIcon name="payment" size={14} />{copy.trust[1]}</span>
                <span><StoreIcon name="delivery" size={14} />{copy.trust[2]}</span>
              </div>
              <div aria-label={locale === "ar" ? "مميزات Elitedom" : "Why Elitedom"} className="el-hero__proof el-hero__proof--desktop">
                {copy.heroProof.map(([value, label]) => (
                  <span key={label}><strong>{value}</strong><small>{label}</small></span>
                ))}
              </div>
            </div>

            <div className="el-hero__stage">
              <div className="el-hero__ambient" />
              <span className="el-hero__index" aria-hidden="true">EL / 01</span>
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
                <span><i />{copy.heroStock}</span>
                <span><i />{heroProduct ? `${heroProduct.warrantyMonths}m ${copy.heroWarranty}` : copy.heroWarranty}</span>
              </div>
              <span className="el-hero__quality" aria-hidden="true"><b /> PERFORMANCE VERIFIED</span>
            </div>

            <div className="el-hero__actions el-hero__actions--mobile">{heroActions}</div>
          </section>

          <section aria-label={locale === "ar" ? "فئات المنتجات" : "Product categories"} className="el-category-rail el-category-rail--desktop" id="categories">
            {copy.categories.map(([category, href], index) => (
              <Link className={index === 0 ? "is-active" : undefined} key={category} to={href}>{category}</Link>
            ))}
          </section>

          <section aria-label={locale === "ar" ? "فئات المنتجات على الموبايل" : "Mobile product categories"} className="el-category-rail el-category-rail--mobile">
            {copy.mobileCategories.map(([category, href], index) => (
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
              {copy.outcomes.map(([number, title, description, metric]) => (
                <article className="el-outcome-card" key={number}>
                  <span className="el-outcome-card__accent" />
                  <span className="el-outcome-card__number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <strong>{metric}</strong>
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
