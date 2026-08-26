import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CommerceCollectionState } from "@/components/store/CommerceCollectionState";
import { ProductCard } from "@/components/store/ProductCard";
import { CompareDialog, CompareTray } from "@/components/store/StoreExperiencePanels";
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
    crumb: "STORE / HARDWARE",
    title: "Hardware catalogue",
    intro: "Browse local-stock and orderable technology by product, brand, price and the specifications that matter.",
    search: "Search product, category, specification, brand…",
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
    products: "products",
    compare: "Compare",
    sort: "Sort products",
    recommended: "Recommended",
    priceLow: "Price: low to high",
    priceHigh: "Price: high to low",
    next: "Next",
    previous: "Previous",
    quickRtx: "RTX 50 Series",
    quickVram: "16GB+ VRAM",
    quickStock: "In stock",
    quickPrice: "Under 50K",
    quickSlot: "3-slot or less",
    resultsFor: "Results for",
    category: "Category",
  },
  ar: {
    crumb: "المتجر / الهاردوير",
    title: "كتالوج الهاردوير",
    intro: "تصفح المنتجات المتوفرة محليًا أو حسب الطلب حسب النوع والبراند والسعر والمواصفات المهمة.",
    search: "ابحث عن منتج أو فئة أو مواصفات أو براند…",
    filters: "الفلاتر",
    availability: "التوافر",
    inStock: "متوفر",
    dropship: "متاح توريد مباشر",
    price: "السعر",
    under30: "أقل من 30,000 جنيه",
    midPrice: "30,000–50,000 جنيه",
    over50: "أكثر من 50,000 جنيه",
    brand: "البراند",
    series: "سلسلة كارت الشاشة",
    products: "منتج",
    compare: "مقارنة",
    sort: "ترتيب المنتجات",
    recommended: "المقترح",
    priceLow: "السعر: من الأقل",
    priceHigh: "السعر: من الأعلى",
    next: "التالي",
    previous: "السابق",
    quickRtx: "RTX 50 Series",
    quickVram: "VRAM 16GB+",
    quickStock: "متوفر",
    quickPrice: "أقل من 50K",
    quickSlot: "3-slot أو أقل",
    resultsFor: "نتائج البحث عن",
    category: "فئة",
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

function humanizeCategory(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function paginationWindow(page: number, pageCount: number) {
  const length = Math.min(5, pageCount);
  const start = Math.max(1, Math.min(page - 2, Math.max(1, pageCount - length + 1)));
  return Array.from({ length }, (_, index) => start + index);
}

export function CatalogPage() {
  const [locale, setLocale] = useStoreLocale();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<CatalogState>({ status: "loading", products: [] });
  const [requestVersion, setRequestVersion] = useState(0);
  const [compared, setCompared] = useState<Product[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const query = params.get("q")?.trim() ?? "";
  const category = params.get("category")?.trim() ?? "";
  const copyText = copy[locale];
  const gpuContext = /gpu|graphics|rtx|radeon/i.test(`${query} ${category}`);
  const heading = query
    ? `${copyText.resultsFor} “${query}”`
    : category
      ? `${copyText.category}: ${humanizeCategory(category)}`
      : copyText.title;

  useEffect(() => {
    let active = true;
    setState((current) => ({ status: "loading", products: current.products }));
    fetchRichCatalog({
      locale,
      query: query || undefined,
      category: category || undefined,
      limit: 100,
    })
      .then((products) => {
        if (active) setState({ status: "ready", products });
      })
      .catch(() => {
        if (active) setState((current) => ({ status: "error", products: current.products }));
      });
    return () => { active = false; };
  }, [category, locale, query, requestVersion]);

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
    if (category) next.set("category", category);
    setParams(next);
  }

  function retryCatalog() {
    setState((current) => ({ status: "loading", products: current.products }));
    setRequestVersion((version) => version + 1);
  }

  function toggleCompare(product: Product) {
    setCompared((current) => {
      if (current.some((item) => item.id === product.id)) return current.filter((item) => item.id !== product.id);
      if (current.length >= 4) return current;
      return [...current, product];
    });
  }

  function openCompare() {
    if (compared.length > 0) {
      setCompareOpen(true);
      return;
    }
    document.querySelector<HTMLButtonElement>(".el-product-card__compare")?.focus();
  }

  return (
    <div className="el-commerce-page">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />

        <main>
          <section className="el-catalog-intro">
            <p className="el-commerce-crumb">{copyText.crumb}</p>
            <h1 dir="auto">{heading}</h1>
            <p>{copyText.intro}</p>
            <form className="el-catalog-search" key={query} onSubmit={submitSearch} role="search">
              <StoreIcon name="search" size={18} />
              <input aria-label={copyText.search} defaultValue={query} name="q" placeholder={copyText.search} type="search" />
            </form>
            <div className="el-quick-filters">
              {gpuContext ? <button className={params.get("series") === "rtx50" ? "is-active" : ""} onClick={() => updateParam("series", "rtx50")} type="button">{copyText.quickRtx}</button> : null}
              {gpuContext ? <button className={params.get("vram16") === "1" ? "is-active" : ""} onClick={() => updateParam("vram16", "1")} type="button">{copyText.quickVram}</button> : null}
              <button className={params.get("stock") === "1" ? "is-active" : ""} onClick={() => updateParam("stock", "1")} type="button">{copyText.quickStock}</button>
              <button className={params.get("price") === "under50" ? "is-active" : ""} onClick={() => updateParam("price", "under50")} type="button">{copyText.quickPrice}</button>
              {gpuContext ? <button className={params.get("slots3") === "1" ? "is-active" : ""} onClick={() => updateParam("slots3", "1")} type="button">{copyText.quickSlot}</button> : null}
            </div>
          </section>

          <div className="el-catalog-toolbar">
            <span>{filtered.length} {copyText.products}</span>
            <div>
              <button aria-pressed={compared.length > 0} className="el-toolbar-pill" onClick={openCompare} type="button"><StoreIcon name="compare" size={16} />{copyText.compare}{compared.length > 0 ? ` · ${compared.length}/4` : ""}</button>
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
              {gpuContext ? (
                <FilterGroup title={copyText.series}>
                  <FilterOption active={params.get("series") === "rtx50"} label="RTX 50 Series" onChange={() => updateParam("series", "rtx50")} />
                  <FilterOption active={params.get("series") === "rtx40"} label="RTX 40 Series" onChange={() => updateParam("series", "rtx40")} />
                  <FilterOption active={params.get("series") === "rx9000"} label="Radeon RX 9000" onChange={() => updateParam("series", "rx9000")} />
                </FilterGroup>
              ) : null}
            </aside>

            <section className="el-catalog-results">
              {state.status === "loading" ? <CommerceCollectionState locale={locale} state="loading" /> : null}
              {state.status === "error" ? <CommerceCollectionState locale={locale} onAction={retryCatalog} state="error" /> : null}
              {state.status === "ready" && visibleProducts.length === 0 ? <CommerceCollectionState locale={locale} onAction={resetFilters} state="empty" /> : null}
              {state.status === "ready" && visibleProducts.length > 0 ? (
                <div className="el-catalog-grid">
                  {visibleProducts.map((product) => <ProductCard compareSelected={compared.some((item) => item.id === product.id)} key={product.id} locale={locale} onCompareToggle={() => toggleCompare(product)} product={product} />)}
                </div>
              ) : null}

              {state.status === "ready" && filtered.length > PAGE_SIZE ? (
                <nav aria-label={locale === "ar" ? "صفحات المنتجات" : "Product pages"} className="el-pagination">
                  <button disabled={page === 1} onClick={() => updatePage(params, setParams, page - 1)} type="button">{copyText.previous}</button>
                  {paginationWindow(page, pageCount).map((number) => (
                    <button aria-current={number === page ? "page" : undefined} className={number === page ? "is-active" : ""} key={number} onClick={() => updatePage(params, setParams, number)} type="button">{number}</button>
                  ))}
                  <button disabled={page === pageCount} onClick={() => updatePage(params, setParams, page + 1)} type="button">{copyText.next} <StoreIcon name="arrow" size={14} /></button>
                </nav>
              ) : null}
            </section>
          </div>
        </main>

        <StoreFooter locale={locale} />
      </div>

      {compared.length > 0 ? <CompareTray locale={locale} onCompare={() => setCompareOpen(true)} onRemove={(productId) => setCompared((current) => current.filter((item) => item.id !== productId))} products={compared} /> : null}
      {compareOpen ? <div className="el-store-layer is-compare" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompareOpen(false); }}><CompareDialog locale={locale} onClose={() => setCompareOpen(false)} products={compared} /></div> : null}
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
