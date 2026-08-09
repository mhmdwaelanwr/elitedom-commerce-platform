import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { fetchRichCatalog } from "@/lib/catalog-api";
import type { Product } from "@/types/store";
import "@/styles/commerce.css";

const PAGE_SIZE = 6;

type CatalogState =
  | { status: "loading"; products: Product[] }
  | { status: "ready"; products: Product[] }
  | { status: "error"; products: Product[] };

const copy = {
  en: {
    crumb: "STORE / COMPONENTS / GPUS",
    title: "Graphics cards",
    intro: "Find the right GPU by workload first, then reveal the technical depth you need.",
    search: "Search GPU, chipset, VRAM, brand…",
    filters: "FILTERS",
    availability: "Availability",
    inStock: "In stock",
    dropship: "Dropship available",
    price: "Price",
    under30: "Under 30,000 EGP",
    midPrice: "30,000–50,000 EGP",
    over50: "50,000+ EGP",
    brand: "Brand",
    series: "GPU series",
    advanced: "Advanced specifications",
    products: "products",
    compare: "Compare",
    sort: "Sort products",
    recommended: "Recommended",
    priceLow: "Price: low to high",
    priceHigh: "Price: high to low",
    noResults: "No products match this search and filter combination.",
    clear: "Clear filters",
    error: "The catalogue could not be loaded. Your query is preserved.",
    retry: "Retry",
    next: "Next",
    previous: "Previous",
    quickRtx: "RTX 50 Series",
    quickVram: "16GB+ VRAM",
    quickStock: "In stock",
    quickPrice: "Under 50K",
    quickSlot: "3-slot or less",
  },
  ar: {
    crumb: "المتجر / المكونات / كروت الشاشة",
    title: "كروت الشاشة",
    intro: "اختار حسب استخدامك الأول، وبعدها افتح التفاصيل التقنية اللي تهمك بس.",
    search: "ابحث عن GPU أو VRAM أو براند…",
    filters: "الفلاتر",
    availability: "التوافر",
    inStock: "متوفر",
    dropship: "متاح توريد مباشر",
    price: "السعر",
    under30: "أقل من 30,000 جنيه",
    midPrice: "30,000–50,000 جنيه",
    over50: "أكثر من 50,000 جنيه",
    brand: "البراند",
    series: "السلسلة",
    advanced: "مواصفات متقدمة",
    products: "منتج",
    compare: "مقارنة",
    sort: "ترتيب المنتجات",
    recommended: "المقترح",
    priceLow: "السعر: من الأقل",
    priceHigh: "السعر: من الأعلى",
    noResults: "مفيش منتجات مطابقة للبحث والفلاتر الحالية.",
    clear: "امسح الفلاتر",
    error: "تعذر تحميل الكتالوج. البحث الحالي محفوظ.",
    retry: "حاول تاني",
    next: "التالي",
    previous: "السابق",
    quickRtx: "RTX 50 Series",
    quickVram: "VRAM 16GB+",
    quickStock: "متوفر",
    quickPrice: "أقل من 50K",
    quickSlot: "3-slot أو أقل",
  },
} as const;

function specText(product: Product) {
  return product.specs.map((spec) => `${spec.label} ${spec.value}`).join(" ").toLowerCase();
}

function hasAtLeast16Gb(product: Product) {
  return product.specs.some((spec) => /(?:^|\s)(1[6-9]|[2-9]\d)\s*gb/i.test(spec.value));
}

function isThreeSlotOrLess(product: Product) {
  const slot = product.specs.find((spec) => /slot/i.test(`${spec.label} ${spec.code ?? ""}`));
  if (!slot) return false;
  const value = Number.parseFloat(slot.value);
  return Number.isFinite(value) && value <= 3;
}

