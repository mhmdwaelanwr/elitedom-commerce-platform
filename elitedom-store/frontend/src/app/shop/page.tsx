"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { fetchRichCatalog, fetchRichCategories } from "@/lib/catalog-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Category, CategorySlug, Product } from "@/types/store";

type SortOption = "featured" | "price-low" | "price-high" | "stock";
type ViewMode = "grid" | "list";
type SpecFilter = { key: string; label: string; value: string };

const PAGE_SIZE = 12;

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopLoadingFallback />}>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = usePreferences();
  const requestedQuery = searchParams.get("q") ?? "";
  const requestedCategory = searchParams.get("category") as CategorySlug | null;

  const [query, setQuery] = useState(requestedQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setQuery(requestedQuery);
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchRichCatalog({
        locale,
        query: requestedQuery || undefined,
        category: requestedCategory || undefined,
        limit: 120,
      }),
      fetchRichCategories(locale),
    ])
      .then(([nextProducts, nextCategories]) => {
        if (!active) return;
        setProducts(nextProducts);
        setCategories(nextCategories);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setProducts([]);
        setCategories([]);
        setError(reason instanceof Error ? reason.message : t("storefront", "catalogueLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [locale, requestedCategory, requestedQuery, t]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const categoryNames = useMemo(
    () => Object.fromEntries(flatCategories.map((category) => [category.slug, category.name])),
    [flatCategories],
  );
  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)),
    [locale, products],
  );
  const technicalFilters = useMemo(() => buildTechnicalFilters(products, locale), [locale, products]);

  const visibleProducts = useMemo(() => {
    const minimum = parsePrice(minPrice);
    const maximum = parsePrice(maxPrice);
    const filtered = products
      .filter((product) => !onlyAvailable || product.stockQty > 0 || product.dropshipEnabled)
      .filter((product) => selectedBrands.length === 0 || selectedBrands.includes(product.brand))
      .filter((product) => minimum === null || product.priceEgp >= minimum)
      .filter((product) => maximum === null || product.priceEgp <= maximum)
      .filter((product) =>
        selectedSpecs.length === 0 ||
        selectedSpecs.every((selected) => product.specs.some((spec) => specKey(spec.label, spec.code, spec.value) === selected)),
      );

    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.priceEgp - b.priceEgp;
      if (sort === "price-high") return b.priceEgp - a.priceEgp;
      if (sort === "stock") return Number(b.stockQty > 0) - Number(a.stockQty > 0) || b.stockQty - a.stockQty;
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [maxPrice, minPrice, onlyAvailable, products, selectedBrands, selectedSpecs, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginated = visibleProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const requestedCategoryName = requestedCategory ? categoryNames[requestedCategory] : undefined;
  const pageTitle = requestedQuery
    ? `${t("storefront", "resultsFor")} “${requestedQuery}”`
    : requestedCategoryName ?? t("storefront", "everythingWeStock");
  const activeFilterCount =
    Number(onlyAvailable) + selectedBrands.length + selectedSpecs.length + Number(Boolean(minPrice)) + Number(Boolean(maxPrice));

  function pushSearch(next: { query?: string; category?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = next.query === undefined ? requestedQuery : next.query;
    const nextCategory = next.category === undefined ? requestedCategory : next.category;
    if (nextQuery?.trim()) params.set("q", nextQuery.trim()); else params.delete("q");
    if (nextCategory) params.set("category", nextCategory); else params.delete("category");
    setPage(1);
    router.push(`/shop${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function resetLocalFilters() {
    setOnlyAvailable(false);
    setSelectedBrands([]);
    setSelectedSpecs([]);
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  }

  function clearAll() {
    resetLocalFilters();
    setMobileFiltersOpen(false);
    router.push("/shop");
  }

  const filters = (
    <FilterPanel
      brands={brands}
      categories={flatCategories}
      maxPrice={maxPrice}
      minPrice={minPrice}
      onCategory={(category) => pushSearch({ category })}
      onMaxPrice={(value) => { setMaxPrice(value); setPage(1); }}
      onMinPrice={(value) => { setMinPrice(value); setPage(1); }}
      onOnlyAvailable={(value) => { setOnlyAvailable(value); setPage(1); }}
      onReset={resetLocalFilters}
      onToggleBrand={(brand) => {
        setPage(1);
        setSelectedBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]);
      }}
      onToggleSpec={(key) => {
        setPage(1);
        setSelectedSpecs((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
      }}
      onlyAvailable={onlyAvailable}
      requestedCategory={requestedCategory}
      selectedBrands={selectedBrands}
      selectedSpecs={selectedSpecs}
      technicalFilters={technicalFilters}
    />
  );

  return (
    <main className="pb-16 sm:pb-20">
      <section className="border-b border-border bg-surface">
        <div className="site-container py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link className="hover:text-foreground" href="/">{t("storefront", "home")}</Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{t("storefront", "shop")}</span>
          </nav>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] lg:items-end">
            <div>
              <p className="section-kicker">{t("storefront", "browseWithConfidence")}</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{pageTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("storefront", "shopHeroDescription")}</p>
            </div>
            <form
              className="flex rounded-xl border border-border bg-background p-1 focus-within:border-primary"
              onSubmit={(event) => { event.preventDefault(); pushSearch({ query }); }}
              role="search"
            >
              <input
                aria-label={t("storefront", "searchCatalogue")}
                className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("storefront", "trySearch")}
                value={query}
              />
              <button className="rounded-lg bg-foreground px-4 text-xs font-black text-background" type="submit">{t("storefront", "search")}</button>
            </form>
          </div>

          {flatCategories.length > 0 ? (
            <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
              <button
                className={`focus-ring shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${!requestedCategory ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted hover:text-foreground"}`}
                onClick={() => pushSearch({ category: null })}
                type="button"
              >
                {t("storefront", "allDepartments")}
              </button>
              {flatCategories.slice(0, 10).map((category) => (
                <button
                  className={`focus-ring shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${requestedCategory === category.slug ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted hover:text-foreground"}`}
                  key={category.slug}
                  onClick={() => pushSearch({ category: category.slug })}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="site-container py-7 sm:py-9">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
          <p className="text-sm text-muted">
            {isLoading ? t("storefront", "checkingAvailability") : `${visibleProducts.length} ${visibleProducts.length === 1 ? t("storefront", "productShown") : t("storefront", "productsShown")}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              aria-expanded={mobileFiltersOpen}
              className="button-secondary min-h-10 px-3 py-2 text-xs lg:hidden"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              type="button"
            >
              <FilterIcon /> {t("storefront", "filters")}{activeFilterCount ? ` · ${activeFilterCount}` : ""}
            </button>
            <div className="hidden rounded-lg border border-border bg-surface p-1 sm:flex">
              <button aria-label={t("storefront", "gridView")} aria-pressed={viewMode === "grid"} className={`grid h-8 w-8 place-items-center rounded-md ${viewMode === "grid" ? "bg-elevated text-foreground" : "text-muted"}`} onClick={() => setViewMode("grid")} type="button"><GridIcon /></button>
              <button aria-label={t("storefront", "listView")} aria-pressed={viewMode === "list"} className={`grid h-8 w-8 place-items-center rounded-md ${viewMode === "list" ? "bg-elevated text-foreground" : "text-muted"}`} onClick={() => setViewMode("list")} type="button"><ListIcon /></button>
            </div>
            <select className="form-input min-h-10 w-auto py-2 text-xs font-bold" onChange={(event) => { setSort(event.target.value as SortOption); setPage(1); }} value={sort}>
              <option value="featured">{t("storefront", "featured")}</option>
              <option value="price-low">{t("storefront", "priceLowHigh")}</option>
              <option value="price-high">{t("storefront", "priceHighLow")}</option>
              <option value="stock">{t("storefront", "localStockFirst")}</option>
            </select>
          </div>
        </div>

        {mobileFiltersOpen ? <div className="mt-4 rounded-2xl border border-border bg-surface p-4 lg:hidden">{filters}</div> : null}

        <div className="mt-7 grid gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
          <aside className="hidden lg:block"><div className="sticky top-32">{filters}</div></aside>

          <section className="min-w-0">
            {error ? (
              <StatePanel title={t("storefront", "catalogueLoadError")} text={error} action={t("storefront", "clearAll")} onAction={clearAll} />
            ) : isLoading ? (
              <ProductGridSkeleton />
            ) : paginated.length === 0 ? (
              <StatePanel title={t("storefront", "noResultsTitle")} text={t("storefront", "noResultsText")} action={t("storefront", "resetFilters")} onAction={clearAll} />
            ) : (
              <>
                <div className={viewMode === "list" ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
                  {paginated.map((product) => <StoreProductCard key={product.id} product={product} variant={viewMode} />)}
                </div>
                {pageCount > 1 ? (
                  <nav aria-label="Pagination" className="mt-9 flex items-center justify-center gap-2">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        aria-current={pageNumber === safePage ? "page" : undefined}
                        className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-xs font-black ${pageNumber === safePage ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-muted hover:text-foreground"}`}
                        key={pageNumber}
                        onClick={() => { setPage(pageNumber); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        type="button"
                      >{pageNumber}</button>
                    ))}
                  </nav>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterPanel({
  brands, categories, maxPrice, minPrice, onCategory, onMaxPrice, onMinPrice, onOnlyAvailable,
  onReset, onToggleBrand, onToggleSpec, onlyAvailable, requestedCategory, selectedBrands, selectedSpecs,
  technicalFilters,
}: {
  brands: string[];
  categories: Category[];
  maxPrice: string;
  minPrice: string;
  onCategory: (value: string | null) => void;
  onMaxPrice: (value: string) => void;
  onMinPrice: (value: string) => void;
  onOnlyAvailable: (value: boolean) => void;
  onReset: () => void;
  onToggleBrand: (value: string) => void;
  onToggleSpec: (value: string) => void;
  onlyAvailable: boolean;
  requestedCategory: CategorySlug | null;
  selectedBrands: string[];
  selectedSpecs: string[];
  technicalFilters: SpecFilter[];
}) {
  const { t } = usePreferences();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-foreground">{t("storefront", "filters")}</h2>
        <button className="text-[11px] font-black text-muted hover:text-primary" onClick={onReset} type="button">{t("storefront", "reset")}</button>
      </div>

      <div className="mt-4 grid gap-5">
        <FilterGroup title={t("storefront", "filterAvailability")}>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-foreground">
            <input checked={onlyAvailable} className="h-4 w-4 accent-primary" onChange={(event) => onOnlyAvailable(event.target.checked)} type="checkbox" />
            {t("storefront", "localOrDropship")}
          </label>
        </FilterGroup>

        <FilterGroup title={t("storefront", "filterPrice")}>
          <div className="grid grid-cols-2 gap-2">
            <input className="form-input min-h-10 py-2 text-xs" inputMode="numeric" onChange={(event) => onMinPrice(event.target.value)} placeholder={t("storefront", "minPrice")} value={minPrice} />
            <input className="form-input min-h-10 py-2 text-xs" inputMode="numeric" onChange={(event) => onMaxPrice(event.target.value)} placeholder={t("storefront", "maxPrice")} value={maxPrice} />
          </div>
        </FilterGroup>

        {brands.length > 0 ? (
          <FilterGroup title={t("storefront", "filterBrands")}>
            <div className="grid max-h-44 gap-2 overflow-y-auto pe-1">
              {brands.map((brand) => <CheckRow checked={selectedBrands.includes(brand)} key={brand} label={brand} onChange={() => onToggleBrand(brand)} />)}
            </div>
          </FilterGroup>
        ) : null}

        <details className="group border-t border-border pt-4" open={selectedSpecs.length > 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-foreground">
            <span>{t("storefront", "filterSpecifications")}</span>
            <span className="text-muted transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <p className="mt-2 text-[11px] leading-5 text-muted">{t("storefront", "shopHeroDescription")}</p>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pe-1">
            {technicalFilters.map((filter) => (
              <CheckRow checked={selectedSpecs.includes(filter.key)} key={filter.key} label={`${filter.label}: ${filter.value}`} onChange={() => onToggleSpec(filter.key)} />
            ))}
          </div>
        </details>

        {categories.length > 0 ? (
          <details className="group border-t border-border pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-foreground">
              <span>{t("storefront", "filterDepartment")}</span><span className="text-muted transition group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>
            <div className="mt-3 grid gap-1">
              <button className={`rounded-lg px-2 py-2 text-start text-xs font-bold ${!requestedCategory ? "bg-elevated text-foreground" : "text-muted hover:text-foreground"}`} onClick={() => onCategory(null)} type="button">{t("storefront", "allDepartments")}</button>
              {categories.map((category) => (
                <button className={`rounded-lg px-2 py-2 text-start text-xs font-bold ${requestedCategory === category.slug ? "bg-elevated text-foreground" : "text-muted hover:text-foreground"}`} key={category.slug} onClick={() => onCategory(category.slug)} type="button">{category.name}</button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function FilterGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="border-t border-border pt-4 first:border-t-0 first:pt-0"><h3 className="mb-3 text-xs font-black text-foreground">{title}</h3>{children}</section>;
}
function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-4 text-muted"><input checked={checked} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary" onChange={onChange} type="checkbox" /><span className={checked ? "font-bold text-foreground" : ""}>{label}</span></label>;
}
function StatePanel({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center"><h2 className="text-xl font-black text-foreground">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{text}</p><button className="button-secondary mt-5" onClick={onAction} type="button">{action}</button></div>;
}
function ProductGridSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="overflow-hidden rounded-[1.15rem] border border-border bg-surface" key={index}><div className="aspect-[4/3] animate-pulse bg-elevated" /><div className="space-y-3 p-5"><div className="h-3 w-20 animate-pulse rounded bg-elevated" /><div className="h-5 w-full animate-pulse rounded bg-elevated" /><div className="h-5 w-3/4 animate-pulse rounded bg-elevated" /><div className="h-16 animate-pulse rounded bg-elevated" /></div></div>)}</div>;
}
function ShopLoadingFallback() { return <main className="site-container py-10"><div className="h-40 animate-pulse rounded-2xl bg-elevated" /><div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]"><div className="hidden h-96 animate-pulse rounded-2xl bg-elevated lg:block" /><ProductGridSkeleton /></div></main>; }
function flattenCategories(categories: Category[]): Category[] { return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]); }
function parsePrice(value: string) { if (!value.trim()) return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function specKey(label: string, code: string | undefined, value: string) { return `${code ?? label}:${value}`; }
function buildTechnicalFilters(products: Product[], locale: string) {
  const unique = new Map<string, SpecFilter>();
  for (const product of products) {
    for (const spec of product.specs) {
      if (spec.filterable === false) continue;
      const key = specKey(spec.label, spec.code, spec.value);
      unique.set(key, { key, label: spec.label, value: spec.value });
    }
  }
  return [...unique.values()].sort((a, b) => `${a.label} ${a.value}`.localeCompare(`${b.label} ${b.value}`, locale)).slice(0, 60);
}
function FilterIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function GridIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.7" width="6" x="3" y="3" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.7" width="6" x="15" y="3" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.7" width="6" x="3" y="15" /><rect height="6" rx="1" stroke="currentColor" strokeWidth="1.7" width="6" x="15" y="15" /></svg>; }
function ListIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="4" cy="6" fill="currentColor" r="1" /><circle cx="4" cy="12" fill="currentColor" r="1" /><circle cx="4" cy="18" fill="currentColor" r="1" /></svg>; }
