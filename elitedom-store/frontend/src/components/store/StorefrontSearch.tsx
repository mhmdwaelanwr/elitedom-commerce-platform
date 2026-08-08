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

export function StorefrontSearch({
  inputId,
  onNavigate,
  placeholder,
}: StorefrontSearchProps) {
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
          if (active) setProducts(result.slice(0, normalizedQuery ? 5 : 4));
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
    if (!normalizedQuery) return CATEGORIES.slice(0, 4);
    return CATEGORIES.filter((category) =>
      [category.name, category.description, categoryNames[category.slug] ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    ).slice(0, 4);
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
      <div className={`relative overflow-hidden rounded-xl border bg-background transition ${isOpen ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary"}`}>
        <span className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-muted" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="h-12 w-full bg-transparent ps-11 pe-24 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted"
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 160)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={resolvedPlaceholder}
          role="combobox"
          value={query}
        />
        <button
          className="focus-ring absolute inset-y-1 end-1 rounded-lg bg-primary px-4 text-xs font-black text-primary-contrast transition hover:brightness-105"
          type="submit"
        >
          {t("storefront", "search")}
        </button>
      </div>

      {isOpen ? (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          id={listboxId}
          role="listbox"
        >
          {isLoading && products.length === 0 ? (
            <div className="grid gap-2 p-4" aria-label={t("storefront", "checkingAvailability")}>
              {Array.from({ length: 4 }, (_, index) => (
                <div className="flex animate-pulse items-center gap-3" key={index}>
                  <div className="h-12 w-12 rounded-lg bg-elevated" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-elevated" />
                    <div className="h-4 w-3/4 rounded bg-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasSuggestions ? (
            <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="border-b border-border bg-elevated/60 p-3 md:border-b-0 md:border-e">
                <p className="px-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted">
                  {normalizedQuery ? t("storefront", "departments") : t("storefront", "browseDepartments")}
                </p>
                <div className="mt-2 grid gap-1">
                  {categoryMatches.map((category) => (
                    <Link
                      className="focus-ring flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-foreground transition hover:bg-surface hover:text-primary"
                      href={`/shop?category=${category.slug}`}
                      key={category.slug}
                      onClick={closeAndNotify}
                      role="option"
                    >
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-surface">
                        <Image alt="" className="object-contain p-1" fill sizes="32px" src={category.image} />
                      </span>
                      <span className="truncate">{categoryNames[category.slug] ?? category.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between gap-3 px-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">
                    {normalizedQuery ? t("storefront", "matchingProducts") : t("storefront", "popularPicks")}
                  </p>
                  {isLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" /> : null}
                </div>
                <div className="mt-2 grid gap-1">
                  {products.map((product) => (
                    <Link
                      className="focus-ring group flex items-center gap-3 rounded-xl p-2 transition hover:bg-elevated"
                      href={`/products/${encodeURIComponent(product.slug ?? product.id)}`}
                      key={product.id}
                      onClick={closeAndNotify}
                      role="option"
                    >
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
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
                      <span className={`h-2 w-2 shrink-0 rounded-full ${product.stockQty > 0 || product.dropshipEnabled ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">{t("storefront", "noQuickMatch")}</p>
          )}

          {normalizedQuery ? (
            <button
              className="focus-ring flex w-full items-center justify-between border-t border-border bg-background px-5 py-3 text-start text-sm font-black text-primary transition hover:bg-elevated"
              onMouseDown={(event) => event.preventDefault()}
              onClick={navigateToSearch}
              type="button"
            >
              <span>{t("storefront", "searchAllResults")} “{query.trim()}”</span>
              <span aria-hidden="true">{direction === "rtl" ? "←" : "→"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
