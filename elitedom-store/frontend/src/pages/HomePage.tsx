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
    intro: "Premium PC hardware with clear Egyptian pricing, real local availability, and the technical depth when you actually need it.",
    build: "Build your PC",
    shop: "Shop GPUs",
    trust: ["Local warranty", "Secure payments", "Nationwide delivery"],
    heroStock: "Local stock",
    heroWarranty: "Local warranty",
    categories: ["GPUs", "CPUs", "Motherboards", "RAM & SSD", "Displays", "PC builds", "Peripherals", "Networking"],
    curatedEyebrow: "CURATED THIS WEEK",
    curatedTitle: "Hardware worth your attention.",
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
    b2bMetric: "devices in one procurement flow",
    loading: "Loading live catalogue…",
    unavailable: "Live catalogue is temporarily unavailable. The storefront shell is ready and will reconnect automatically on refresh.",
  },
  ar: {
    eyebrow: "ELITEDOM / أداء مختار بعناية",
    title: <>أداء قوي،<br />من غير زحمة.</>,
    intro: "هاردوير احترافي بأسعار واضحة بالجنيه المصري، توافر محلي حقيقي، والتفاصيل التقنية تظهر وقت ما تحتاجها.",
    build: "ابني جهازك",
    shop: "تسوّق كروت الشاشة",
    trust: ["ضمان محلي", "دفع آمن", "توصيل لكل المحافظات"],
    heroStock: "مخزون محلي",
    heroWarranty: "ضمان محلي",
    categories: ["كروت الشاشة", "المعالجات", "اللوحات الأم", "RAM & SSD", "الشاشات", "تجميعات PC", "الإكسسوارات", "الشبكات"],
    curatedEyebrow: "مختارات الأسبوع",
    curatedTitle: "قطع تستاهل اهتمامك.",
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
    b2bMetric: "جهاز في طلب شراء واحد",
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

  return (
    <div className="el-storefront" data-locale={locale}>
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        <main>
          <section className="el-hero" id="top">
            <div className="el-hero__copy">
              <p className="el-eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p className="el-hero__intro">{copy.intro}</p>
              <div className="el-hero__actions">
                <a className="el-primary-button" href="#outcomes">
                  <StoreIcon name="package" size={17} />
                  <span>{copy.build}</span>
                </a>
                <a className="el-outline-button" href="#curated">
                  <span>{copy.shop}</span>
                  <StoreIcon name="arrow" size={17} />
                </a>
              </div>
              <div className="el-trust-row">
                <span><StoreIcon name="warranty" size={14} />{copy.trust[0]}</span>
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
                {heroProduct ? `${heroProduct.name} · ${heroProduct.specs[0]?.value ?? heroProduct.categoryName}` : "RTX / CURATED MEDIA"}
              </span>
              <div className="el-hero__meta">
                <span><i />{copy.heroStock}</span>
                <span><i />{heroProduct ? `${heroProduct.warrantyMonths}m ${copy.heroWarranty}` : copy.heroWarranty}</span>
              </div>
            </div>
          </section>

          <section aria-label="Categories" className="el-category-rail" id="categories">
            {copy.categories.map((category, index) => (
              <a className={index === 0 ? "is-active" : undefined} href="#curated" key={category}>{category}</a>
            ))}
          </section>

          <section className="el-curated" id="curated">
            <div className="el-section-header">
              <div>
                <p className="el-eyebrow">{copy.curatedEyebrow}</p>
                <h2>{copy.curatedTitle}</h2>
              </div>
              <a href="#categories">{copy.viewAll} <StoreIcon name="arrow" size={15} /></a>
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
              <strong>50×</strong>
              <span>{copy.b2bMetric}</span>
            </div>
            <div className="el-b2b-editorial__copy">
              <p className="el-eyebrow">{copy.b2bEyebrow}</p>
              <h2>{copy.b2bTitle}</h2>
              <p>{copy.b2bText}</p>
              <Link to="/b2b">{copy.b2bCta} <StoreIcon name="arrow" size={15} /></Link>
            </div>
          </section>
        </main>

        <SocialDock />
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}
