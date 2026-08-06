"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/catalog";

type StorefrontSearchProps = {
  inputId: string;
  onNavigate?: () => void;
  placeholder?: string;
};

/**
 * A light-weight discovery layer for the global search. Submitting always
 * delegates to the catalogue route, which in turn asks the FastAPI search API.
 * Local suggestions keep the header responsive while the user is typing.
 */
export function StorefrontSearch({
  inputId,
  onNavigate,
  placeholder = "Search products, brands, or SKU…",
}: StorefrontSearchProps) {
  const router = useRouter();
  const generatedId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const { categoryMatches, productMatches } = useMemo(() => {
    if (!normalizedQuery) {
      return {
        categoryMatches: CATEGORIES.slice(0, 4),
        productMatches: CATALOG.filter((product) => product.featured).slice(0, 4),
      };
    }

    return {
      categoryMatches: CATEGORIES.filter((category) =>
        [category.name, category.description].join(" ").toLowerCase().includes(normalizedQuery),
      ).slice(0, 3),
      productMatches: CATALOG.filter((product) =>
        [
          product.name,
          product.brand,
          product.sku,
          product.categoryName,
          ...product.specs.flatMap((specification) => [specification.label, specification.value]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ).slice(0, 5),
    };
  }, [normalizedQuery]);

  const hasSuggestions = categoryMatches.length > 0 || productMatches.length > 0;
  const listboxId = `${inputId}-${generatedId}-suggestions`;

  function navigateToSearch() {
    const destination = query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : "/shop";
    setIsOpen(false);
    onNavigate?.();
    router.push(destination);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateToSearch();
  }

  return (
    <form className="relative" onSubmit={handleSubmit} role="search">
      <label className="sr-only" htmlFor={inputId}>
        Search products
      </label>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 pr-12 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          role="combobox"
          value={query}
        />
        <button
          aria-label="Search catalogue"
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-sky-300 hover:text-white focus-ring"
          type="submit"
        >
          <SearchIcon />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/98 p-2 shadow-2xl shadow-slate-950/70 backdrop-blur-xl"
          id={listboxId}
          role="listbox"
        >
          {hasSuggestions ? (
            <>
              {categoryMatches.length > 0 && (
                <div className="px-2 pb-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {normalizedQuery ? "Departments" : "Browse departments"}
                  </p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {categoryMatches.map((category) => (
                      <Link
                        className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white focus-ring"
                        href={`/shop?category=${category.slug}`}
                        key={category.slug}
                        onClick={() => {
                          setIsOpen(false);
                          onNavigate?.();
                        }}
                        role="option"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {productMatches.length > 0 && (
                <div className="border-t border-slate-800 px-2 pb-1 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {normalizedQuery ? "Matching products" : "Popular picks"}
                  </p>
                  <div className="mt-1 grid gap-1">
                    {productMatches.map((product) => (
                      <Link
                        className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-slate-800 focus-ring"
                        href={`/products/${product.id}`}
                        key={product.id}
                        onClick={() => {
                          setIsOpen(false);
                          onNavigate?.();
                        }}
                        role="option"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-200">{product.name}</span>
                        <span className="shrink-0 text-xs text-sky-300">{product.brand}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-400">
              No quick match yet. Press Enter to search the full catalogue.
            </p>
          )}
          {normalizedQuery && (
            <button
              className="mt-1 flex w-full items-center justify-between rounded-lg border-t border-slate-800 px-3 py-2.5 text-left text-sm font-bold text-sky-300 hover:bg-slate-900 hover:text-white focus-ring"
              onMouseDown={(event) => event.preventDefault()}
              onClick={navigateToSearch}
              type="button"
            >
              <span>Search all results for “{query.trim()}”</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
