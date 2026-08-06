"use client";

import Image from "next/image";
import Link from "next/link";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/components/store/StoreProvider";

export default function CartPage() {
  const { cart, cartCount, currency, removeFromCart, updateQuantity } = useStore();
  const totals = getCheckoutTotals(cart, GOVERNORATES[0]);

  if (cart.length === 0) {
    return <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center"><div><div className="mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-slate-900 text-3xl">🛒</div><h1 className="mt-5 text-3xl font-black text-white">Your cart is ready when you are</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">Add products from the catalogue and your cart will stay available in this browser while you continue shopping.</p><Link className="button-primary mt-6" href="/shop">Explore products</Link></div></div>;
  }

  return (
    <div className="site-container py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/">Home</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">Cart</span></nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Review your selection</p><h1 className="mt-2 text-3xl font-black text-white">Shopping cart</h1></div><p className="text-sm text-slate-400">{cartCount} item{cartCount === 1 ? "" : "s"}</p></div>
      <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_21rem]">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="hidden grid-cols-[1fr_8rem_9rem_7rem] gap-4 border-b border-slate-800 px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid"><span>Product</span><span>Price</span><span>Quantity</span><span>Total</span></div>
          <ul className="divide-y divide-slate-800">
            {cart.map((item) => {
              const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
              return <li className="grid gap-4 p-4 sm:grid-cols-[6rem_1fr_auto] md:grid-cols-[1fr_8rem_9rem_7rem] md:items-center md:px-6 md:py-5" key={item.product.id}>
                <div className="flex min-w-0 gap-4 sm:contents md:flex"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white sm:row-span-2 md:hidden"><Image alt="" className="object-contain p-2" fill sizes="80px" src={item.product.image} /></div><div className="hidden min-w-0 gap-4 md:flex"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white"><Image alt="" className="object-contain p-2" fill sizes="64px" src={item.product.image} /></div><div><Link className="font-bold text-white hover:text-sky-300 focus-ring" href={`/products/${item.product.id}`}>{item.product.name}</Link><p className="mt-1 text-xs text-slate-500">{item.product.sku} · {item.product.dropshipEnabled && item.product.stockQty === 0 ? "Dropship" : "Local stock"}</p></div></div><div className="sm:hidden"><Link className="font-bold text-white hover:text-sky-300 focus-ring" href={`/products/${item.product.id}`}>{item.product.name}</Link><p className="mt-1 text-xs text-slate-500">{item.product.sku}</p></div></div>
                <p className="hidden text-sm font-semibold text-slate-200 md:block">{formatPrice(item.product.priceEgp, currency)}</p>
                <div className="flex items-center gap-3"><div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950"><button aria-label={`Decrease quantity of ${item.product.name}`} className="grid h-9 w-9 place-items-center text-slate-300 hover:text-white focus-ring" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} type="button">−</button><span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span><button aria-label={`Increase quantity of ${item.product.name}`} className="grid h-9 w-9 place-items-center text-slate-300 hover:text-white disabled:text-slate-600 focus-ring" disabled={item.quantity >= maximum} onClick={() => updateQuantity(item.product.id, item.quantity + 1)} type="button">+</button></div><button className="text-xs font-semibold text-slate-500 hover:text-rose-300 focus-ring md:hidden" onClick={() => removeFromCart(item.product.id)} type="button">Remove</button></div>
                <div className="flex items-center justify-between gap-3 md:block"><p className="text-sm font-black text-white">{formatPrice(item.product.priceEgp * item.quantity, currency)}</p><button className="mt-2 hidden text-xs font-semibold text-slate-500 hover:text-rose-300 focus-ring md:block" onClick={() => removeFromCart(item.product.id)} type="button">Remove</button></div>
              </li>;
            })}
          </ul>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:sticky lg:top-28"><h2 className="text-lg font-bold text-white">Order estimate</h2><dl className="mt-5 grid gap-3 text-sm"><Row label="Products" value={formatPrice(totals.subtotal, currency)} /><Row label="Delivery (Cairo)" value={formatPrice(totals.shipping, currency)} /><Row label="VAT (14%)" value={formatPrice(totals.vat, currency)} /><div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-4"><dt className="font-bold text-white">Estimated total</dt><dd className="text-xl font-black text-sky-300">{formatPrice(totals.total, currency)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-slate-400">Your final shipping cost is based on the delivery governorate selected at checkout.</p><Link className="button-primary mt-6 flex w-full" href="/checkout">Continue to checkout</Link><Link className="mt-4 block text-center text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/shop">Continue shopping</Link></aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">{label}</dt><dd className="font-semibold text-slate-200">{value}</dd></div>;
}
