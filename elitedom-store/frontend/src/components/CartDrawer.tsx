"use client";

import React, { useState } from "react";

interface CartItem {
  id: number;
  product_id: number;
  name: string;
  price_egp: number;
  price_usd: number;
  quantity: number;
  sku: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: "EGP" | "USD";
  onUpdateQty: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
  onCheckout: (governorate: string, useLoyalty: boolean) => void;
}

const GOV_RATES_EGP: Record<string, number> = {
  Cairo: 50,
  Giza: 50,
  Alexandria: 75,
  Qalyubia: 60,
  Dakahlia: 80,
  "Red Sea": 150,
  Aswan: 150,
  Luxor: 120,
};

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  currency,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
}) => {
  const [governorate, setGovernorate] = useState("Cairo");
  const [useLoyalty, setUseLoyalty] = useState(false);

  if (!isOpen) return null;

  const subtotalEgp = items.reduce(
    (acc, item) => acc + item.price_egp * item.quantity,
    0
  );
  const subtotalUsd = items.reduce(
    (acc, item) => acc + item.price_usd * item.quantity,
    0
  );

  const shippingEgp = GOV_RATES_EGP[governorate] || 100;
  const shippingUsd = Math.round(shippingEgp / 49);

  const subtotal = currency === "EGP" ? subtotalEgp : subtotalUsd;
  const shipping = currency === "EGP" ? shippingEgp : shippingUsd;
  const vat = Math.round((subtotal + shipping) * 0.14);
  const loyaltyDiscountEgp = useLoyalty ? 120 : 0; // Example 2,400 pts = EGP 120
  const loyaltyDiscount =
    currency === "EGP" ? loyaltyDiscountEgp : Math.round(loyaltyDiscountEgp / 49);

  const total = subtotal + shipping + vat - loyaltyDiscount;

  const formatPrice = (val: number) =>
    currency === "EGP"
      ? `EGP ${val.toLocaleString()}`
      : `$${val.toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md glass-panel border-l border-cyan-500/30 flex flex-col justify-between shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span>🛒 Shopping Cart</span>
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  {items.length} items
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Odoo 17 CE Stock & Hedera Hash Guaranteed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-4xl mb-3">🛒</div>
                <p className="font-semibold text-white">Your cart is empty.</p>
                <p className="text-xs mt-1">
                  Add some high-end hardware to get started!
                </p>
              </div>
            ) : (
              items.map((item) => {
                const itemPrice =
                  currency === "EGP" ? item.price_egp : item.price_usd;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="text-[10px] text-cyan-400 font-bold">
                        {item.sku}
                      </div>
                      <h4 className="text-sm font-extrabold text-white">
                        {item.name}
                      </h4>
                      <div className="text-xs font-bold text-amber-400 mt-1">
                        {formatPrice(itemPrice * item.quantity)}
                      </div>
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-6 h-6 text-slate-300 hover:text-cyan-400 font-bold"
                      >
                        -
                      </button>
                      <span className="text-sm font-bold text-white px-2">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-6 h-6 text-slate-300 hover:text-cyan-400 font-bold"
                      >
                        +
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Checkout Summary */}
          {items.length > 0 && (
            <div className="p-6 border-t border-slate-800 space-y-4 bg-slate-950/60">
              {/* Governorate Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Shipping Governorate:</span>
                <select
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 font-bold text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="Cairo">Cairo (EGP 50)</option>
                  <option value="Giza">Giza (EGP 50)</option>
                  <option value="Alexandria">Alexandria (EGP 75)</option>
                  <option value="Dakahlia">Dakahlia (EGP 80)</option>
                  <option value="Red Sea">Red Sea (EGP 150)</option>
                </select>
              </div>

              {/* Loyalty Switch */}
              <div className="flex items-center justify-between text-xs bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <span>👑 Redeem 2,400 Loyalty Pts</span>
                  <span className="text-[10px] text-slate-400">(-EGP 120)</span>
                </div>
                <input
                  type="checkbox"
                  checked={useLoyalty}
                  onChange={(e) => setUseLoyalty(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="text-white font-bold">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Shipping ({governorate}):</span>
                  <span className="text-white font-bold">
                    {formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Egyptian VAT (14% Included):</span>
                  <span className="text-white font-bold">
                    {formatPrice(vat)}
                  </span>
                </div>
                {useLoyalty && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Loyalty Discount:</span>
                    <span>-{formatPrice(loyaltyDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>Total Amount:</span>
                  <span className="text-cyan-400">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onCheckout(governorate, useLoyalty)}
                className="w-full btn-gold py-3 text-sm flex items-center justify-center gap-2"
              >
                <span>⚡ Proceed to Checkout</span>
                <span>→</span>
              </button>

              <div className="text-center text-[10px] text-slate-400">
                Secure SSL • Odoo 17 CE Sync • Instant Invoice
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
