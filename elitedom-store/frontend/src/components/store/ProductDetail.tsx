"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchProduct } from "@/lib/api";
import { CATALOG } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { useStore } from "@/components/store/StoreProvider";
import type { Product } from "@/types/store";

export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const { addToCart, currency, notify, setCartOpen, toggleWishlist, wishlist } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      setActiveImage(0);
      setQuantity(1);
      fetchProduct(productId)
        .then((nextProduct) => {
          if (!live) return;
          if (!nextProduct) setError("This product is no longer available.");
          setProduct(nextProduct ?? null);
        })
        .catch((requestError: unknown) => {
          if (!live) return;
          setError(requestError instanceof Error ? requestError.message : "Could not load this product.");
        })
        .finally(() => {
          if (live) setIsLoading(false);
        });
    }, 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [productId]);

  const relatedProducts = useMemo(
    () => (product ? CATALOG.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3) : []),
    [product],
  );

  if (isLoading) return <ProductSkeleton />;
  if (error || !product) return <ProductUnavailable message={error ?? "This product is no longer available."} />;

  const currentProduct = product;
  const available = currentProduct.stockQty > 0 || currentProduct.dropshipEnabled;
  const maximum = currentProduct.dropshipEnabled ? 100 : currentProduct.stockQty;
  const selectedImage = currentProduct.gallery[activeImage] ?? currentProduct.image;
  const isSaved = wishlist.includes(currentProduct.id);

  function handleBuyNow() {
    if (!available) return;
    addToCart(currentProduct, quantity);
    // `addToCart` intentionally opens the cart for normal browsing. A buy-now
    // action takes the customer directly to checkout instead.
    setCartOpen(false);
    router.push("/checkout");
  }

  return (
    <div className="site-container py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/">Home</Link> <span aria-hidden="true">/</span> <Link className="hover:text-white focus-ring" href={`/shop?category=${product.category}`}>{product.categoryName}</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">{product.name}</span></nav>
      <section className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.9fr)]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-slate-800 bg-slate-100"><Image alt={product.name} className="object-contain p-8" fill priority sizes="(min-width: 1024px) 50vw, 100vw" src={selectedImage} /></div>
          {product.gallery.length > 1 && <div className="mt-4 flex flex-wrap gap-3">{product.gallery.map((image, index) => <button aria-label={`Show image ${index + 1} for ${product.name}`} className={`relative h-20 w-20 overflow-hidden rounded-xl border bg-white p-1 focus-ring ${index === activeImage ? "border-sky-400 ring-2 ring-sky-400/30" : "border-slate-700 hover:border-slate-500"}`} key={image} onClick={() => setActiveImage(index)} type="button"><Image alt="" className="object-contain" fill sizes="80px" src={image} /></button>)}</div>}
        </div>
        <div className="lg:py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-300">{product.brand}</span><span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-200">★ {product.rating.toFixed(1)} customer rating</span></div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">{product.description}</p>
          <div className="mt-6 flex items-center gap-4 border-y border-slate-800 py-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Price, VAT included</p><p className="mt-1 text-3xl font-black text-white">{formatPrice(product.priceEgp, currency)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${product.stockQty > 0 ? "bg-emerald-400 text-emerald-950" : product.dropshipEnabled ? "bg-amber-300 text-amber-950" : "bg-rose-500 text-white"}`}>{product.stockQty > 0 ? `${product.stockQty} ready to ship` : product.dropshipEnabled ? "Supplier delivery available" : "Currently unavailable"}</span></div>
          <div className="mt-6 flex flex-wrap gap-3"><div className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900"><button aria-label="Decrease quantity" className="grid h-12 w-12 place-items-center text-lg text-slate-300 hover:text-white focus-ring" onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button">−</button><span className="w-10 text-center font-bold text-white">{quantity}</span><button aria-label="Increase quantity" className="grid h-12 w-12 place-items-center text-lg text-slate-300 hover:text-white disabled:text-slate-600 focus-ring" disabled={quantity >= maximum} onClick={() => setQuantity((current) => Math.min(maximum, current + 1))} type="button">+</button></div><button className="button-primary flex-1 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500" disabled={!available} onClick={() => addToCart(product, quantity)} type="button">{available ? "Add to cart" : "Unavailable"}</button><button className="button-secondary flex-1 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500 sm:flex-none" disabled={!available} onClick={handleBuyNow} type="button">Buy now</button><button aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"} className={`grid h-12 w-12 place-items-center rounded-xl border transition focus-ring ${isSaved ? "border-rose-400/50 bg-rose-500 text-white" : "border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-300"}`} onClick={() => { toggleWishlist(product.id); notify(isSaved ? "Removed from your wishlist." : "Saved to your wishlist.", "info"); }} type="button"><HeartIcon filled={isSaved} /></button></div>
          <dl className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm"><div className="flex justify-between gap-5"><dt className="text-slate-400">SKU</dt><dd className="font-semibold text-slate-200">{product.sku}</dd></div><div className="flex justify-between gap-5"><dt className="text-slate-400">Warranty</dt><dd className="font-semibold text-slate-200">{product.warrantyMonths} months</dd></div><div className="flex justify-between gap-5"><dt className="text-slate-400">Fulfilment</dt><dd className="font-semibold text-slate-200">{product.stockQty > 0 ? "Elitedom local stock" : "Verified supplier dropship"}</dd></div></dl>
        </div>
      </section>
      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_20rem]"><div><h2 className="text-2xl font-black text-white">Technical details</h2><div className="mt-5 overflow-hidden rounded-2xl border border-slate-800"><dl className="divide-y divide-slate-800">{product.specs.map((spec) => <div className="grid grid-cols-2 gap-4 bg-slate-900/50 px-5 py-4 text-sm" key={spec.label}><dt className="font-medium text-slate-400">{spec.label}</dt><dd className="font-semibold text-slate-100">{spec.value}</dd></div>)}</dl></div></div><aside className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-6"><h2 className="font-bold text-white">Need help deciding?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Ask about compatibility, delivery options, or business pricing before you order.</p><Link className="button-secondary mt-5 w-full" href="/b2b">Talk to B2B team</Link><Link className="mt-4 block text-center text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/warranty">Warranty support</Link></aside></section>
      {relatedProducts.length > 0 && <section className="mt-16 border-t border-slate-800 pt-12"><div className="flex items-end justify-between gap-4"><div><p className="section-kicker">Complete your setup</p><h2 className="mt-2 text-2xl font-black text-white">You might also like</h2></div><Link className="text-sm font-bold text-sky-300 hover:text-white focus-ring" href={`/shop?category=${product.category}`}>See more</Link></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{relatedProducts.map((item) => <StoreProductCard key={item.id} product={item} />)}</div></section>}
    </div>
  );
}

function ProductSkeleton() {
  return <div className="site-container py-14"><div className="grid animate-pulse gap-10 lg:grid-cols-2"><div className="aspect-square rounded-3xl bg-slate-900" /><div className="space-y-5 pt-4"><div className="h-5 w-24 rounded bg-slate-900" /><div className="h-12 w-4/5 rounded bg-slate-900" /><div className="h-24 rounded bg-slate-900" /><div className="h-14 rounded bg-slate-900" /></div></div></div>;
}

function ProductUnavailable({ message }: { message: string }) {
  return <div className="site-container grid min-h-[55vh] place-items-center py-14 text-center"><div><p className="text-4xl">⌁</p><h1 className="mt-4 text-2xl font-black text-white">Product unavailable</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{message}</p><Link className="button-primary mt-6" href="/shop">Return to catalogue</Link></div></div>;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} height="19" viewBox="0 0 24 24" width="19"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.5a5.5 5.5 0 0 0-.1-7.8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
