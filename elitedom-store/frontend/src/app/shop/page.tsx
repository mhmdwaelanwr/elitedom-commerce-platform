"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { fetchCatalog } from "@/lib/api";
import { CATALOG, CATEGORIES } from "@/lib/catalog";
import type { CategorySlug, Product } from "@/types/store";

type SortOption = "featured" | "price-low" | "price-high" | "stock";
type ViewMode = "grid" | "list";
type SpecificationFilter = { key: string; label: string };

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
  const requestedQuery = searchParams.get("q") ?? "";
  const requestedCategory = searchParams.get("category") as CategorySlug | null;
  const [query, setQuery] = useState(requestedQuery);
  const [products, setProducts] = useState<Product[]>(CATALOG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSpecifications, setSelectedSpecifications] = useState<string[]>([]);
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setQuery(requestedQuery);
      setIsLoading(true);
      setError(null);
      fetchCatalog(requestedQuery)
        .then((nextProducts) => {
          if (live) setProducts(nextProducts);
        })
        .catch((requestError: unknown) => {
          if (!live) return;
          setProducts([]);
          setError(requestError instanceof Error ? requestError.message : "Could not load the catalogue.");
        })
        .finally(() => {
          if (live) setIsLoading(false);
        });
    }, 0);

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [requestedQuery]);

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
    return [...uniqueSpecifications.values()].sort((first, second) => first.label.localeCompare(second.label)).slice(0, 10);
  }, [products]);

  const visibleProducts = useMemo(() => {
    const minimum = toPrice(minimumPrice);
    const maximum = toPrice(maximumPrice);
    const nextProducts = products
      .filter((product) => !requestedCategory || product.category === requestedCategory)
      .filter((product) => !onlyAvailable || product.stockQty > 0 || product.dropshipEnabled)
      .filter((product) => selectedBrands.length === 0 || selectedBrands.includes(product.brand))
      .filter((product) =>
        selectedSpecifications.length === 0 ||
        selectedSpecifications.some((selectedSpecification) =>
          product.specs.some((specification) => `${specification.label}:${specification.value}` === selectedSpecification),
        ),
      )
      .filter((product) => minimum === null || product.priceEgp >= minimum)
      .filter((product) => maximum === null || product.priceEgp <= maximum);

    return [...nextProducts].sort((first, second) => {
      if (sort === "price-low") return first.priceEgp - second.priceEgp;
      if (sort === "price-high") return second.priceEgp - first.priceEgp;
      if (sort === "stock") return Number(second.stockQty > 0) - Number(first.stockQty > 0);
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

  function updateFilters(next: { category?: CategorySlug | null; query?: string }) {
    const parameters = new URLSearchParams(searchParams.toString());
    const nextCategory = next.category === undefined ? requestedCategory : next.category;
    const nextQuery = next.query === undefined ? requestedQuery : next.query;

    if (nextCategory) parameters.set("category", nextCategory);
    else parameters.delete("category");

    if (nextQuery?.trim()) parameters.set("q", nextQuery.trim());
    else parameters.delete("q");

    router.push(`/shop${parameters.size ? `?${parameters.toString()}` : ""}`);
  }

  function toggleBrand(brand: string) {
    setSelectedBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    );
  }

  function toggleSpecification(specification: string) {
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
  }

  function clearAllFilters() {
    resetLocalFilters();
    setIsFiltersOpen(false);
    router.push("/shop");
  }

  const filterProps: Omit<CatalogFilterControlsProps, "idPrefix"> = {
    availableBrands,
    availableSpecifications,
    maximumPrice,
    minimumPrice,
    onlyAvailable,
    onCategoryChange: (category) => updateFilters({ category }),
    onClose: () => setIsFiltersOpen(false),
    onMaximumPriceChange: setMaximumPrice,
    onMinimumPriceChange: setMinimumPrice,
    onOnlyAvailableChange: setOnlyAvailable,
    onReset: resetLocalFilters,
    onToggleBrand: toggleBrand,
    onToggleSpecification: toggleSpecification,
    requestedCategory,
    selectedBrands,
    selectedSpecifications,
  };

  const pageTitle = requestedQuery
    ? `Results for “${requestedQuery}”`
    : requestedCategory
      ? CATEGORIES.find((category) => category.slug === requestedCategory)?.name ?? "Catalogue"
      : "Everything we stock";

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link className="hover:text-white focus-ring" href="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-200">Shop</span>
      </nav>

      <section className="mt-6 overflow-hidden rounded-3xl border border-sky-400/15 bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.16),transparent_45%)] bg-slate-900/60 p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
          <div>
            <p className="section-kicker">Browse with confidence</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Find the technology that fits.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Search products, narrow by department, brand, price, and availability, then review the technical details before checkout.</p>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); updateFilters({ query }); }} role="search">
            <label className="sr-only" htmlFor="catalogue-page-search">Search catalogue</label>
            <input
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/85 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              id="catalogue-page-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try a product, brand, or SKU…"
              value={query}
            />
            <button className="button-primary px-4 py-2" type="submit">Search</button>
          </form>
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <button
            aria-pressed={!requestedCategory}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition focus-ring ${!requestedCategory ? "border-sky-400 bg-sky-400 text-slate-950" : "border-slate-700 bg-slate-950/65 text-slate-300 hover:border-sky-400 hover:text-white"}`}
            onClick={() => updateFilters({ category: null })}
            type="button"
          >
            All departments
          </button>
          {CATEGORIES.map((category) => (
            <button
              aria-pressed={requestedCategory === category.slug}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition focus-ring ${requestedCategory === category.slug ? "border-sky-400 bg-sky-400 text-slate-950" : "border-slate-700 bg-slate-950/65 text-slate-300 hover:border-sky-400 hover:text-white"}`}
              key={category.slug}
              onClick={() => updateFilters({ category: category.slug })}
              type="button"
            >
              {category.name}
            </button>
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
              <p className="section-kicker">Curated technology</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{pageTitle}</h2>
              <p className="mt-3 text-sm text-slate-400">
                {isLoading ? "Checking availability…" : `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} shown`} · Prices include Egyptian VAT.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-controls="mobile-catalogue-filters"
                aria-expanded={isFiltersOpen}
                className="button-secondary px-3 py-2 text-sm lg:hidden"
                onClick={() => setIsFiltersOpen((open) => !open)}
                type="button"
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              <div aria-label="Product view" className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                <button
                  aria-label="Grid product view"
                  aria-pressed={viewMode === "grid"}
                  className={`grid h-8 w-8 place-items-center rounded-md focus-ring ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                  onClick={() => setViewMode("grid")}
                  type="button"
                >
                  <GridIcon />
                </button>
                <button
                  aria-label="List product view"
                  aria-pressed={viewMode === "list"}
                  className={`grid h-8 w-8 place-items-center rounded-md focus-ring ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                  onClick={() => setViewMode("list")}
                  type="button"
                >
                  <ListIcon />
                </button>
              </div>
              <label className="text-sm text-slate-400">
                <span className="sr-only">Sort products</span>
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  value={sort}
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="stock">Local stock first</option>
                </select>
              </label>
            </div>
          </div>

          {isFiltersOpen && (
            <div className="mt-5 lg:hidden" id="mobile-catalogue-filters">
              <CatalogFilterControls {...filterProps} idPrefix="mobile" />
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-sm">
              <span className="font-semibold text-slate-300">Active filters: {activeFilterCount}</span>
              {requestedCategory && <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-200">{CATEGORIES.find((category) => category.slug === requestedCategory)?.name}</span>}
              {requestedQuery && <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-200">“{requestedQuery}”</span>}
              {selectedBrands.map((brand) => <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300" key={brand}>{brand}</span>)}
              {selectedSpecifications.map((specification) => <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300" key={specification}>{specification.replace(":", ": ")}</span>)}
              {(minimumPrice || maximumPrice) && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">Price range</span>}
              {onlyAvailable && <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">Available now</span>}
              <button className="ml-auto text-xs font-bold text-sky-300 hover:text-white focus-ring" onClick={clearAllFilters} type="button">Clear all</button>
            </div>
          )}

          {error && <div className="mt-6 rounded-xl border border-rose-400/35 bg-rose-950/50 p-4 text-sm text-rose-100">{error}</div>}
          {isLoading ? (
            <ProductSkeletons viewMode={viewMode} />
          ) : visibleProducts.length > 0 ? (
            <div className={`mt-8 ${viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`}>
              {visibleProducts.map((product) => <StoreProductCard key={product.id} product={product} variant={viewMode} />)}
            </div>
          ) : (
            <EmptyResults onClear={clearAllFilters} />
          )}
        </section>
      </div>
    </div>
  );
}

type CatalogFilterControlsProps = {
  availableBrands: string[];
  availableSpecifications: SpecificationFilter[];
  idPrefix: string;
  maximumPrice: string;
  minimumPrice: string;
  onlyAvailable: boolean;
  onCategoryChange: (category: CategorySlug | null) => void;
  onClose: () => void;
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
  availableBrands,
  availableSpecifications,
  idPrefix,
  maximumPrice,
  minimumPrice,
  onlyAvailable,
  onCategoryChange,
  onClose,
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
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:sticky lg:top-32">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Refine results</p>
          <h2 className="mt-1 text-xl font-black text-white">Filters</h2>
        </div>
        <button className="text-xs font-bold text-sky-300 hover:text-white focus-ring" onClick={onReset} type="button">Reset</button>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-bold text-slate-200">Department</legend>
        <div className="mt-3 grid gap-1">
          <button
            aria-pressed={!requestedCategory}
            className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-ring ${!requestedCategory ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
            onClick={() => { onCategoryChange(null); onClose(); }}
            type="button"
          >
            All products
          </button>
          {CATEGORIES.map((category) => (
            <button
              aria-pressed={requestedCategory === category.slug}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-ring ${requestedCategory === category.slug ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
              key={category.slug}
              onClick={() => { onCategoryChange(category.slug); onClose(); }}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-slate-800 pt-6">
        <legend className="text-sm font-bold text-slate-200">Price range (EGP)</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-minimum-price`}>Minimum price</label>
          <input
            className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            id={`${idPrefix}-minimum-price`}
            inputMode="numeric"
            min="0"
            onChange={(event) => onMinimumPriceChange(event.target.value)}
            placeholder="Min"
            type="number"
            value={minimumPrice}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-maximum-price`}>Maximum price</label>
          <input
            className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            id={`${idPrefix}-maximum-price`}
            inputMode="numeric"
            min="0"
            onChange={(event) => onMaximumPriceChange(event.target.value)}
            placeholder="Max"
            type="number"
            value={maximumPrice}
          />
        </div>
      </fieldset>

      {availableBrands.length > 1 && (
        <fieldset className="mt-6 border-t border-slate-800 pt-6">
          <legend className="text-sm font-bold text-slate-200">Brand</legend>
          <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto pr-1">
            {availableBrands.map((brand) => {
              const checkboxId = `${idPrefix}-brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300" htmlFor={checkboxId} key={brand}>
                  <input
                    checked={selectedBrands.includes(brand)}
                    className="h-4 w-4 rounded accent-sky-400"
                    id={checkboxId}
                    onChange={() => onToggleBrand(brand)}
                    type="checkbox"
                  />
                  <span>{brand}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {availableSpecifications.length > 0 && (
        <fieldset className="mt-6 border-t border-slate-800 pt-6">
          <legend className="text-sm font-bold text-slate-200">Key specifications</legend>
          <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto pr-1">
            {availableSpecifications.map((specification) => {
              const checkboxId = `${idPrefix}-spec-${specification.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300" htmlFor={checkboxId} key={specification.key}>
                  <input
                    checked={selectedSpecifications.includes(specification.key)}
                    className="h-4 w-4 rounded accent-sky-400"
                    id={checkboxId}
                    onChange={() => onToggleSpecification(specification.key)}
                    type="checkbox"
                  />
                  <span>{specification.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3 border-t border-slate-800 pt-6 text-sm text-slate-300">
        <input
          checked={onlyAvailable}
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-sky-400"
          onChange={(event) => onOnlyAvailableChange(event.target.checked)}
          type="checkbox"
        />
        <span><strong className="block text-slate-200">Available to order</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">Show local stock and verified supplier dropship products.</span></span>
      </label>
    </div>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
      <div className="text-3xl">⌕</div>
      <h3 className="mt-4 text-lg font-bold text-white">No matching products</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Try a different keyword, clear a filter, or ask our B2B team to source a requirement.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button className="button-secondary" onClick={onClear} type="button">Clear filters</button>
        <Link className="button-primary" href="/b2b">Request a quote</Link>
      </div>
    </div>
  );
}

function ProductSkeletons({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className={`mt-8 ${viewMode === "grid" ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div className={`animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 ${viewMode === "grid" ? "h-[29rem]" : "h-52"}`} key={index} />
      ))}
    </div>
  );
}

function ShopLoadingFallback() {
  return (
    <div className="site-container py-14">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-900" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <div className="h-[29rem] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" key={index} />)}
      </div>
    </div>
  );
}

function toPrice(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function GridIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="15" viewBox="0 0 16 16" width="15">
      <path d="M1 1h5v5H1V1Zm9 0h5v5h-5V1ZM1 10h5v5H1v-5Zm9 0h5v5h-5v-5Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 18 18" width="16">
      <path d="M5 4h10M5 9h10M5 14h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="2" cy="4" fill="currentColor" r="1" />
      <circle cx="2" cy="9" fill="currentColor" r="1" />
      <circle cx="2" cy="14" fill="currentColor" r="1" />
    </svg>
  );
}
