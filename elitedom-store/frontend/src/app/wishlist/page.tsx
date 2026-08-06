"use client";

import Link from "next/link";
import { CATALOG } from "@/lib/catalog";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { useStore } from "@/components/store/StoreProvider";

export default function WishlistPage() {
  const { wishlist } = useStore();
  const products = CATALOG.filter((product) => wishlist.includes(product.id));

  return <div className="site-container py-10 sm:py-14"><nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/">Home</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">Wishlist</span></nav><div className="mt-6"><p className="section-kicker">Save for later</p><h1 className="mt-2 text-3xl font-black text-white">Your wishlist</h1><p className="mt-3 text-sm text-slate-400">Keep an eye on products you may want to add to your setup.</p></div>{products.length > 0 ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <StoreProductCard key={product.id} product={product} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center"><p className="text-3xl">♡</p><h2 className="mt-4 text-lg font-bold text-white">Nothing saved yet</h2><p className="mt-2 text-sm text-slate-400">Tap the heart on any product card to save it here.</p><Link className="button-primary mt-5" href="/shop">Browse products</Link></div>}</div>;
}
