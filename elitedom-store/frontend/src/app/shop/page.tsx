"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { Drawer } from "@/components/ui/Overlay";
import { fetchCatalog } from "@/lib/api";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { CategorySlug, Product } from "@/types/store";

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

  const categoryNames: Record<string, string> = {
    gaming: t("storefront", "categoryGaming"),
    computers: t("storefront", "categoryComputers"),
    peripherals: t("storefront", "categoryPeripherals"),
    audio: t("storefront", "categoryAudio"),
    networking: t("storefront", "categoryNetworking"),
    mobile: t("storefront", "categoryMobile"),
  };

  useEffect(() => {
    let live = true;
    setQuery(requestedQuery);
    setIsLoading(true);
    setError(null);

    void fetchCatalog(requestedQuery)
      .then((nextProducts) => {
        if (live) setProducts(nextProducts);
      })
      .catch((requestError: unknown) => {
        if (!live) return;
        setProducts([]);
        setError(requestError instanceof Error ? requestError.message : t("storefront", "catalogueLoadError"));
      })
      .finally(() => {
        if (live) setIsLoading(false);
      });

    return () => {
      live = false;
    };
  }, [reloadToken, requestedQuery, t]);

  const availableBrands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort(),
    [products],
  );

  const availableSpecifications = useMemo(() => {
    const uniqueSpecifications = new Map<string, SpecificationFilter>();
    products.forEach((product) => {
      product.specs.forEach((specification) => {
        const key = `${specification.label}:${specification.value}`;
        uniqueSpecifications.set(key, { key, label: `${specification.label}: ${specification.value}` });
      });
    });
    return [...uniqueSpecifications.values()]
      .sort((first, second) => first.label.localeCompare(second.label, locale))
      .slice(0, 16);
  }, [locale, products]);

  const visibleProducts = useMemo(() => {
    const minimum = toPrice(minimumPrice);
    const maximum = toPrice(maximumPrice);
    const nextProducts = products
      .filter((product) => !requestedCategory || product.category === requestedCategory)
      .filter((product) => !onlyAvailable || product.stockQty > 0 || product.dropshipEnabled)
      .filter((product) => selectedBrands.length === 0 || selectedBrands.includes(product.brand))
      .filter((product) =>
        selectedSpecifications.length === 0 ||
        selectedSpecifications.every((selectedSpecification) =>
          product.specs.some((specification) => `${specification.label}:${specification.value}` === selectedSpecification),
        ),
      )
      .filter((product) => minimum === null || product.priceEgp >= minimum)
      .filter((product) => maximum === null || product.priceEgp <= maximum);

    return [...nextProducts].sort((first, second) => {
      if (sort === "price-low") return first.priceEgp - second.priceEgp;
      if (sort === "price-high") return second.priceEgp - first.priceEgp;
      if (sort === "stock") {
        return Number(second.stockQty > 0) - Number(first.stockQty > 0) || second.stockQty - first.stockQty;
      }
      return Number(Boolean(second.featured)) - Number(Boolean(first.featured));
    });
  }, [maximumPrice, minimumPrice, onlyAvailable, products, requestedCategory, selectedBrands, selectedSpecifications, sort]);

  const activeFilterCount =
    Number(Boolean(requestedQuery)) +
    Number(Boolean(requestedCategory)) +
    Number(onlyAvailable) +
    selectedBrands.length +
    selectedSpecifications.length +
    Number(Boolean(minimumPrice)) +
    Number(Boolean(maximumPrice));

  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const paginatedProducts = visibleProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateFilters(next: { category?: CategorySlug | null; query?: string }) {
    const parameters = new URLSearchParams(searchParams.toString());
    const nextCategory = next.category === undefined ? requestedCategory : next.category;
    const nextQuery = next.query === undefined ? requestedQuery : next.query;

    if (nextCategory) parameters.set("category", nextCategory);
    else parameters.delete("category");

    if (nextQuery?.trim()) parameters.set("q", nextQuery.trim());
    else parameters.delete("q");

    const serialized = parameters.toString();
    setCurrentPage(1);
    router.push(`/shop${serialized ? `?${serialized}` : ""}`);
  }

  function toggleBrand(brand: string) {
    setCurrentPage(1);
    setSelectedBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function toggleSpecification(specification: string) {
    setCurrentPage(1);
    setSelectedSpecifications((current) =>
      current.includes(specification)
        ? current.filter((item) => item !== specification)
        : [...current, specification],
    );
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
    categoryNames,
    maximumPrice,
    minimumPrice,
    onlyAvailable,
    onCategoryChange: (category) => updateFilters({ category }),
    onMaximumPriceChange: (value) => { setMaximumPrice(value); setCurrentPage(1); },
    onMinimumPriceChange: (value) => { setMinimumPrice(value); setCurrentPage(1); },
    onOnlyAvailableChange: (value) => { setOnlyAvailable(value); setCurrentPage(1); },
    onReset: resetLocalFilters,
    onToggleBrand: toggleBrand,
    onToggleSpecification: toggleSpecification,
    requestedCategory,
    selectedBrands,
    selectedSpecifications,
  };

  const requestedCategoryName = requestedCategory
    ? categoryNames[requestedCategory] ?? CATEGORIES.find((category) => category.slug === requestedCategory)?.name
    : null;
  const pageTitle = requestedQuery
    ? `${t("storefront", "resultsFor")} “${requestedQuery}”`
    : requestedCategoryName ?? t("storefront", "everythingWeStock");
  const productsCountLabel = visibleProducts.length === 1
    ? t("storefront", "productShown")
    : t("storefront", "productsShown");

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/">{t("storefront", "home")}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{t("storefront", "shop")}</span>
      </nav>

      <section className="surface-grid mt-6 overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="section-kicker">{t("storefront", "browseWithConfidence")}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {t("storefront", "shopHeroTitle")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {t("storefront", "shopHeroDescription")}
            </p>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); updateFilters({ query }); }} role="search">
            <label className="sr-only" htmlFor="catalogue-page-search">{t("storefront", "searchCatalogue")}</label>
            <input
              className="form-input min-w-0 flex-1"
              id="catalogue-page-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("storefront", "trySearch")}
              value={query}
            />
            <button className="button-primary shrink-0 px-4 py-2" type="submit">{t("storefront", "search")}</button>
          </form>
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <CategoryChip
            active={!requestedCategory}
            label={t("storefront", "allDepartments")}
            onClick={() => updateFilters({ category: null })}
          />
          {CATEGORIES.map((category) => (
            <CategoryChip
              active={requestedCategory === category.slug}
              key={category.slug}
              label={categoryNames[category.slug] ?? category.name}
              onClick={() => updateFilters({ category: category.slug })}
            />
          ))}
        </div>
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <CatalogFilterControls {...filterProps} idPrefix="desktop" />
        </aside>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{t("storefront", "curatedTechnology")}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground">{pageTitle}</h2>
              <p className="mt-3 text-sm text-muted">
                {isLoading
                  ? t("storefront", "checkingAvailability")
                  : `${visibleProducts.length} ${productsCountLabel} · ${t("storefront", "pricesIncludeVat")}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-expanded={isFiltersOpen}
                className="button-secondary px-3 py-2 text-sm lg:hidden"
                onClick={() => setIsFiltersOpen(true)}
                type="button"
              >
                {t("storefront", "filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              <div aria-label={t("storefront", "sortProducts")} className="inline-flex rounded-lg border border-border bg-surface p-1">
                <button
                  aria-label={t("storefront", "gridView")}
                  aria-pressed={viewMode === "grid"}
                  className={`focus-ring grid h-8 w-8 place-items-center rounded-md ${viewMode === "grid" ? "bg-primary text-primary-contrast" : "text-muted hover:text-foreground"}`}
                  onClick={() => setViewMode("grid")}
                  type="button"
                >
                  <GridIcon />
                </button>
                <button
                  aria-label={t("storefront", "listView")}
                  aria-pressed={viewMode === "list"}
                  className={`focus-ring grid h-8 w-8 place-items-center rounded-md ${viewMode === "list" ? "bg-primary text-primary-contrast" : "text-muted hover:text-foreground"}`}
                  onClick={() => setViewMode("list")}
                  type="button"
                >
                  <ListIcon />
                </button>
              </div>
              <label className="text-sm text-muted">
                <span className="sr-only">{t("storefront", "sortProducts")}</span>
                <select
                  className="form-input min-h-10 py-2"
                  onChange={(event) => { setSort(event.target.value as SortOption); setCurrentPage(1); }}
                  value={sort}
                >
                  <option value="featured">{t("storefront", "featured")}</option>
                  <option value="price-low">{t("storefront", "priceLowHigh")}</option>
                  <option value="price-high">{t("storefront", "priceHighLow")}</option>
                  <option value="stock">{t("storefront", "localStockFirst")}</option>
                </select>
              </label>
            </div>
          </div>

          <Drawer
            description={t("storefront", "shopHeroDescription")}
            onClose={() => setIsFiltersOpen(false)}
            open={isFiltersOpen}
            title={t("storefront", "filters")}
            footer={
              <button className="button-secondary w-full" onClick={clearAllFilters} type="button">
                {t("storefront", "clearAll")}
              </button>
            }
          >
            <CatalogFilterControls {...filterProps} idPrefix="mobile" />
          </Drawer>

          {activeFilterCount > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm shadow-sm">
              <span className="font-semibold text-foreground">{t("storefront", "activeFilters")}: {activeFilterCount}</span>
              {requestedCategoryName && <FilterTag>{requestedCategoryName}</FilterTag>}
              {requestedQuery && <FilterTag>“{requestedQuery}”</FilterTag>}
              {selectedBrands.map((brand) => <FilterTag key={brand}>{brand}</FilterTag>)}
              {selectedSpecifications.map((specification) => <FilterTag key={specification}>{specification.replace(":", ": ")}</FilterTag>)}
              {(minimumPrice || maximumPrice) && <FilterTag>{t("storefront", "priceRange")}</FilterTag>}
              {onlyAvailable && <FilterTag>{t("storefront", "availableNowFilter")}</FilterTag>}
              <button className="focus-ring ms-auto rounded-md text-xs font-bold text-primary hover:brightness-110" onClick={clearAllFilters} type="button">
                {t("storefront", "clearAll")}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-danger bg-surface p-6 text-center shadow-sm">
              <p className="font-black text-danger">{t("storefront", "liveCatalogueUnavailable")}</p>
              <p className="mt-2 text-sm text-muted">{error}</p>
              <button className="button-primary mt-5" onClick={() => setReloadToken((value) => value + 1)} type="button">
                {t("storefront", "retryCatalogue")}
              </button>
            </div>
          )}

          {isLoading ? (
            <ProductSkeletons viewMode={viewMode} />
          ) : !error && visibleProducts.length > 0 ? (
            <>
              <div className={`mt-8 ${viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`}>
                {paginatedProducts.map((product) => <StoreProductCard key={product.id} product={product} variant={viewMode} />)}
              </div>
              {pageCount > 1 && (
                <nav aria-label={t("storefront", "shop")} className="mt-8 flex flex-wrap justify-center gap-2">
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                    <button
                      aria-current={safePage === page ? "page" : undefined}
                      className={`focus-ring grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-black ${safePage === page ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"}`}
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                </nav>
              )}
            </>
          ) : !error ? (
            <div className="mt-8 rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-elevated text-primary" aria-hidden="true">⌕</span>
              <h3 className="mt-4 text-xl font-black text-foreground">{t("storefront", "noResultsTitle")}</h3>
              <p className="mt-2 text-sm text-muted">{t("storefront", "noResultsText")}</p>
              <button className="button-primary mt-6" onClick={clearAllFilters} type="button">{t("storefront", "resetFilters")}</button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CategoryChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`focus-ring shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${active ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-bold text-muted">{children}</span>;
}

type CatalogFilterControlsProps = {
  idPrefix: string;
  availableBrands: string[];
  availableSpecifications: SpecificationFilter[];
  categoryNames: Record<string, string>;
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

function CatalogFilterControls({
  idPrefix,
  availableBrands,
  availableSpecifications,
  categoryNames,
  maximumPrice,
  minimumPrice,
  onlyAvailable,
  onCategoryChange,
  onMaximumPriceChange,
  onMinimumPriceChange,
  onOnlyAvailableChange,
  onReset,
  onToggleBrand,
  onToggleSpecification,
  requestedCategory,
  selectedBrands,
  selectedSpecifications,
}: CatalogFilterControlsProps) {
  const { t } = usePreferences();

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black text-foreground">{t("storefront", "filters")}</h2>
        <button className="focus-ring rounded-md text-xs font-bold text-primary hover:brightness-110" onClick={onReset} type="button">
          {t("storefront", "reset")}
        </button>
      </div>

      <FilterGroup title={t("storefront", "filterDepartment")}>
        <RadioRow
          checked={!requestedCategory}
          id={`${idPrefix}-category-all`}
          label={t("storefront", "allDepartments")}
          onChange={() => onCategoryChange(null)}
        />
        {CATEGORIES.map((category) => (
          <RadioRow
            checked={requestedCategory === category.slug}
            id={`${idPrefix}-category-${category.slug}`}
            key={category.slug}
            label={categoryNames[category.slug] ?? category.name}
            onChange={() => onCategoryChange(category.slug)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title={t("storefront", "filterAvailability")}>
        <CheckboxRow
          checked={onlyAvailable}
          id={`${idPrefix}-available`}
          label={t("storefront", "localOrDropship")}
          onChange={onOnlyAvailableChange}
        />
      </FilterGroup>

      {availableBrands.length > 0 && (
        <FilterGroup title={t("storefront", "filterBrands")}>
          {availableBrands.map((brand) => (
            <CheckboxRow
              checked={selectedBrands.includes(brand)}
              id={`${idPrefix}-brand-${toSafeId(brand)}`}
              key={brand}
              label={brand}
              onChange={() => onToggleBrand(brand)}
            />
          ))}
        </FilterGroup>
      )}

      {availableSpecifications.length > 0 && (
        <FilterGroup title={t("storefront", "filterSpecifications")}>
          <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
            {availableSpecifications.map((specification) => (
              <CheckboxRow
                checked={selectedSpecifications.includes(specification.key)}
                id={`${idPrefix}-spec-${toSafeId(specification.key)}`}
                key={specification.key}
                label={specification.label}
                onChange={() => onToggleSpecification(specification.key)}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={t("storefront", "filterPrice")}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted" htmlFor={`${idPrefix}-minimum-price`}>
            {t("storefront", "minPrice")}
            <input
              className="form-input mt-1 min-h-10 py-2"
              id={`${idPrefix}-minimum-price`}
              inputMode="decimal"
              min="0"
              onChange={(event) => onMinimumPriceChange(event.target.value)}
              placeholder="0"
              type="number"
              value={minimumPrice}
            />
          </label>
          <label className="text-xs font-semibold text-muted" htmlFor={`${idPrefix}-maximum-price`}>
            {t("storefront", "maxPrice")}
            <input
              className="form-input mt-1 min-h-10 py-2"
              id={`${idPrefix}-maximum-price`}
              inputMode="decimal"
              min="0"
              onChange={(event) => onMaximumPriceChange(event.target.value)}
              placeholder="250000"
              type="number"
              value={maximumPrice}
            />
          </label>
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <fieldset className="mt-5 border-t border-border pt-5">
      <legend className="mb-3 text-sm font-black text-foreground">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function CheckboxRow({
  checked,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted hover:text-foreground" htmlFor={id}>
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 accent-[var(--ds-primary)]"
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function RadioRow({
  checked,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted hover:text-foreground" htmlFor={id}>
      <input
        checked={checked}
        className="h-4 w-4 accent-[var(--ds-primary)]"
        id={id}
        name={`${id.split("-category-")[0]}-category`}
        onChange={onChange}
        type="radio"
      />
      <span>{label}</span>
    </label>
  );
}

function ProductSkeletons({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className={`mt-8 ${viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`} aria-hidden="true">
      {Array.from({ length: viewMode === "grid" ? 6 : 4 }, (_, index) => (
        <div className={`overflow-hidden rounded-2xl border border-border bg-surface ${viewMode === "list" ? "flex min-h-64" : ""}`} key={index}>
          <div className={`${viewMode === "list" ? "w-64" : "aspect-square"} animate-pulse bg-elevated`} />
          <div className="flex-1 space-y-3 p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-elevated" />
            <div className="h-5 w-full animate-pulse rounded bg-elevated" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-elevated" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopLoadingFallback() {
  return <div className="site-container py-12"><div className="h-96 animate-pulse rounded-3xl border border-border bg-surface" /></div>;
}

function GridIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.8" width="7" x="3" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.8" width="7" x="14" y="3" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.8" width="7" x="3" y="14" /><rect height="7" rx="1" stroke="currentColor" strokeWidth="1.8" width="7" x="14" y="14" /></svg>;
}

function ListIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="4.5" cy="6" fill="currentColor" r="1.2" /><circle cx="4.5" cy="12" fill="currentColor" r="1.2" /><circle cx="4.5" cy="18" fill="currentColor" r="1.2" /></svg>;
}

function toPrice(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toSafeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
