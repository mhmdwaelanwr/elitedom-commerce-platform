"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode, useEffect, useMemo, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { Drawer } from "@/components/ui/Overlay";
import { fetchRichCatalog, fetchRichCategories } from "@/lib/catalog-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Category, CategorySlug, Product } from "@/types/store";

type SortOption = "featured" | "price-low" | "price-high" | "stock";
type ViewMode = "grid" | "list";
type SpecificationFilter = { key: string; label: string };

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecifications, setSelectedSpecifications] = useState<string[]>([]);
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setQuery(requestedQuery);
      setIsLoading(true);
      setError(null);
      Promise.all([
        fetchRichCatalog({
          locale,
          query: requestedQuery || undefined,
          category: requestedCategory || undefined,
          limit: 100,
        }),
        fetchRichCategories(locale),
      ])
        .then(([nextProducts, nextCategories]) => {
          if (!active) return;
          setProducts(nextProducts);
          setCategories(nextCategories);
        })
        .catch((requestError: unknown) => {
          if (!active) return;
          setProducts([]);
          setCategories([]);
          setError(requestError instanceof Error ? requestError.message : t("storefront", "catalogueLoadError"));
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [locale, reloadToken, requestedCategory, requestedQuery, t]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const categoryNames = useMemo(
    () => Object.fromEntries(flatCategories.map((category) => [category.slug, category.name])),
    [flatCategories],
  );
  const availableBrands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale)),
    [locale, products],
  );
  const availableSpecifications = useMemo(() => {
    const unique = new Map<string, SpecificationFilter>();
    for (const product of products) {
      for (const specification of product.specs) {
        if (specification.filterable === false) continue;
        const key = `${specification.code ?? specification.label}:${specification.value}`;
        unique.set(key, { key, label: `${specification.label}: ${specification.value}` });
      }
    }
    return [...unique.values()]
      .sort((first, second) => first.label.localeCompare(second.label, locale))
      .slice(0, 30);
  }, [locale, products]);

  const visibleProducts = useMemo(() => {
    const minimum = toPrice(minimumPrice);
    const maximum = toPrice(maximumPrice);
    const filtered = products
      .filter((product) => !onlyAvailable || product.stockQty > 0 || product.dropshipEnabled)
      .filter((product) => selectedBrands.length === 0 || selectedBrands.includes(product.brand))
      .filter((product) =>
        selectedSpecifications.length === 0 ||
        selectedSpecifications.every((selected) =>
          product.specs.some(
            (specification) => `${specification.code ?? specification.label}:${specification.value}` === selected,
          ),
        ),
      )
      .filter((product) => minimum === null || product.priceEgp >= minimum)
      .filter((product) => maximum === null || product.priceEgp <= maximum);

    return [...filtered].sort((first, second) => {
      if (sort === "price-low") return first.priceEgp - second.priceEgp;
      if (sort === "price-high") return second.priceEgp - first.priceEgp;
      if (sort === "stock") return Number(second.stockQty > 0) - Number(first.stockQty > 0) || second.stockQty - first.stockQty;
      return Number(Boolean(second.featured)) - Number(Boolean(first.featured));
    });
  }, [maximumPrice, minimumPrice, onlyAvailable, products, selectedBrands, selectedSpecifications, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const paginatedProducts = visibleProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const requestedCategoryName = requestedCategory ? categoryNames[requestedCategory] : null;
  const pageTitle = requestedQuery
    ? `${t("storefront", "resultsFor")} “${requestedQuery}”`
    : requestedCategoryName ?? t("storefront", "everythingWeStock");
  const activeFilterCount =
    Number(Boolean(requestedQuery)) +
    Number(Boolean(requestedCategory)) +
    Number(onlyAvailable) +
    selectedBrands.length +
    selectedSpecifications.length +
    Number(Boolean(minimumPrice)) +
    Number(Boolean(maximumPrice));

  function updateUrl(next: { category?: string | null; query?: string }) {
    const parameters = new URLSearchParams(searchParams.toString());
    const nextCategory = next.category === undefined ? requestedCategory : next.category;
    const nextQuery = next.query === undefined ? requestedQuery : next.query;
    if (nextCategory) parameters.set("category", nextCategory); else parameters.delete("category");
    if (nextQuery?.trim()) parameters.set("q", nextQuery.trim()); else parameters.delete("q");
    setCurrentPage(1);
    const serialized = parameters.toString();
    router.push(`/shop${serialized ? `?${serialized}` : ""}`);
  }

  function resetLocalFilters() {
    setOnlyAvailable(false);
    setSelectedBrands([]);
    setSelectedSpecifications([]);
    setMinimumPrice("");
    setMaximumPrice("");
    setSort("featured");
    setCurrentPage(1);
  }

  function clearAllFilters() {
    resetLocalFilters();
    setIsFiltersOpen(false);
    router.push("/shop");
  }

  const filterProps: Omit<CatalogFilterControlsProps, "idPrefix"> = {
    availableBrands,
    availableSpecifications,
    categories: flatCategories,
    maximumPrice,
    minimumPrice,
    onlyAvailable,
    onCategoryChange: (category) => updateUrl({ category }),
    onMaximumPriceChange: (value) => { setMaximumPrice(value); setCurrentPage(1); },
    onMinimumPriceChange: (value) => { setMinimumPrice(value); setCurrentPage(1); },
    onOnlyAvailableChange: (value) => { setOnlyAvailable(value); setCurrentPage(1); },
    onReset: resetLocalFilters,
    onToggleBrand: (brand) => {
      setCurrentPage(1);
      setSelectedBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]);
    },
    onToggleSpecification: (specification) => {
      setCurrentPage(1);
      setSelectedSpecifications((current) => current.includes(specification) ? current.filter((item) => item !== specification) : [...current, specification]);
    },
    requestedCategory,
    selectedBrands,
    selectedSpecifications,
  };

  return (
    <main className="pb-16 sm:pb-24">
      <section className="bg-surface">
        <div className="site-container py-9 sm:py-12">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link className="focus-ring rounded-full px-1 hover:text-foreground" href="/">{t("storefront", "home")}</Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{t("storefront", "shop")}</span>
          </nav>

          <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32rem)] lg:items-end">
            <div>
              <p className="text-sm font-bold text-primary">{t("storefront", "browseWithConfidence")}</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl lg:text-6xl">{pageTitle}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">{t("storefront", "shopHeroDescription")}</p>
            </div>

            <form className="flex min-h-13 rounded-full bg-elevated p-1.5 focus-within:ring-2 focus-within:ring-primary/20" onSubmit={(event) => { event.preventDefault(); updateUrl({ query }); }} role="search">
              <label className="sr-only" htmlFor="catalogue-page-search">{t("storefront", "searchCatalogue")}</label>
              <span className="grid w-10 shrink-0 place-items-center text-muted" aria-hidden="true"><SearchIcon /></span>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted"
                id="catalogue-page-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("storefront", "trySearch")}
                value={query}
              />
              <button aria-label={t("storefront", "search")} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast" type="submit"><ArrowIcon /></button>
            </form>
          </div>

          {flatCategories.length > 0 ? (
            <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
              <button className={`focus-ring shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition ${!requestedCategory ? "bg-foreground text-background" : "bg-elevated text-muted hover:text-foreground"}`} onClick={() => updateUrl({ category: null })} type="button">
                {t("storefront", "allDepartments")}
              </button>
              {flatCategories.slice(0, 10).map((category) => (
                <button className={`focus-ring shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition ${requestedCategory === category.slug ? "bg-foreground text-background" : "bg-elevated text-muted hover:text-foreground"}`} key={category.slug} onClick={() => updateUrl({ category: category.slug })} type="button">
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="site-container py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-surface px-4 py-3 sm:px-5">
          <p className="text-sm text-muted">
            {isLoading ? t("storefront", "checkingAvailability") : `${visibleProducts.length} ${visibleProducts.length === 1 ? t("storefront", "productShown") : t("storefront", "productsShown")}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button aria-expanded={isFiltersOpen} className="button-secondary min-h-10 px-4 py-2 text-xs lg:hidden" onClick={() => setIsFiltersOpen(true)} type="button">
              <FilterIcon /> {t("storefront", "filters")}{activeFilterCount ? ` · ${activeFilterCount}` : ""}
            </button>
            <div className="flex rounded-full bg-elevated p-1">
              <button aria-label={t("storefront", "gridView")} aria-pressed={viewMode === "grid"} className={`focus-ring grid h-9 w-9 place-items-center rounded-full ${viewMode === "grid" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`} onClick={() => setViewMode("grid")} type="button"><GridIcon /></button>
              <button aria-label={t("storefront", "listView")} aria-pressed={viewMode === "list"} className={`focus-ring grid h-9 w-9 place-items-center rounded-full ${viewMode === "list" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`} onClick={() => setViewMode("list")} type="button"><ListIcon /></button>
            </div>
            <select aria-label={t("storefront", "sortProducts")} className="form-input min-h-10 w-auto rounded-full border-transparent bg-elevated py-2 pe-9 text-xs font-bold" onChange={(event) => { setSort(event.target.value as SortOption); setCurrentPage(1); }} value={sort}>
              <option value="featured">{t("storefront", "featured")}</option>
              <option value="price-low">{t("storefront", "priceLowHigh")}</option>
              <option value="price-high">{t("storefront", "priceHighLow")}</option>
              <option value="stock">{t("storefront", "localStockFirst")}</option>
            </select>
          </div>
        </div>

        {activeFilterCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {requestedCategoryName ? <ActiveFilter label={requestedCategoryName} /> : null}
            {requestedQuery ? <ActiveFilter label={requestedQuery} /> : null}
            {onlyAvailable ? <ActiveFilter label={t("storefront", "availableNowFilter")} /> : null}
            {selectedBrands.map((brand) => <ActiveFilter key={brand} label={brand} />)}
            {(minimumPrice || maximumPrice) ? <ActiveFilter label={t("storefront", "priceRange")} /> : null}
            {selectedSpecifications.length > 0 ? <ActiveFilter label={`${t("storefront", "filterSpecifications")} · ${selectedSpecifications.length}`} /> : null}
            <button className="focus-ring rounded-full px-3 py-2 text-xs font-bold text-primary hover:bg-[var(--ds-primary-soft)]" onClick={clearAllFilters} type="button">{t("storefront", "clearAll")}</button>
          </div>
        ) : null}

        <Drawer
          description={t("storefront", "shopHeroDescription")}
          footer={<button className="button-secondary w-full" onClick={clearAllFilters} type="button">{t("storefront", "clearAll")}</button>}
          onClose={() => setIsFiltersOpen(false)}
          open={isFiltersOpen}
          title={t("storefront", "filters")}
        >
          <CatalogFilterControls {...filterProps} idPrefix="mobile" />
        </Drawer>

        <div className="mt-8 grid gap-9 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-32">
              <CatalogFilterControls {...filterProps} idPrefix="desktop" />
            </div>
          </aside>

          <section className="min-w-0">
            {error ? (
              <StatePanel title={t("storefront", "liveCatalogueUnavailable")} text={error} action={t("storefront", "retryCatalogue")} onAction={() => setReloadToken((value) => value + 1)} />
            ) : isLoading ? (
              <ProductSkeletons viewMode={viewMode} />
            ) : visibleProducts.length > 0 ? (
              <>
                <div className={viewMode === "grid" ? "grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>
                  {paginatedProducts.map((product) => <StoreProductCard key={product.id} product={product} variant={viewMode} />)}
                </div>
                {pageCount > 1 ? (
                  <nav aria-label={t("storefront", "shop")} className="mt-12 flex flex-wrap justify-center gap-2">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                      <button aria-current={safePage === page ? "page" : undefined} className={`focus-ring grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-bold transition ${safePage === page ? "bg-foreground text-background" : "bg-elevated text-muted hover:text-foreground"}`} key={page} onClick={() => setCurrentPage(page)} type="button">{page}</button>
                    ))}
                  </nav>
                ) : null}
              </>
            ) : (
              <StatePanel title={t("storefront", "noResultsTitle")} text={t("storefront", "noResultsText")} action={t("storefront", "resetFilters")} onAction={clearAllFilters} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function ActiveFilter({ label }: { label: string }) {
  return <span className="rounded-full bg-elevated px-3 py-2 text-xs font-medium text-foreground">{label}</span>;
}

type CatalogFilterControlsProps = {
  idPrefix: string;
  categories: Category[];
  availableBrands: string[];
  availableSpecifications: SpecificationFilter[];
  maximumPrice: string;
  minimumPrice: string;
  onlyAvailable: boolean;
  onCategoryChange: (category: CategorySlug | null) => void;
  onMaximumPriceChange: (value: string) => void;
  onMinimumPriceChange: (value: string) => void;
  onOnlyAvailableChange: (value: boolean) => void;
  onReset: () => void;
  onToggleBrand: (brand: string) => void;
  onToggleSpecification: (specification: string) => void;
  requestedCategory: CategorySlug | null;
  selectedBrands: string[];
  selectedSpecifications: string[];
};

function CatalogFilterControls(props: CatalogFilterControlsProps) {
  const { t } = usePreferences();
  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-lg font-bold text-foreground">{t("storefront", "filters")}</h2>
        <button className="focus-ring rounded-full px-2 py-1 text-xs font-bold text-primary hover:bg-[var(--ds-primary-soft)]" onClick={props.onReset} type="button">{t("storefront", "reset")}</button>
      </div>

      <FilterGroup title={t("storefront", "filterDepartment")}>
        <RadioRow checked={!props.requestedCategory} id={`${props.idPrefix}-category-all`} label={t("storefront", "allDepartments")} onChange={() => props.onCategoryChange(null)} />
        {props.categories.slice(0, 12).map((category) => (
          <RadioRow checked={props.requestedCategory === category.slug} id={`${props.idPrefix}-category-${category.slug}`} key={category.slug} label={category.name} onChange={() => props.onCategoryChange(category.slug)} />
        ))}
      </FilterGroup>

      <FilterGroup title={t("storefront", "filterAvailability")}>
        <CheckboxRow checked={props.onlyAvailable} id={`${props.idPrefix}-available`} label={t("storefront", "localOrDropship")} onChange={props.onOnlyAvailableChange} />
      </FilterGroup>

      {props.availableBrands.length > 0 ? (
        <FilterGroup title={t("storefront", "filterBrands")}>
          {props.availableBrands.map((brand) => (
            <CheckboxRow checked={props.selectedBrands.includes(brand)} id={`${props.idPrefix}-brand-${toSafeId(brand)}`} key={brand} label={brand} onChange={() => props.onToggleBrand(brand)} />
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup title={t("storefront", "filterPrice")}>
        <div className="grid grid-cols-2 gap-2">
          <PriceInput id={`${props.idPrefix}-minimum-price`} label={t("storefront", "minPrice")} onChange={props.onMinimumPriceChange} placeholder="0" value={props.minimumPrice} />
          <PriceInput id={`${props.idPrefix}-maximum-price`} label={t("storefront", "maxPrice")} onChange={props.onMaximumPriceChange} placeholder="250000" value={props.maximumPrice} />
        </div>
      </FilterGroup>

      {props.availableSpecifications.length > 0 ? (
        <details className="border-t border-border py-5">
          <summary className="focus-ring flex cursor-pointer list-none items-center justify-between rounded-full text-sm font-bold text-foreground">
            {t("storefront", "filterSpecifications")}
            <span className="text-xs font-medium text-muted">{props.selectedSpecifications.length || "+"}</span>
          </summary>
          <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pe-1">
            {props.availableSpecifications.map((specification) => (
              <CheckboxRow checked={props.selectedSpecifications.includes(specification.key)} id={`${props.idPrefix}-spec-${toSafeId(specification.key)}`} key={specification.key} label={specification.label} onChange={() => props.onToggleSpecification(specification.key)} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FilterGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <fieldset className="border-t border-border py-5">
      <legend className="mb-3 text-sm font-bold text-foreground">{title}</legend>
      <div className="space-y-2.5">{children}</div>
    </fieldset>
  );
}

function RadioRow(props: { checked: boolean; id: string; label: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-muted transition hover:text-foreground" htmlFor={props.id}>
      <input checked={props.checked} className="h-4 w-4 accent-primary" id={props.id} name={`${props.id.split("-category-")[0]}-category`} onChange={props.onChange} type="radio" />
      <span>{props.label}</span>
    </label>
  );
}

function CheckboxRow(props: { checked: boolean; id: string; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-muted transition hover:text-foreground" htmlFor={props.id}>
      <input checked={props.checked} className="mt-0.5 h-4 w-4 accent-primary" id={props.id} onChange={(event) => props.onChange(event.target.checked)} type="checkbox" />
      <span>{props.label}</span>
    </label>
  );
}

function PriceInput(props: { id: string; label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="text-xs font-medium text-muted" htmlFor={props.id}>
      {props.label}
      <input className="form-input mt-1 min-h-10 rounded-xl bg-surface py-2" id={props.id} inputMode="decimal" min="0" onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} type="number" value={props.value} />
    </label>
  );
}

function StatePanel({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="rounded-[2rem] bg-surface px-6 py-16 text-center sm:px-10">
      <span className="mx-auto block h-12 w-12 rounded-full bg-elevated" aria-hidden="true" />
      <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{text}</p>
      <button className="button-primary mt-6" onClick={onAction} type="button">{action}</button>
    </div>
  );
}

function ProductSkeletons({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className={viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="animate-pulse" key={index}>
          <div className="aspect-square rounded-[1.75rem] bg-elevated" />
          <div className="mt-4 space-y-2 px-1">
            <div className="h-3 w-1/3 rounded-full bg-elevated" />
            <div className="h-5 w-4/5 rounded-full bg-elevated" />
            <div className="h-16 w-full rounded-2xl bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopLoadingFallback() {
  return (
    <div className="pb-16">
      <div className="bg-surface">
        <div className="site-container py-12">
          <div className="h-12 w-2/3 animate-pulse rounded-full bg-elevated" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded-full bg-elevated" />
        </div>
      </div>
      <div className="site-container py-10"><ProductSkeletons viewMode="grid" /></div>
    </div>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function ArrowIcon() {
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M5 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
function FilterIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
function GridIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><rect height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="3" /><rect height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="3" /><rect height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="7" x="3" y="14" /><rect height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="7" x="14" y="14" /></svg>;
}
function ListIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="4" cy="6" fill="currentColor" r="1" /><circle cx="4" cy="12" fill="currentColor" r="1" /><circle cx="4" cy="18" fill="currentColor" r="1" /></svg>;
}

function toPrice(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toSafeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
