"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, fetchCustomerAddresses, type CustomerAddress, submitCheckout } from "@/lib/api";
import { GOVERNORATES, getCheckoutTotals } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/components/store/StoreProvider";
import type { CheckoutDetails, CheckoutResult } from "@/types/store";

export default function CheckoutPage() {
  const { cart, clearCart, currency, guestSessionId, notify, session } = useStore();
  const [form, setForm] = useState<CheckoutDetails>({ fullName: "", email: "", phone: "+20", shippingAddress: "", governorate: "Cairo", paymentMethod: "cash_on_delivery", notes: "", useLoyaltyPoints: false });
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const totals = useMemo(() => getCheckoutTotals(cart, form.governorate), [cart, form.governorate]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchCustomerAddresses(session).then((addresses) => {
      if (active) setSavedAddresses(addresses);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session]);

  function update<K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function selectSavedAddress(addressId: string) {
    const address = savedAddresses.find((item) => item.id === Number(addressId));
    if (!address) return;
    setForm((current) => ({
      ...current,
      fullName: address.recipient_name,
      email: current.email || session?.email || "",
      phone: address.recipient_phone,
      shippingAddress: [address.street_address, address.address_line_2, address.city, address.country].filter(Boolean).join(", "),
      governorate: address.governorate,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (cart.length === 0) { setError("Your cart is empty. Add a product before checkout."); return; }
    if (!session && !guestSessionId) { setError("Preparing your secure guest checkout. Please try again in a moment."); return; }
    setSubmitting(true);
    try {
      const nextResult = await submitCheckout(form, session, guestSessionId);
      clearCart();
      setResult(nextResult);
      notify(`Order ${nextResult.orderNumber} was created.`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not submit your order. Please try again.");
    } finally { setSubmitting(false); }
  }

  if (result) return <CheckoutSuccess hasAccount={Boolean(session)} result={result} />;
  if (cart.length === 0) return <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center"><div><p className="text-4xl">✓</p><h1 className="mt-4 text-3xl font-black text-white">Your cart is empty</h1><p className="mt-3 text-sm text-slate-400">Explore the catalogue to add products before you check out.</p><Link className="button-primary mt-6" href="/shop">Browse products</Link></div></div>;

  return <div className="site-container py-10 sm:py-14"><nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/">Home</Link> <span aria-hidden="true">/</span> <Link className="hover:text-white focus-ring" href="/cart">Cart</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">Checkout</span></nav><div className="mt-6"><p className="section-kicker">Secure checkout</p><h1 className="mt-2 text-3xl font-black text-white">Delivery and payment</h1><p className="mt-2 text-sm leading-6 text-slate-400">Review delivery details, then create your order securely. VAT is included in the estimate.</p></div>{!session && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/30 bg-sky-300/10 p-4 text-sm text-sky-100"><span>Guest checkout is available. Sign in to retain order history and use loyalty points.</span><Link className="button-secondary border-sky-300/40 bg-transparent px-4 py-2 text-sky-100" href="/signin?next=/checkout">Sign in</Link></div>}<form className="mt-8 grid gap-7 lg:grid-cols-[1fr_22rem]" onSubmit={handleSubmit}><section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-7"><h2 className="text-xl font-black text-white">Shipping details</h2>{session && savedAddresses.length > 0 && <Field label="Use a saved address"><select className="form-input" defaultValue="" onChange={(event) => selectSavedAddress(event.target.value)}><option disabled value="">Select an address…</option>{savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.label}{address.is_default ? " (default)" : ""} · {address.city}</option>)}</select></Field>}<div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Full name"><input autoComplete="name" className="form-input" onChange={(event) => update("fullName", event.target.value)} required value={form.fullName} /></Field><Field label="Email"><input autoComplete="email" className="form-input" onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} /></Field><Field label="Mobile number"><input autoComplete="tel" className="form-input" onChange={(event) => update("phone", event.target.value)} required type="tel" value={form.phone} /></Field></div><Field label="Full delivery address"><textarea autoComplete="street-address" className="form-input mt-2 min-h-28 resize-y" onChange={(event) => update("shippingAddress", event.target.value)} placeholder="Building, street, area, city" required value={form.shippingAddress} /></Field><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Governorate"><select className="form-input" onChange={(event) => update("governorate", event.target.value)} value={form.governorate}>{GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}</select></Field><Field label="Payment method"><select className="form-input" onChange={(event) => update("paymentMethod", event.target.value as CheckoutDetails["paymentMethod"])} value={form.paymentMethod}><option value="credit_card">Credit / debit card</option><option value="instapay">Mobile wallet / InstaPay</option><option value="cash_on_delivery">Cash on delivery</option></select></Field></div><Field label="Order notes (optional)"><textarea className="form-input mt-2 min-h-24 resize-y" onChange={(event) => update("notes", event.target.value)} placeholder="Delivery timing, office reception, or other useful information" value={form.notes} /></Field>{session && <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300"><input checked={form.useLoyaltyPoints} className="mt-0.5 h-4 w-4 accent-sky-400" onChange={(event) => update("useLoyaltyPoints", event.target.checked)} type="checkbox" /><span><strong className="text-white">Apply eligible loyalty points</strong><br /><span className="text-xs leading-5 text-slate-500">The final discount is confirmed by your account&apos;s points policy when the order is created.</span></span></label>}{error && <p className="mt-5 rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}</section><OrderSummary currency={currency} totals={totals} isSubmitting={isSubmitting} /></form></div>;
}

function OrderSummary({ currency, isSubmitting, totals }: { currency: "EGP" | "USD"; isSubmitting: boolean; totals: ReturnType<typeof getCheckoutTotals> }) { return <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:sticky lg:top-28"><h2 className="text-lg font-black text-white">Order estimate</h2><dl className="mt-5 grid gap-3 text-sm"><Row label="Products" value={formatPrice(totals.subtotal, currency)} /><Row label="Delivery" value={formatPrice(totals.shipping, currency)} /><Row label="VAT (14%)" value={formatPrice(totals.vat, currency)} /><div className="mt-2 flex justify-between gap-4 border-t border-slate-700 pt-4"><dt className="font-bold text-white">Total</dt><dd className="text-xl font-black text-sky-300">{formatPrice(totals.total, currency)}</dd></div></dl><button className="button-primary mt-6 flex w-full disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating order…" : "Confirm order"}</button><p className="mt-4 text-center text-xs leading-5 text-slate-500">Encrypted payment processing · Clear VAT invoice · Delivery tracking after dispatch</p></aside>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-slate-400">{label}</dt><dd className="font-semibold text-slate-200">{value}</dd></div>; }
function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="mt-5 grid gap-2 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>; }
function CheckoutSuccess({ hasAccount, result }: { hasAccount: boolean; result: CheckoutResult }) { return <div className="site-container grid min-h-[55vh] place-items-center py-12"><section className="w-full max-w-xl rounded-3xl border border-emerald-300/25 bg-emerald-400/5 p-8 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400 text-3xl font-black text-emerald-950">✓</div><p className="section-kicker mt-6 text-emerald-300">Order created</p><h1 className="mt-2 text-3xl font-black text-white">Thank you for choosing Elitedom</h1><p className="mt-4 text-sm leading-6 text-slate-300">Your reference is <strong className="font-mono text-white">{result.orderNumber}</strong>. We&apos;ll use your delivery details to keep you updated.</p>{result.paymentGatewayUrl && <a className="button-primary mt-6" href={result.paymentGatewayUrl} rel="noreferrer" target="_blank">Continue to secure payment</a>}<Link className="button-secondary mt-6 ml-3" href={hasAccount ? "/account" : "/signup"}>{hasAccount ? "View account" : "Create an account to keep your history"}</Link><Link className="mt-6 block text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/shop">Continue shopping</Link></section></div>; }
