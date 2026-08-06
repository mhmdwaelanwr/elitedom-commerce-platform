"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store/StoreProvider";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/store";

type StoreProductCardProps = { product: Product; variant?: "grid" | "list" };

export function StoreProductCard({ product, variant = "grid" }: StoreProductCardProps) {
  const { addToCart, currency, toggleWishlist, wishlist } = useStore();
  const available = product.stockQty > 0 || product.dropshipEnabled;
  const isSaved = wishlist.includes(product.id);
  const isList = variant === "list";

  return (
    <article className={`group relative flex overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-500/60 hover:shadow-xl hover:shadow-sky-950/20 ${isList ? "flex-col sm:flex-row" : "h-full flex-col"}`}>
      <div className="absolute left-3 top-3 z-10">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${product.stockQty > 0 ? "bg-emerald-400 text-emerald-950" : product.dropshipEnabled ? "bg-amber-300 text-amber-950" : "bg-rose-500 text-white"}`}>
          {product.stockQty > 0 ? `${product.stockQty} in stock` : product.dropshipEnabled ? "Dropship available" : "Out of stock"}
        </span>
      </div>
      <button
        aria-label={isSaved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition focus-ring ${isSaved ? "border-rose-400/50 bg-rose-500 text-white" : "border-slate-700 bg-slate-950/75 text-slate-200 hover:border-sky-400 hover:text-sky-300"}`}
        onClick={() => toggleWishlist(product.id)}
        type="button"
      >
        <HeartIcon filled={isSaved} />
      </button>
      <Link
        aria-label={`View ${product.name}`}
        className={`relative block shrink-0 overflow-hidden bg-slate-100 focus-ring ${isList ? "aspect-[16/10] sm:min-h-64 sm:w-64 sm:aspect-auto" : "aspect-square"}`}
        href={`/products/${product.id}`}
      >
        <Image alt={product.name} className="object-contain p-7 transition duration-500 group-hover:scale-105" fill sizes={isList ? "(min-width: 640px) 256px, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"} src={product.image} />
      </Link>
      <div className={`flex min-w-0 flex-1 flex-col p-5 ${isList ? "sm:p-6" : ""}`}>
        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
          <span className="truncate text-sky-300">{product.brand}</span>
          <span className="shrink-0 text-emerald-300">{product.rating > 0 ? `★ ${product.rating.toFixed(1)}` : "✓ Verified catalogue"}</span>
        </div>
        <Link className={`mt-2 font-bold leading-6 text-white hover:text-sky-300 focus-ring ${isList ? "text-lg sm:text-xl" : "line-clamp-2 min-h-12 text-base"}`} href={`/products/${product.id}`}>{product.name}</Link>
        <p className={`mt-2 text-sm leading-5 text-slate-400 ${isList ? "line-clamp-3 max-w-3xl" : "line-clamp-2"}`}>{product.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {product.specs.slice(0, isList ? 4 : 2).map((spec) => <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300" key={`${spec.label}-${spec.value}`}>{spec.label}: {spec.value}</span>)}
        </div>
        <div className={`mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-slate-800 pt-4 ${isList ? "sm:mt-5" : ""}`}>
          <div><p className="text-[11px] font-medium text-slate-500">VAT included</p><p className="mt-0.5 text-lg font-black text-white">{formatPrice(product.priceEgp, currency)}</p></div>
          <div className="flex items-center gap-2">
            {isList ? <Link className="hidden text-sm font-bold text-sky-300 hover:text-white focus-ring sm:inline" href={`/products/${product.id}`}>Details</Link> : null}
            <button className="button-primary shrink-0 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500" disabled={!available} onClick={() => addToCart(product)} type="button">{available ? "Add to cart" : "Unavailable"}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="18" viewBox="0 0 24 24" width="18"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
