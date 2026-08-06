"use client";

import React, { useState } from "react";
import Link from "next/link";

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  currency: "EGP" | "USD";
  onToggleCurrency: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  onOpenCart,
  currency,
  onToggleCurrency,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-navbar px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-xl text-black shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform">
            E
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
              ELITE<span className="text-cyan-400">DOM</span>
            </span>
            <span className="text-[10px] tracking-widest text-slate-400 font-semibold uppercase">
              Egyptian Tech Retail • Odoo ERP
            </span>
          </div>
        </Link>

        {/* Search Bar (Algolia-powered feel) */}
        <div className="hidden md:flex flex-1 max-w-lg relative">
          <input
            type="text"
            placeholder="Search RTX 4090, Liquid Cooling, Workstations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-full py-2 px-5 pl-11 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
          />
          <svg
            className="w-5 h-5 text-slate-400 absolute left-3.5 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-300">
          <Link href="#catalog" className="hover:text-cyan-400 transition-colors">
            Hardware Catalog
          </Link>
          <Link href="#gaming" className="hover:text-cyan-400 transition-colors">
            Gaming Rigs
          </Link>
          <Link href="#workstations" className="hover:text-cyan-400 transition-colors">
            Workstations
          </Link>
          <Link
            href="#b2b"
            className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <span>B2B Institutional</span>
            <span className="text-[9px] bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
              RFQ
            </span>
          </Link>
          <Link href="#warranty" className="hover:text-cyan-400 transition-colors">
            Warranty RMA
          </Link>
        </nav>

        {/* Right Controls: Currency, Loyalty, Cart */}
        <div className="flex items-center gap-3">
          {/* Currency Switcher */}
          <button
            onClick={onToggleCurrency}
            className="px-2.5 py-1 text-xs font-bold rounded-md border border-slate-700 bg-slate-800/80 hover:border-cyan-400 text-cyan-400 transition-all"
            title="Toggle EGP / USD pricing"
          >
            {currency} ⇄
          </button>

          {/* Loyalty Points Badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold text-amber-400">
            <span>👑 1,240 Pts</span>
          </div>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
          >
            <svg
              className="w-5 h-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-sm">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 text-black font-black text-xs rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
