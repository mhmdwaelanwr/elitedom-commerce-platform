"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/catalog";
import { usePreferences } from "@/providers/AppPreferencesProvider";

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
  const normalizedQuery = query.trim().toLowerCase();
  const resolvedPlaceholder = placeholder ?? t("storefront", "searchPlaceholder");

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
        [product.name, product.brand, product.sku, product.categoryName, ...product.specs.flatMap((specification) => [specification.label, specification.value])]
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
      <label className="sr-only" htmlFor={inputId}>{t("storefront", "searchProducts")}</label>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="focus-ring h-11 w-full rounded-xl border border-border bg-surface px-4 pe-12 text-sm text-foreground outline-none placeholder:text-muted"
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={resolvedPlaceholder}
          role="combobox"
          value={query}
        />
        <button
          aria-label={t("storefront", "searchCatalogue")}
          className="focus-ring absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-xl text-primary hover:brightness-110"
          type="submit"
        >
          <SearchIcon />
        </button>
      </div>

      {isOpen && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-surface p-2 text-foreground shadow-2xl backdrop-blur-xl" id={listboxId} role="listbox">
          {hasSuggestions ? (
            <>
              {categoryMatches.length > 0 && (
                <div className="px-2 pb-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    {normalizedQuery ? t("storefront", "departments") : t("storefront", "browseDepartments")}
                  </p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {categoryMatches.map((category) => (
                      <Link className="focus-ring rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-foreground" href={`/shop?category=${category.slug}`} key={category.slug} onClick={() => { setIsOpen(false); onNavigate?.(); }} role="option">
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {productMatches.length > 0 && (
                <div className="border-t border-border px-2 pb-1 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    {normalizedQuery ? t("storefront", "matchingProducts") : t("storefront", "popularPicks")}
                  </p>
                  <div className="mt-1 grid gap-1">
                    {productMatches.map((product) => (
                      <Link className="focus-ring flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-elevated" href={`/products/${product.id}`} key={product.id} onClick={() => { setIsOpen(false); onNavigate?.(); }} role="option">
                        <span className="min-w-0 truncate font-medium text-foreground">{product.name}</span>
                        <span className="shrink-0 text-xs text-primary">{product.brand}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="px-3 py-4 text-sm text-muted">{t("storefront", "noQuickMatch")}</p>
          )}
          {normalizedQuery && (
            <button className="focus-ring mt-1 flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm font-bold text-primary hover:bg-elevated" onMouseDown={(event) => event.preventDefault()} onClick={navigateToSearch} type="button">
              <span>{t("storefront", "searchAllResults")} “{query.trim()}”</span>
              <span aria-hidden="true">{direction === "rtl" ? "←" : "→"}</span>
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}
