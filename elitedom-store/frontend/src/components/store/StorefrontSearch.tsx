"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { fetchCatalog } from "@/lib/api";
import { CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

type StorefrontSearchProps = {
  inputId: string;
  onNavigate?: () => void;
  placeholder?: string;
};

export function StorefrontSearch({ inputId, onNavigate, placeholder }: StorefrontSearchProps) {
  const router = useRouter();
  const generatedId = useId();
  const { direction, t } = usePreferences();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const resolvedPlaceholder = placeholder ?? t("storefront", "searchPlaceholder");

  const categoryNames = useMemo<Record<string, string>>(
    () => ({
      gaming: t("storefront", "categoryGaming"),
      computers: t("storefront", "categoryComputers"),
      peripherals: t("storefront", "categoryPeripherals"),
      audio: t("storefront", "categoryAudio"),
      networking: t("storefront", "categoryNetworking"),
      mobile: t("storefront", "categoryMobile"),
    }),
    [t],
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchCatalog(query)
        .then((result) => {
          if (active) setProducts(result.slice(0, normalizedQuery ? 6 : 4));
        })
        .catch(() => {
          if (active) setProducts([]);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, normalizedQuery ? 180 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedQuery, query]);

  const categoryMatches = useMemo(() => {
    if (!normalizedQuery) return CATEGORIES.slice(0, 6);
    return CATEGORIES.filter((category) =>
      [category.name, category.description, categoryNames[category.slug] ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    ).slice(0, 6);
  }, [categoryNames, normalizedQuery]);

  const hasSuggestions = categoryMatches.length > 0 || products.length > 0;
  const listboxId = `${inputId}-${generatedId}-suggestions`;

  function closeAndNotify() {
    setIsOpen(false);
    onNavigate?.();
  }

  function navigateToSearch() {
    const destination = query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : "/shop";
    closeAndNotify();
    router.push(destination);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateToSearch();
  }

  return (
    <form className="relative" onSubmit={handleSubmit} role="search">
      <label className="sr-only" htmlFor={inputId}>{t("storefront", "searchProducts")}</label>
      <div className={`relative min-h-12 rounded-full transition-all duration-200 ${
        isOpen
          ? "bg-surface shadow-[0_2px_10px_var(--ds-shadow)] ring-1 ring-border"
          : "bg-elevated hover:bg-[var(--ds-tonal)]"
      }`}>
        <span className="pointer-events-none absolute inset-y-0 start-0 grid w-12 place-items-center text-muted" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="h-12 w-full bg-transparent ps-12 pe-14 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted sm:h-13 sm:text-[0.95rem]"
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 160)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={resolvedPlaceholder}
          role="combobox"
          value={query}
        />
        <button
          aria-label={t("storefront", "search")}
          className={`focus-ring absolute end-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full transition ${
            normalizedQuery ? "bg-primary text-primary-contrast" : "text-muted hover:bg-surface hover:text-foreground"
          }`}
          type="submit"
        >
          <ArrowIcon rtl={direction === "rtl"} />
        </button>
      </div>

      {isOpen ? (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.6rem)] z-50 overflow-hidden rounded-[1.75rem] bg-surface shadow-[0_12px_38px_-14px_var(--ds-shadow)] ring-1 ring-border"
          id={listboxId}
          role="listbox"
        >
          {isLoading && products.length === 0 ? (
            <div className="grid gap-2 p-5" aria-label={t("storefront", "checkingAvailability")}>
              {Array.from({ length: 4 }, (_, index) => (
                <div className="flex animate-pulse items-center gap-3" key={index}>
                  <div className="h-12 w-12 rounded-2xl bg-elevated" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded-full bg-elevated" />
                    <div className="h-4 w-3/4 rounded-full bg-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasSuggestions ? (
            <div className="p-4 sm:p-5">
              {categoryMatches.length > 0 ? (
                <div>
                  <p className="px-1 text-xs font-bold text-muted">
                    {normalizedQuery ? t("storefront", "departments") : t("storefront", "browseDepartments")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoryMatches.map((category) => (
                      <Link
                        className="focus-ring inline-flex items-center gap-2 rounded-full bg-elevated px-3 py-2 text-xs font-bold text-foreground transition hover:bg-[var(--ds-primary-soft)] hover:text-primary"
                        href={`/shop?category=${category.slug}`}
                        key={category.slug}
                        onClick={closeAndNotify}
                        role="option"
                      >
                        <span className="relative h-6 w-6 overflow-hidden rounded-full bg-surface">
                          <Image alt="" className="object-contain p-0.5" fill sizes="24px" src={category.image} />
                        </span>
                        {categoryNames[category.slug] ?? category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {products.length > 0 ? (
                <div className={categoryMatches.length > 0 ? "mt-5 border-t border-border pt-4" : ""}>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold text-muted">
                      {normalizedQuery ? t("storefront", "matchingProducts") : t("storefront", "popularPicks")}
                    </p>
                    {isLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" /> : null}
                  </div>
                  <div className="mt-2 grid gap-1 md:grid-cols-2">
                    {products.map((product) => (
                      <Link
                        className="focus-ring group flex min-w-0 items-center gap-3 rounded-2xl p-2.5 transition hover:bg-elevated"
                        href={`/products/${encodeURIComponent(product.slug ?? product.id)}`}
                        key={product.id}
                        onClick={closeAndNotify}
                        role="option"
                      >
                        <span className="product-canvas relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
                          <Image alt="" className="object-contain p-1.5" fill sizes="56px" src={product.image} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold text-primary">{product.brand}</span>
                          <span className="mt-0.5 line-clamp-1 block text-sm font-bold text-foreground group-hover:text-primary">{product.name}</span>
                          {product.specs.length > 0 ? (
                            <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted">
                              {product.specs.slice(0, 2).map((specification) => specification.value).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="px-6 py-7 text-sm text-muted">{t("storefront", "noQuickMatch")}</p>
          )}

          {normalizedQuery ? (
            <button
              className="focus-ring flex w-full items-center justify-between border-t border-border px-5 py-4 text-start text-sm font-bold text-primary transition hover:bg-[var(--ds-primary-soft)]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={navigateToSearch}
              type="button"
            >
              <span>{t("storefront", "searchAllResults")} “{query.trim()}”</span>
              <ArrowIcon rtl={direction === "rtl"} />
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function ArrowIcon({ rtl }: { rtl: boolean }) {
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d={rtl ? "M19 12H5m0 0 5-5m-5 5 5 5" : "M5 12h14m0 0-5-5m5 5-5 5"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}