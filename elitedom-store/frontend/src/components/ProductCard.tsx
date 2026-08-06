"use client";

import React from "react";
import Image from "next/image";

export interface ProductItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price_egp: number;
  price_usd: number;
  stock_qty: number;
  is_dropship: boolean;
  image_url: string;
  specs: string[];
}

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    sku: string;
    category: string;
    brand: string;
    price_egp: number;
    price_usd: number;
    stock_qty: number;
    is_dropship: boolean;
    image_url: string;
    specs: string[];
  };
  currency: "EGP" | "USD";
  onAddToCart: (product: ProductItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  onAddToCart,
}) => {
  const isAvailable = product.stock_qty > 0 || product.is_dropship;
  const priceDisplay =
    currency === "EGP"
      ? `EGP ${product.price_egp.toLocaleString()}`
      : `$${product.price_usd.toLocaleString()}`;

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col group relative">
      {/* Top Badge: Stock / Dropship */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        {product.stock_qty > 0 ? (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-500/90 text-slate-950 uppercase tracking-wider shadow">
            IN STOCK ({product.stock_qty})
          </span>
        ) : product.is_dropship ? (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-cyan-500/90 text-slate-950 uppercase tracking-wider shadow">
            DROPSHIP • 5-7 DAYS
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-500/90 text-white uppercase tracking-wider shadow">
            OUT OF STOCK
          </span>
        )}
      </div>

      {/* Brand Badge Top Right */}
      <div className="absolute top-3 right-3 z-10">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-slate-300 border border-slate-700">
          {product.brand}
        </span>
      </div>

      {/* Product Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950/60">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-4">
        <div>
          <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider mb-1">
            {product.category} • {product.sku}
          </div>
          <h3 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
            {product.name}
          </h3>

          {/* Key Specs Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {product.specs.map((spec, i) => (
              <span
                key={i}
                className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>

        {/* Price and Action */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
          <div>
            <div className="text-xs text-slate-400">Retail Price (VAT Inc)</div>
            <div className="text-lg font-black text-amber-400">
              {priceDisplay}
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            disabled={!isAvailable}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isAvailable
                ? "bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-md hover:scale-105"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isAvailable ? "+ Add to Cart" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
};
