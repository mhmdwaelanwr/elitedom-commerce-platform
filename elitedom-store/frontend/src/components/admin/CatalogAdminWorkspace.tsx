"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function CatalogAdminWorkspace() {
  const { notify, session } = useStore();
  const { locale } = usePreferences();
  const c = locale === "ar" ? AR : EN;
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
      setError(messageOf(reason, c.loadError));
    } finally {
      setLoading(false);
    }
  }, [allowed, c.loadError, query, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
      setError(messageOf(reason, c.productLoadError));
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
      notify(selected ? `${saved.sku} ${c.updatedNotice}` : `${saved.sku} ${c.createdNotice}`);
      await load();
    } catch (reason) {
      setError(messageOf(reason, c.saveError));
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
      notify(c.imageUploaded);
    } catch (reason) {
      setError(messageOf(reason, c.imageUploadError));
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(imageId: number) {
    if (!session || !selected || !canManage) return;
    try {
      await deleteCatalogImage(selected.id, imageId, session);
      setSelected(await getCatalogProduct(selected.id, session));
      notify(c.imageRemoved);
    } catch (reason) {
      setError(messageOf(reason, c.imageRemoveError));
    }
  }

  async function correctStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected || !canManage) return;
    const quantityDelta = Number(stockDelta);
    if (!quantityDelta || stockReason.trim().length < 3) {
      setError(c.stockValidation);
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
      notify(`${refreshed.sku} · ${c.stockNow} ${refreshed.stock_qty}`);
      await load();
    } catch (reason) {
      setError(messageOf(reason, c.stockError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct() {
    if (!session || !selected || !canArchive) return;
    setSaving(true);
    try {
      await archiveCatalogProduct(selected.id, session);
      notify(`${selected.sku} ${c.archivedNotice}`);
      startDraft();
      await load();
    } catch (reason) {
      setError(messageOf(reason, c.archiveError));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <AdminSectionDenied section="catalogue and stock" />;

  return (
    <>
      <AdminPageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
      {error ? <p className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger" role="alert">{error}</p> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-sm xl:sticky xl:top-20">
          <div className="relative">
            <SearchIcon />
            <input className="form-input ps-9" onChange={(event) => setQuery(event.target.value)} placeholder={c.searchPlaceholder} value={query} />
          </div>
          <button className="button-secondary mt-2 w-full" onClick={() => void load()} type="button">{c.search}</button>
          {canManage ? <button className="button-primary mt-2 w-full" onClick={startDraft} type="button"><PlusIcon />{c.newDraft}</button> : null}

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted">{c.products}</p>
            <span className="rounded-md bg-elevated px-2 py-1 text-[10px] font-bold text-muted">{products.length}</span>
          </div>

          <div className="mt-2 max-h-[65vh] space-y-2 overflow-y-auto pe-1">
            {loading ? (
              <div className="grid gap-2 py-2">{[0, 1, 2].map((item) => <div className="h-24 animate-pulse rounded-lg bg-elevated" key={item} />)}</div>
            ) : products.map((product) => (
              <button
                className={`focus-ring w-full rounded-lg border p-3.5 text-start transition ${selected?.id === product.id ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/35 hover:bg-elevated/45"}`}
                key={product.id}
                onClick={() => void openProduct(product.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-bold leading-5 text-foreground">{product.name}</span>
                  <StatusPill value={product.is_active ? "active" : "draft"} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted">{product.sku}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">{product.stock_qty} {c.units}</span>
                  <strong className="text-foreground">{formatEgp(product.list_price)}</strong>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <CatalogProductEditor selected={selected} form={form} setForm={setForm} categories={categoryOptions} canManage={canManage} saving={saving} onSubmit={saveProduct} />
          {selected ? (
            <CatalogProductOperations
              product={selected}
              canManage={canManage}
              canArchive={canArchive}
              saving={saving}
              imageFile={imageFile}
              imagePrimary={imagePrimary}
              stockDelta={stockDelta}
              stockReason={stockReason}
              onImageFile={setImageFile}
              onImagePrimary={setImagePrimary}
              onUpload={uploadImage}
              onRemoveImage={(id) => void removeImage(id)}
              onStockDelta={setStockDelta}
              onStockReason={setStockReason}
              onStockSubmit={correctStock}
              onArchive={() => void archiveProduct()}
            />
          ) : null}
        </main>
      </div>
    </>
  );
}

function messageOf(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback; }

const EN = { eyebrow:"Catalogue operations", title:"Products, publishing & media", description:"Manage drafts, storefront publishing, product media, and controlled stock corrections while preserving Odoo synchronization boundaries.", loadError:"Unable to load catalogue.", productLoadError:"Unable to load product.", saveError:"Unable to save product.", updatedNotice:"updated.", createdNotice:"created as a draft.", imageUploaded:"Product image uploaded.", imageUploadError:"Unable to upload image.", imageRemoved:"Product image removed.", imageRemoveError:"Unable to remove image.", stockValidation:"Enter a non-zero quantity delta and a clear reason.", stockNow:"stock is now", stockError:"Unable to adjust stock.", archivedNotice:"archived.", archiveError:"Unable to archive product.", searchPlaceholder:"Search SKU, brand, product", search:"Search", newDraft:"New product draft", products:"Products", units:"units" } as const;
const AR = { eyebrow:"عمليات الكتالوج", title:"المنتجات والنشر والوسائط", description:"إدارة المسودات والنشر في المتجر ووسائط المنتجات وتصحيحات المخزون المنضبطة مع الحفاظ على حدود مزامنة Odoo.", loadError:"تعذر تحميل الكتالوج.", productLoadError:"تعذر تحميل المنتج.", saveError:"تعذر حفظ المنتج.", updatedNotice:"تم تحديثه.", createdNotice:"تم إنشاؤه كمسودة.", imageUploaded:"تم رفع صورة المنتج.", imageUploadError:"تعذر رفع الصورة.", imageRemoved:"تم حذف صورة المنتج.", imageRemoveError:"تعذر حذف الصورة.", stockValidation:"أدخل فرق كمية غير صفري وسببًا واضحًا.", stockNow:"المخزون الآن", stockError:"تعذر تعديل المخزون.", archivedNotice:"تمت أرشفته.", archiveError:"تعذر أرشفة المنتج.", searchPlaceholder:"ابحث بـ SKU أو العلامة أو المنتج", search:"بحث", newDraft:"مسودة منتج جديدة", products:"المنتجات", units:"وحدة" } as const;

function SearchIcon() { return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function PlusIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>; }
