"use client";

import React from "react";
import Link from "next/link";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950/90 border-t border-slate-800/80 text-slate-400 text-xs py-16 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Col 1: Brand & ERP Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-400 flex items-center justify-center font-black text-black text-base">
              E
            </div>
            <span className="text-lg font-black text-white">
              ELITE<span className="text-cyan-400">DOM</span> STORE
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Egypt&apos;s premier enterprise e-commerce platform for high-performance hardware, workstations, and institutional B2B procurement.
          </p>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300">
              Odoo 17 CE ERP Sync: ACTIVE
            </span>
          </div>
        </div>

        {/* Col 2: Catalog & Categories */}
        <div className="space-y-3">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Hardware Catalog
          </h4>
          <ul className="space-y-2">
            <li>
              <Link href="#gaming" className="hover:text-cyan-400 transition-colors">
                Gaming Desktops & Custom Rigs
              </Link>
            </li>
            <li>
              <Link href="#workstations" className="hover:text-cyan-400 transition-colors">
                Enterprise Workstations
              </Link>
            </li>
            <li>
              <Link href="#catalog" className="hover:text-cyan-400 transition-colors">
                NVIDIA RTX Graphics Cards
              </Link>
            </li>
            <li>
              <Link href="#catalog" className="hover:text-cyan-400 transition-colors">
                High-Speed NVMe Storage
              </Link>
            </li>
            <li>
              <Link href="#catalog" className="hover:text-cyan-400 transition-colors">
                DDR5 Memory Modules
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Egyptian Governorates & Delivery */}
        <div className="space-y-3">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Egyptian Coverage
          </h4>
          <p className="text-slate-400">
            We deliver across all 27 Egyptian governorates with insured express courier service:
          </p>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
            <div>• Cairo & Giza (24h)</div>
            <div>• Alexandria (48h)</div>
            <div>• Qalyubia & Sharqia</div>
            <div>• Dakahlia & Tanta</div>
            <div>• Red Sea & Hurghada</div>
            <div>• Luxor & Aswan</div>
          </div>
          <div className="text-[11px] text-amber-400 font-bold pt-1">
            ⚡ 14% Egyptian VAT Included on all invoices.
          </div>
        </div>

        {/* Col 4: Audit & Blockchain Verification */}
        <div className="space-y-3">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Security & Audit
          </h4>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span>🔒 HEDERA AUDIT CERTIFIED</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Every purchase and RMA warranty ticket is cryptographically hashed onto the Hedera Consensus Service for immutable consumer verification.
            </p>
            <div className="text-[10px] text-cyan-400 font-mono">
              Topic ID: 0.0.5982144
            </div>
          </div>
          <div className="pt-2 text-slate-400">
            Supported Payments: Stripe • Meeza • InstaPay • COD
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500 gap-4">
        <div>
          © {new Date().getFullYear()} Elitedom Store (elitedom.store) — All rights reserved.
        </div>
        <div className="flex items-center gap-6">
          <Link href="#" className="hover:text-slate-300">
            Privacy Policy
          </Link>
          <Link href="#" className="hover:text-slate-300">
            Terms of Service
          </Link>
          <Link href="#" className="hover:text-slate-300">
            RMA Warranty Terms
          </Link>
        </div>
      </div>
    </footer>
  );
};
