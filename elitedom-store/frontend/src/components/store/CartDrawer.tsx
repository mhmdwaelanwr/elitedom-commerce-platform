"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/components/store/StoreProvider";

export function CartDrawer() {
  const {
    cart,
    cartCount,
    cartSubtotal,
    currency,
    isCartOpen,
    removeFromCart,
    setCartOpen,
    updateQuantity,
  } = useStore();

  useEffect(() => {
    if (!isCartOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isCartOpen, setCartOpen]);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        aria-label="Close cart"
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
        type="button"
      />
      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <p className="text-lg font-bold text-white">Your cart</p>
            <p className="mt-0.5 text-sm text-slate-400">{cartCount} item{cartCount === 1 ? "" : "s"} selected</p>
          </div>
          <button aria-label="Close cart" className="grid h-10 w-10 place-items-center rounded-lg text-xl text-slate-300 hover:bg-slate-900 hover:text-white focus-ring" onClick={() => setCartOpen(false)} type="button">×</button>
        </div>

        {cart.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-2xl">🛒</div>
              <h2 className="mt-5 text-lg font-bold text-white">Your cart is empty</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Explore curated technology products, then add what suits your setup.</p>
              <Link className="button-primary mt-6" href="/shop" onClick={() => setCartOpen(false)}>Browse catalogue</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <ul className="grid gap-4">
                {cart.map((item) => {
                  const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
                  return (
                    <li className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3" key={item.product.id}>
                      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-white">
                        <Image alt="" className="object-contain p-1" fill sizes="72px" src={item.product.image} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link className="line-clamp-2 text-sm font-semibold text-slate-100 hover:text-sky-300 focus-ring" href={`/products/${item.product.id}`} onClick={() => setCartOpen(false)}>{item.product.name}</Link>
                        <p className="mt-1 text-sm font-bold text-sky-300">{formatPrice(item.product.priceEgp, currency)}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950">
                            <button aria-label={`Decrease ${item.product.name} quantity`} className="grid h-8 w-8 place-items-center text-slate-300 hover:text-white focus-ring" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} type="button">−</button>
                            <span className="min-w-8 text-center text-sm font-semibold text-white">{item.quantity}</span>
                            <button aria-label={`Increase ${item.product.name} quantity`} className="grid h-8 w-8 place-items-center text-slate-300 hover:text-white disabled:text-slate-600 focus-ring" disabled={item.quantity >= maximum} onClick={() => updateQuantity(item.product.id, item.quantity + 1)} type="button">+</button>
                          </div>
                          <button className="text-xs font-semibold text-slate-400 hover:text-rose-300 focus-ring" onClick={() => removeFromCart(item.product.id)} type="button">Remove</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="border-t border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs uppercase tracking-wider text-slate-400">Product subtotal</p><p className="mt-1 text-xl font-black text-white">{formatPrice(cartSubtotal, currency)}</p></div>
                <p className="max-w-32 text-right text-xs leading-5 text-slate-400">Delivery and 14% VAT are calculated at checkout.</p>
              </div>
              <Link className="button-primary mt-5 flex w-full justify-center" href="/checkout" onClick={() => setCartOpen(false)}>Secure checkout</Link>
              <Link className="mt-3 block text-center text-sm font-semibold text-sky-300 hover:text-white focus-ring" href="/cart" onClick={() => setCartOpen(false)}>View full cart</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