export function CatalogPage() {
  const [locale, setLocale] = useStoreLocale();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<CatalogState>({ status: "loading", products: [] });
  const query = params.get("q")?.trim() ?? "";
  const copyText = copy[locale];

  useEffect(() => {
    let active = true;
    fetchRichCatalog({ locale, query: query || undefined, limit: 100 })
      .then((products) => {
        if (active) setState({ status: "ready", products });
      })
      .catch(() => {
        if (active) setState((current) => ({ status: "error", products: current.products }));
      });
    return () => { active = false; };
  }, [locale, query]);

  const brands = useMemo(
    () => [...new Set(state.products.map((product) => product.brand).filter(Boolean))].slice(0, 8),
    [state.products],
  );

  const filtered = useMemo(() => {
    const price = params.get("price");
    const brand = params.get("brand");
    const series = params.get("series");
    const stock = params.get("stock") === "1";
    const dropship = params.get("dropship") === "1";
    const vram16 = params.get("vram16") === "1";
    const slots3 = params.get("slots3") === "1";
    const sort = params.get("sort") ?? "recommended";

    const result = state.products.filter((product) => {
      if (stock && product.stockQty <= 0) return false;
      if (dropship && !product.dropshipEnabled) return false;
      if (brand && product.brand !== brand) return false;
      if (price === "under30" && product.priceEgp >= 30000) return false;
      if (price === "30to50" && (product.priceEgp < 30000 || product.priceEgp > 50000)) return false;
      if (price === "over50" && product.priceEgp <= 50000) return false;
      if (price === "under50" && product.priceEgp >= 50000) return false;
      const haystack = `${product.name} ${product.brand} ${specText(product)}`.toLowerCase();
      if (series === "rtx50" && !/rtx\s*50/i.test(haystack)) return false;
      if (series === "rtx40" && !/rtx\s*40/i.test(haystack)) return false;
      if (series === "rx9000" && !/rx\s*9\d{3}/i.test(haystack)) return false;
      if (vram16 && !hasAtLeast16Gb(product)) return false;
      if (slots3 && !isThreeSlotOrLess(product)) return false;
      return true;
    });

    if (sort === "price-asc") result.sort((a, b) => a.priceEgp - b.priceEgp);
    if (sort === "price-desc") result.sort((a, b) => b.priceEgp - a.priceEgp);
    return result;
  }, [params, state.products]);

  const requestedPage = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleProducts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateParam(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    setParams(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(params);
    const value = String(form.get("q") ?? "").trim();
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setParams(next);
  }

  function resetFilters() {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    setParams(next);
  }

  return (
    <div className="el-commerce-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        <main>
          <section className="el-catalog-intro">
            <p className="el-commerce-crumb">{copyText.crumb}</p>
            <h1>{copyText.title}</h1>
            <p>{copyText.intro}</p>
            <form className="el-catalog-search" key={query} onSubmit={submitSearch} role="search">
              <StoreIcon name="search" size={18} />
              <input aria-label={copyText.search} defaultValue={query} name="q" placeholder={copyText.search} type="search" />
            </form>
            <div className="el-quick-filters">
              <button className={params.get("series") === "rtx50" ? "is-active" : ""} onClick={() => updateParam("series", "rtx50")} type="button">{copyText.quickRtx}</button>
              <button className={params.get("vram16") === "1" ? "is-active" : ""} onClick={() => updateParam("vram16", "1")} type="button">{copyText.quickVram}</button>
              <button className={params.get("stock") === "1" ? "is-active" : ""} onClick={() => updateParam("stock", "1")} type="button">{copyText.quickStock}</button>
              <button className={params.get("price") === "under50" ? "is-active" : ""} onClick={() => updateParam("price", "under50")} type="button">{copyText.quickPrice}</button>
              <button className={params.get("slots3") === "1" ? "is-active" : ""} onClick={() => updateParam("slots3", "1")} type="button">{copyText.quickSlot}</button>
            </div>
          </section>

          <div className="el-catalog-toolbar">
            <span>{filtered.length} {copyText.products}</span>
            <div>
              <button aria-disabled="true" className="el-toolbar-pill" type="button"><StoreIcon name="compare" size={16} />{copyText.compare}</button>
              <label className="el-toolbar-pill">
                <StoreIcon name="sort" size={16} />
                <select aria-label={copyText.sort} onChange={(event) => updateParam("sort", event.target.value)} value={params.get("sort") ?? "recommended"}>
                  <option value="recommended">{copyText.recommended}</option>
                  <option value="price-asc">{copyText.priceLow}</option>
                  <option value="price-desc">{copyText.priceHigh}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="el-catalog-layout">
            <aside className="el-filter-rail">
              <h2><StoreIcon name="filter" size={15} />{copyText.filters}</h2>
              <FilterGroup title={copyText.availability}>
                <FilterOption active={params.get("stock") === "1"} label={copyText.inStock} onChange={() => updateParam("stock", "1")} />
                <FilterOption active={params.get("dropship") === "1"} label={copyText.dropship} onChange={() => updateParam("dropship", "1")} />
              </FilterGroup>
              <FilterGroup title={copyText.price}>
                <FilterOption active={params.get("price") === "under30"} label={copyText.under30} onChange={() => updateParam("price", "under30")} />
                <FilterOption active={params.get("price") === "30to50"} label={copyText.midPrice} onChange={() => updateParam("price", "30to50")} />
                <FilterOption active={params.get("price") === "over50"} label={copyText.over50} onChange={() => updateParam("price", "over50")} />
              </FilterGroup>
              <FilterGroup title={copyText.brand}>
                {brands.map((brand) => <FilterOption active={params.get("brand") === brand} key={brand} label={brand} onChange={() => updateParam("brand", brand)} />)}
              </FilterGroup>
              <FilterGroup title={copyText.series}>
                <FilterOption active={params.get("series") === "rtx50"} label="RTX 50 Series" onChange={() => updateParam("series", "rtx50")} />
                <FilterOption active={params.get("series") === "rtx40"} label="RTX 40 Series" onChange={() => updateParam("series", "rtx40")} />
                <FilterOption active={params.get("series") === "rx9000"} label="Radeon RX 9000" onChange={() => updateParam("series", "rx9000")} />
              </FilterGroup>
              <button className="el-advanced-filter" type="button">+ {copyText.advanced}</button>
            </aside>

            <section className="el-catalog-results">
              {state.status === "loading" ? <CatalogSkeleton /> : null}
              {state.status === "error" ? (
                <div className="el-collection-state">
                  <StoreIcon name="returns" size={28} />
                  <h2>{copyText.error}</h2>
                  <button onClick={() => window.location.reload()} type="button">{copyText.retry}</button>
                </div>
              ) : null}
              {state.status === "ready" && visibleProducts.length === 0 ? (
                <div className="el-collection-state">
                  <StoreIcon name="search" size={28} />
                  <h2>{copyText.noResults}</h2>
                  <button onClick={resetFilters} type="button">{copyText.clear}</button>
                </div>
              ) : null}
              {state.status === "ready" && visibleProducts.length > 0 ? (
                <div className="el-catalog-grid">
                  {visibleProducts.map((product) => <ProductCard key={product.id} locale={locale} product={product} />)}
                </div>
              ) : null}

              {state.status === "ready" && filtered.length > PAGE_SIZE ? (
                <nav aria-label="Pagination" className="el-pagination">
                  <button disabled={page === 1} onClick={() => updatePage(params, setParams, page - 1)} type="button">{copyText.previous}</button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((number) => (
                    <button className={number === page ? "is-active" : ""} key={number} onClick={() => updatePage(params, setParams, number)} type="button">{number}</button>
                  ))}
                  <button disabled={page === pageCount} onClick={() => updatePage(params, setParams, page + 1)} type="button">{copyText.next} <StoreIcon name="arrow" size={14} /></button>
                </nav>
              ) : null}
            </section>
          </div>
        </main>

        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

type FilterGroupProps = { title: string; children: React.ReactNode };
function FilterGroup({ title, children }: FilterGroupProps) {
  return <section className="el-filter-group"><h3>{title}</h3>{children}</section>;
}

function FilterOption({ active, label, onChange }: { active: boolean; label: string; onChange: () => void }) {
  return (
    <label className="el-filter-option">
      <input checked={active} onChange={onChange} type="checkbox" />
      <span aria-hidden="true" />
      {label}
    </label>
  );
}

function CatalogSkeleton() {
  return <div aria-label="Loading products" className="el-catalog-grid">{Array.from({ length: 6 }, (_, index) => <div className="el-product-skeleton" key={index} />)}</div>;
}

function updatePage(
  params: URLSearchParams,
  setParams: ReturnType<typeof useSearchParams>[1],
  page: number,
) {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  setParams(next);
  window.scrollTo({ top: 360, behavior: "smooth" });
}
