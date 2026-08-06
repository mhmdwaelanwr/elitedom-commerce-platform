"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CatalogProductEditor } from "@/components/admin/CatalogProductEditor";
import { CatalogProductOperations } from "@/components/admin/CatalogProductOperations";
import { AdminPageHeader, AdminSectionDenied, StatusPill } from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import { canAccessAdminSection } from "@/lib/admin-api";
import { formatEgp } from "@/lib/admin-ui";
import {
  adjustCatalogStock,
  archiveCatalogProduct,
  createCatalogProduct,
  deleteCatalogImage,
  getCatalogProduct,
  listCatalogCategories,
  listCatalogProducts,
  updateCatalogProduct,
  uploadCatalogImage,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogProductListItem,
} from "@/lib/catalog-admin-api";
import {
  blankProductForm,
  flattenCatalogCategories,
  productInput,
  productToForm,
  type ProductForm,
} from "@/lib/catalog-admin-form";

export function CatalogAdminWorkspace() {
  const { notify, session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "products");
  const canManage = session?.role === "system_admin" || session?.role === "inventory_manager";
  const canArchive = session?.role === "system_admin";
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProductForm);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrimary, setImagePrimary] = useState(false);
  const [stockDelta, setStockDelta] = useState("");
  const [stockReason, setStockReason] = useState("");

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const [productResult, categoryResult] = await Promise.all([
        listCatalogProducts(session, { q: query.trim() || undefined }),
        listCatalogCategories(session),
      ]);
      setProducts(productResult.products);
      setCategories(categoryResult);
    } catch (reason) {
      setError(messageOf(reason, "Unable to load catalogue."));
    } finally {
      setLoading(false);
    }
  }, [allowed, query, session]);

  useEffect(() => { void load(); }, [load]);
  const categoryOptions = useMemo(() => flattenCatalogCategories(categories), [categories]);

  async function openProduct(productId: number) {
    if (!session) return;
    try {
      const product = await getCatalogProduct(productId, session);
      setSelected(product);
      setForm(productToForm(product));
      setError(null);
      setImageFile(null);
    } catch (reason) {
      setError(messageOf(reason, "Unable to load product."));
    }
  }

  function startDraft() {
    setSelected(null);
    setForm(blankProductForm);
    setError(null);
    setImageFile(null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const input = productInput(form);
      const saved = selected
        ? await updateCatalogProduct(selected.id, input, session)
        : await createCatalogProduct({ ...input, sku: form.sku, is_active: false }, session);
      setSelected(saved);
      setForm(productToForm(saved));
      notify(selected ? `${saved.sku} updated.` : `${saved.sku} created as a draft.`);
      await load();
    } catch (reason) {
      setError(messageOf(reason, "Unable to save product."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected || !imageFile || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      await uploadCatalogImage(selected.id, imageFile, { altText: selected.name, isPrimary: imagePrimary }, session);
      setSelected(await getCatalogProduct(selected.id, session));
      setImageFile(null);
      setImagePrimary(false);
      notify("Product image uploaded.");
    } catch (reason) {
      setError(messageOf(reason, "Unable to upload image."));
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(imageId: number) {
    if (!session || !selected || !canManage) return;
    try {
      await deleteCatalogImage(selected.id, imageId, session);
      setSelected(await getCatalogProduct(selected.id, session));
      notify("Product image removed.");
    } catch (reason) {
      setError(messageOf(reason, "Unable to remove image."));
    }
  }

  async function correctStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected || !canManage) return;
    const quantityDelta = Number(stockDelta);
    if (!quantityDelta || stockReason.trim().length < 3) {
      setError("Enter a non-zero quantity delta and a clear reason.");
      return;
    }
    setSaving(true);
    try {
      await adjustCatalogStock(selected.id, { quantityDelta, reason: stockReason.trim() }, session);
      const refreshed = await getCatalogProduct(selected.id, session);
      setSelected(refreshed);
      setForm(productToForm(refreshed));
      setStockDelta("");
      setStockReason("");
      notify(`${refreshed.sku} stock is now ${refreshed.stock_qty}.`);
      await load();
    } catch (reason) {
      setError(messageOf(reason, "Unable to adjust stock."));
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct() {
    if (!session || !selected || !canArchive) return;
    setSaving(true);
    try {
      await archiveCatalogProduct(selected.id, session);
      notify(`${selected.sku} archived.`);
      startDraft();
      await load();
    } catch (reason) {
      setError(messageOf(reason, "Unable to archive product."));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <AdminSectionDenied section="catalogue and stock" />;

  return <>
    <AdminPageHeader eyebrow="Catalogue operations" title="Products, publishing & media" description="Odoo owns synchronized master data. Staff can manage drafts, publishing, images, and reasoned stock corrections here." />
    {error ? <p className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-950/30 p-4 text-sm text-rose-100">{error}</p> : null}
    <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex gap-2"><input className="form-input min-w-0" onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, brand, product" value={query} /><button className="button-secondary px-3" onClick={() => void load()} type="button">Search</button></div>
        {canManage ? <button className="button-primary mt-3 w-full" onClick={startDraft} type="button">+ New product draft</button> : null}
        <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {loading ? <p className="p-4 text-sm text-slate-500">Loading catalogue…</p> : products.map((product) => <button className={`w-full rounded-2xl border p-4 text-left ${selected?.id === product.id ? "border-sky-400 bg-sky-400/10" : "border-slate-800 bg-slate-900/45 hover:border-slate-600"}`} key={product.id} onClick={() => void openProduct(product.id)} type="button"><div className="flex items-start justify-between gap-3"><span className="font-bold text-white">{product.name}</span><StatusPill value={product.is_active ? "active" : "draft"} /></div><p className="mt-1 font-mono text-xs text-slate-500">{product.sku}</p><div className="mt-3 flex justify-between text-xs"><span className="text-slate-400">{product.stock_qty} units</span><strong className="text-slate-200">{formatEgp(product.list_price)}</strong></div></button>)}
        </div>
      </aside>
      <main className="space-y-6">
        <CatalogProductEditor selected={selected} form={form} setForm={setForm} categories={categoryOptions} canManage={canManage} saving={saving} onSubmit={saveProduct} />
        {selected ? <CatalogProductOperations product={selected} canManage={canManage} canArchive={canArchive} saving={saving} imageFile={imageFile} imagePrimary={imagePrimary} stockDelta={stockDelta} stockReason={stockReason} onImageFile={setImageFile} onImagePrimary={setImagePrimary} onUpload={uploadImage} onRemoveImage={(id) => void removeImage(id)} onStockDelta={setStockDelta} onStockReason={setStockReason} onStockSubmit={correctStock} onArchive={() => void archiveProduct()} /> : null}
      </main>
    </div>
  </>;
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
