"use client";

import Image from "next/image";
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
          setError(
            requestError instanceof Error
              ? requestError.message
              : t("storefront", "catalogueLoadError"),
          );
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
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort(),
    [products],
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
            (specification) =>
              `${specification.code ?? specification.label}:${specification.value}` === selected,
          ),
        ),
      )
      .filter((product) => minimum === null || product.priceEgp >= minimum)
      .filter((product) => maximum === null || product.priceEgp <= maximum);

    return [...filtered].sort((first, second) => {
      if (sort === "price-low") return first.priceEgp - second.priceEgp;
      if (sort === "price-high") return second.priceEgp - first.priceEgp;
      if (sort === "stock") {
        return Number(second.stockQty > 0) - Number(first.stockQty > 0) || second.stockQty - first.stockQty;
      }
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
    if (nextCategory) parameters.set("category", nextCategory);
    else parameters.delete("category");
    if (nextQuery?.trim()) parameters.set("q", nextQuery.trim());
    else parameters.delete("q");
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
    onMaximumPriceChange: (value) => {
      setMaximumPrice(value);
      setCurrentPage(1);
    },
    onMinimumPriceChange: (value) => {
      setMinimumPrice(value);
      setCurrentPage(1);
    },
    onOnlyAvailableChange: (value) => {
      setOnlyAvailable(value);
      setCurrentPage(1);
    },
    onReset: resetLocalFilters,
    onToggleBrand: (brand) => {
      setCurrentPage(1);
      setSelectedBrands((current) =>
        current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
      );
    },
    onToggleSpecification: (specification) => {
      setCurrentPage(1);
      setSelectedSpecifications((current) =>
        current.includes(specification)
          ? current.filter((item) => item !== specification)
          : [...current, specification],
      );
    },
    requestedCategory,
    selectedBrands,
    selectedSpecifications,
  };

  return (
    <div className="pb-16 sm:pb-20">
      <section className="border-b border-border bg-surface">
        <div className="site-container py-7 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-xs text-muted sm:text-sm">
            <Link className="focus-ring rounded-md hover:text-foreground" href="/">
              {t("storefront", "home")}
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{t("storefront", "shop")}</span>
          </nav>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
            <div>
              <p className="section-kicker">{t("storefront", "browseWithConfidence")}</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {t("storefront", "shopHeroTitle")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                {t("storefront", "shopHeroDescription")}
              </p>
            </div>

            <form
              className="flex overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
              onSubmit={(event) => {
                event.preventDefault();
                updateUrl({ query });
              }}
              role="search"
            >
              <label className="sr-only" htmlFor="catalogue-page-search">
                {t("storefront", "searchCatalogue")}
              </label>
              <input
                className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted"
                id="catalogue-page-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("storefront", "trySearch")}
                value={query}
              />
              <button className="shrink-0 bg-primary px-5 text-sm font-black text-primary-contrast transition hover:brightness-105" type="submit">
                {t("storefront", "search")}
              </button>
            </form>
          </div>

          {flatCategories.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {flatCategories.slice(0, 6).map((category) => (
                <CategoryTile
                  active={requestedCategory === category.slug}
                  category={category}
                  key={category.slug}
                  onClick={() => updateUrl({ category: category.slug })}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="site-container py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[9rem]">
              <CatalogFilterControls {...filterProps} idPrefix="desktop" />
            </div>
          </aside>

          <section className="min-w-0">
            <div className="border-b border-border pb-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">{t("storefront", "curatedTechnology")}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{pageTitle}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {isLoading
                      ? t("storefront", "checkingAvailability")
                      : `${visibleProducts.length} ${
                          visibleProducts.length === 1
                            ? t("storefront", "productShown")
                            : t("storefront", "productsShown")
                        } · ${t("storefront", "pricesIncludeVat")}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    aria-expanded={isFiltersOpen}
                    className="button-secondary px-3 py-2 text-sm lg:hidden"
                    onClick={() => setIsFiltersOpen(true)}
                    type="button"
                  >
                    {t("storefront", "filters")}{activeFilterCount ? ` (${activeFilterCount})` : ""}
                  </button>

                  <div className="inline-flex rounded-lg border border-border bg-surface p-1">
                    <button
                      aria-label={t("storefront", "gridView")}
                      aria-pressed={viewMode === "grid"}
                      className={`focus-ring grid h-8 w-8 place-items-center rounded-md text-xs font-black ${
                        viewMode === "grid" ? "bg-elevated text-foreground" : "text-muted hover:text-foreground"
                      }`}
                      onClick={() => setViewMode("grid")}
                      type="button"
                    >
                      ▦
                    </button>
                    <button
                      aria-label={t("storefront", "listView")}
                      aria-pressed={viewMode === "list"}
                      className={`focus-ring grid h-8 w-8 place-items-center rounded-md text-xs font-black ${
                        viewMode === "list" ? "bg-elevated text-foreground" : "text-muted hover:text-foreground"
                      }`}
                      onClick={() => setViewMode("list")}
                      type="button"
                    >
                      ☰
                    </button>
                  </div>

                  <select
                    aria-label={t("storefront", "sortProducts")}
                    className="form-input min-h-10 w-auto min-w-40 py-2 text-sm"
                    onChange={(event) => {
                      setSort(event.target.value as SortOption);
                      setCurrentPage(1);
                    }}
                    value={sort}
                  >
                    <option value="featured">{t("storefront", "featured")}</option>
                    <option value="price-low">{t("storefront", "priceLowHigh")}</option>
                    <option value="price-high">{t("storefront", "priceHighLow")}</option>
                    <option value="stock">{t("storefront", "localStockFirst")}</option>
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted">{t("storefront", "activeFilters")}</span>
                  {requestedCategoryName ? <ActiveFilter label={requestedCategoryName} /> : null}
                  {requestedQuery ? <ActiveFilter label={requestedQuery} /> : null}
                  {onlyAvailable ? <ActiveFilter label={t("storefront", "availableNowFilter")} /> : null}
                  {selectedBrands.map((brand) => <ActiveFilter key={brand} label={brand} />)}
                  {(minimumPrice || maximumPrice) ? <ActiveFilter label={t("storefront", "priceRange")} /> : null}
                  <button className="focus-ring rounded-md text-xs font-bold text-primary hover:underline" onClick={clearAllFilters} type="button">
                    {t("storefront", "clearAll")}
                  </button>
                </div>
              ) : null}
            </div>

            <Drawer
              description={t("storefront", "shopHeroDescription")}
              footer={
                <button className="button-secondary w-full" onClick={clearAllFilters} type="button">
                  {t("storefront", "clearAll")}
                </button>
              }
              onClose={() => setIsFiltersOpen(false)}
              open={isFiltersOpen}
              title={t("storefront", "filters")}
            >
              <CatalogFilterControls {...filterProps} idPrefix="mobile" />
            </Drawer>

            {error ? (
              <div className="mt-7 rounded-2xl border border-danger/30 bg-surface p-8 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-danger/10 font-black text-danger" aria-hidden="true">!</span>
                <p className="mt-4 font-black text-foreground">{t("storefront", "liveCatalogueUnavailable")}</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{error}</p>
                <button className="button-primary mt-5" onClick={() => setReloadToken((value) => value + 1)} type="button">
                  {t("storefront", "retryCatalogue")}
                </button>
              </div>
            ) : isLoading ? (
              <ProductSkeletons viewMode={viewMode} />
            ) : visibleProducts.length > 0 ? (
              <>
                <div className={`mt-7 ${viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`}>
                  {paginatedProducts.map((product) => (
                    <StoreProductCard key={product.id} product={product} variant={viewMode} />
                  ))}
                </div>
                {pageCount > 1 ? (
                  <nav aria-label={t("storefront", "shop")} className="mt-9 flex flex-wrap justify-center gap-2">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                      <button
                        aria-current={safePage === page ? "page" : undefined}
                        className={`focus-ring grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-black transition ${
                          safePage === page
                            ? "border-primary bg-primary text-primary-contrast"
                            : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"
                        }`}
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    ))}
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="mt-8 border border-border bg-surface px-6 py-14 text-center sm:px-10">
                <span className="mx-auto block h-12 w-12 rounded-full border border-border bg-elevated" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-black text-foreground">{t("storefront", "noResultsTitle")}</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{t("storefront", "noResultsText")}</p>
                <button className="button-primary mt-6" onClick={clearAllFilters} type="button">
                  {t("storefront", "resetFilters")}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function CategoryTile({
  active,
  category,
  onClick,
}: {
  active: boolean;
  category: Category;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`focus-ring group flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-start transition ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary hover:bg-elevated"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
        <Image alt="" className="object-contain p-1.5 transition group-hover:scale-105" fill sizes="48px" src={category.image} />
      </span>
      <span className={`truncate text-xs font-black ${active ? "text-primary" : "text-foreground"}`}>{category.name}</span>
    </button>
  );
}

function ActiveFilter({ label }: { label: string }) {
  return <span className="rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] font-semibold text-foreground">{label}</span>;
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
    <div className="border-y border-border bg-surface lg:border-x lg:p-5">
      <div className="flex items-center justify-between gap-3 py-4 lg:py-0">
        <h2 className="font-black text-foreground">{t("storefront", "filters")}</h2>
        <button className="focus-ring rounded-md text-xs font-bold text-primary hover:underline" onClick={props.onReset} type="button">
          {t("storefront", "reset")}
        </button>
      </div>
      <FilterGroup title={t("storefront", "filterDepartment")}>
        <RadioRow
          checked={!props.requestedCategory}
          id={`${props.idPrefix}-category-all`}
          label={t("storefront", "allDepartments")}
          onChange={() => props.onCategoryChange(null)}
        />
        {props.categories.map((category) => (
          <RadioRow
            checked={props.requestedCategory === category.slug}
            id={`${props.idPrefix}-category-${category.slug}`}
            key={category.slug}
            label={category.name}
            onChange={() => props.onCategoryChange(category.slug)}
          />
        ))}
      </FilterGroup>
      <FilterGroup title={t("storefront", "filterAvailability")}>
        <CheckboxRow
          checked={props.onlyAvailable}
          id={`${props.idPrefix}-available`}
          label={t("storefront", "localOrDropship")}
          onChange={props.onOnlyAvailableChange}
        />
      </FilterGroup>
      {props.availableBrands.length ? (
        <FilterGroup title={t("storefront", "filterBrands")}>
          {props.availableBrands.map((brand) => (
            <CheckboxRow
              checked={props.selectedBrands.includes(brand)}
              id={`${props.idPrefix}-brand-${toSafeId(brand)}`}
              key={brand}
              label={brand}
              onChange={() => props.onToggleBrand(brand)}
            />
          ))}
        </FilterGroup>
      ) : null}
      {props.availableSpecifications.length ? (
        <FilterGroup title={t("storefront", "filterSpecifications")}>
          <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
            {props.availableSpecifications.map((specification) => (
              <CheckboxRow
                checked={props.selectedSpecifications.includes(specification.key)}
                id={`${props.idPrefix}-spec-${toSafeId(specification.key)}`}
                key={specification.key}
                label={specification.label}
                onChange={() => props.onToggleSpecification(specification.key)}
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}
      <FilterGroup title={t("storefront", "filterPrice")}>
        <div className="grid grid-cols-2 gap-2">
          <PriceInput
            id={`${props.idPrefix}-minimum-price`}
            label={t("storefront", "minPrice")}
            onChange={props.onMinimumPriceChange}
            placeholder="0"
            value={props.minimumPrice}
          />
          <PriceInput
            id={`${props.idPrefix}-maximum-price`}
            label={t("storefront", "maxPrice")}
            onChange={props.onMaximumPriceChange}
            placeholder="250000"
            value={props.maximumPrice}
          />
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <fieldset className="border-t border-border py-5 first-of-type:mt-4">
      <legend className="mb-3 text-sm font-black text-foreground">{title}</legend>
      <div className="space-y-2.5">{children}</div>
    </fieldset>
  );
}

function RadioRow(props: { checked: boolean; id: string; label: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted transition hover:text-foreground" htmlFor={props.id}>
      <input
        checked={props.checked}
        className="h-4 w-4 accent-primary"
        id={props.id}
        name={`${props.id.split("-category-")[0]}-category`}
        onChange={props.onChange}
        type="radio"
      />
      <span>{props.label}</span>
    </label>
  );
}

function CheckboxRow(props: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted transition hover:text-foreground" htmlFor={props.id}>
      <input
        checked={props.checked}
        className="mt-0.5 h-4 w-4 accent-primary"
        id={props.id}
        onChange={(event) => props.onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{props.label}</span>
    </label>
  );
}

function PriceInput(props: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="text-xs font-semibold text-muted" htmlFor={props.id}>
      {props.label}
      <input
        className="form-input mt-1 min-h-10 py-2"
        id={props.id}
        inputMode="decimal"
        min="0"
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        type="number"
        value={props.value}
      />
    </label>
  );
}

function ProductSkeletons({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className={`mt-7 ${viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}`}>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface" key={index}>
          <div className="aspect-square bg-elevated" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-1/3 rounded bg-elevated" />
            <div className="h-5 w-4/5 rounded bg-elevated" />
            <div className="h-4 w-full rounded bg-elevated" />
            <div className="h-10 w-full rounded bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopLoadingFallback() {
  return (
    <div className="pb-16">
      <div className="border-b border-border bg-surface">
        <div className="site-container py-10">
          <div className="h-10 w-2/3 animate-pulse rounded bg-elevated" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-elevated" />
        </div>
      </div>
      <div className="site-container py-10">
        <ProductSkeletons viewMode="grid" />
      </div>
    </div>
  );
}

function toPrice(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toSafeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
