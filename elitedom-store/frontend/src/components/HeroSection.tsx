"use client";

import React from "react";
import Image from "next/image";

export const HeroSection: React.FC = () => {
  return (
    <section className="relative pt-28 pb-20 px-4 lg:px-8 overflow-hidden">
      {/* Background ambient glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-500/20 to-blue-600/10 blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headline & Value Propositions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              ⚡ EGYPTIAN TECH RETAIL LEADER
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              ✓ 14% EGP VAT INCLUDED
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              🚀 NEXT-DAY CAIRO & GIZA DELIVERY
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none text-white">
            FLAGSHIP <span className="gradient-text">HARDWARE</span> FOR EGYPTIAN ENTERPRISE.
          </h1>

          <p className="text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
            Experience next-generation computing power with automated Odoo 17 CE ERP synchronization, real-time inventory tracking, and Hedera blockchain-verified warranty protection.
          </p>

          {/* Key ERP & Integration Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <div className="text-2xl font-black text-cyan-400">100%</div>
              <div className="text-xs text-slate-400">Odoo 17 CE Synced</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400">27 Gov</div>
              <div className="text-xs text-slate-400">Egyptian Shipping</div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">SHA-256</div>
              <div className="text-xs text-slate-400">Hedera Audit Trail</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <a href="#catalog" className="btn-primary flex items-center gap-2">
              <span>Explore Hardware Catalog</span>
              <span>→</span>
            </a>
            <a href="#b2b" className="btn-secondary">
              Request Institutional RFQ
            </a>
          </div>
        </div>

        {/* Right Column: Hero Hardware Showcase (Using generated images) */}
        <div className="lg:col-span-5 relative">
          <div className="relative z-10 glass-card rounded-2xl p-4 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950">
              <Image
                src="/images/gaming_pc.png"
                alt="Elitedom Custom Liquid Cooled Gaming Rig"
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
                priority
              />
              <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-lg border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    ELITEDOM AETHERIUM RIG v4
                  </div>
                  <div className="text-[10px] text-cyan-400 font-semibold">
                    RTX 4090 • Core i9-14900K • Custom Loop
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-amber-400">
                    EGP 185,000
                  </div>
                  <div className="text-[9px] text-emerald-400">
                    IN STOCK • WH-CAIRO
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badge bottom left */}
          <div className="absolute -bottom-6 -left-6 z-20 glass-panel px-4 py-3 rounded-xl border border-white/10 hidden sm:flex items-center gap-3 shadow-xl animate-float">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
              🔒
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Hedera Consensus Verified
              </div>
              <div className="text-[10px] text-slate-400">
                Immutable purchase & warranty hash
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
