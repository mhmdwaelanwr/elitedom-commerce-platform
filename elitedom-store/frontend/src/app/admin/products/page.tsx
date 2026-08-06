"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminSectionDenied,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import {
  adjustAdminProductStock,
  canAccessAdminSection,
  fetchAdminProducts,
  type AdminProduct,
} from "@/lib/admin-api";
import { formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";

export default function AdminProductsPage() {
  const { session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "products");
  const canAdjust = session?.role === "system_admin" || session?.role === "inventory_manager";
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminProducts>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [adjustingProduct, setAdjustingProduct] = useState<AdminProduct | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminProducts(session, { page, q: query || undefined, low_stock: lowStock || undefined, active: active === "all" ? undefined : active === "active" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [active, allowed, lowStock, page, query, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(qDraft.trim());
  }

  if (!allowed) return <AdminSectionDenied section="catalog and stock" />;

  return <>
    <AdminPageHeader
      description="Inspect the local catalog and its current warehouse quantities. Stock corrections require an explicit reason and are processed by the inventory service."
      eyebrow="Inventory control"
      title="Catalog & stock"
    />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]" onSubmit={submitSearch}>
      <input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search product name, SKU, or brand" value={qDraft} />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 text-sm font-bold text-slate-300"><input checked={lowStock} className="accent-cyan-300" onChange={(event) => { setPage(1); setLowStock(event.target.checked); }} type="checkbox" />Low stock</label>
      <select className="form-input min-w-32" onChange={(event) => { setPage(1); setActive(event.target.value as typeof active); }} value={active}><option value="all">All catalog</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <button className="button-primary px-4 py-2 text-sm" type="submit">Search</button>
    </form>
    <div className="mt-5">{isLoading ? <AdminLoading label="Loading catalog inventory…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.products.length ? <><ProductTable canAdjust={canAdjust} onAdjust={setAdjustingProduct} products={data.products} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="No catalog records match the active filters." />}</div>
    {adjustingProduct ? <StockAdjustmentDialog onClose={() => setAdjustingProduct(null)} onComplete={() => void load()} product={adjustingProduct} /> : null}
  </>;
}

function ProductTable({
  canAdjust,
  onAdjust,
  products,
}: {
  canAdjust: boolean;
  onAdjust: (product: AdminProduct) => void;
  products: AdminProduct[];
}) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[58rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">Price</th><th className="px-4 py-3 font-bold">Availability</th><th className="px-4 py-3 font-bold">Catalog</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead><tbody className="divide-y divide-slate-800/80">{products.map((product) => <tr className="hover:bg-slate-900/35" key={product.id}><td className="px-5 py-4"><p className="font-bold text-slate-100">{product.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p>{product.brand ? <p className="mt-1 text-xs text-slate-500">{product.brand}</p> : null}</td><td className="px-4 py-4 font-black text-white">{formatEgp(product.list_price)}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className={`grid h-9 min-w-9 place-items-center rounded-lg border text-sm font-black ${product.stock_health === "healthy" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : product.stock_health === "dropship" ? "border-sky-400/20 bg-sky-400/10 text-sky-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>{product.stock_qty}</span><StatusPill value={product.stock_health} /></div></td><td className="px-4 py-4"><StatusPill value={product.is_active ? "active" : "inactive"} /><p className="mt-2 text-xs text-slate-500">{humanize(product.tracking)}{product.category_name ? ` · ${product.category_name}` : ""}</p><p className="mt-1 text-[11px] text-slate-600">Updated {formatAdminDateTime(product.updated_at)}</p></td><td className="px-5 py-4 text-right">{canAdjust ? <button className="button-secondary px-3 py-2 text-xs" onClick={() => onAdjust(product)} type="button">Adjust stock</button> : <span className="text-xs text-slate-600">View only</span>}</td></tr>)}</tbody></table></div></div>;
}

function StockAdjustmentDialog({
  onClose,
  onComplete,
  product,
}: {
  onClose: () => void;
  onComplete: () => void;
  product: AdminProduct;
}) {
  const { notify, session } = useStore();
  const [quantityDelta, setQuantityDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!quantityDelta) {
      setError("Enter a non-zero quantity delta.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await adjustAdminProductStock(product.id, { quantity_delta: quantityDelta, reason }, session);
      notify(`${result.sku} stock changed from ${result.previous_stock_qty} to ${result.stock_qty}.`);
      onComplete();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply the stock adjustment.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"><section aria-modal="true" className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#091423] p-6 shadow-2xl" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Controlled inventory change</p><h2 className="mt-2 text-xl font-black text-white">{product.name}</h2><p className="mt-1 font-mono text-xs text-slate-500">{product.sku} · {product.stock_qty} currently recorded</p></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div><form className="mt-6 grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-bold text-slate-200"><span>Quantity delta</span><input className="form-input" max="1000000" min="-1000000" onChange={(event) => setQuantityDelta(Number(event.target.value))} required step="1" type="number" value={quantityDelta || ""} /><span className="text-xs font-normal text-slate-500">Use a positive number to receive stock, or a negative number to remove it.</span></label><label className="grid gap-2 text-sm font-bold text-slate-200"><span>Reason</span><textarea className="form-input min-h-24 resize-y" minLength={3} onChange={(event) => setReason(event.target.value)} placeholder="Example: verified warehouse receipt" required value={reason} /></label>{error ? <p className="rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</p> : null}<div className="mt-1 flex justify-end gap-3"><button className="button-secondary text-sm" disabled={isSaving} onClick={onClose} type="button">Cancel</button><button className="button-primary text-sm disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Record adjustment"}</button></div></form></section></div>;
}
