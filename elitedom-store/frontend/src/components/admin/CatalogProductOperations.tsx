"use client";

import type { FormEvent } from "react";
import { Check } from "@/components/admin/CatalogProductEditor";
import { resolveCatalogImage, type CatalogProduct } from "@/lib/catalog-admin-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function CatalogProductOperations({
  product,
  canManage,
  canArchive,
  saving,
  imageFile,
  imagePrimary,
  stockDelta,
  stockReason,
  onImageFile,
  onImagePrimary,
  onUpload,
  onRemoveImage,
  onStockDelta,
  onStockReason,
  onStockSubmit,
  onArchive,
}: {
  product: CatalogProduct;
  canManage: boolean;
  canArchive: boolean;
  saving: boolean;
  imageFile: File | null;
  imagePrimary: boolean;
  stockDelta: string;
  stockReason: string;
  onImageFile: (file: File | null) => void;
  onImagePrimary: (checked: boolean) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveImage: (imageId: number) => void;
  onStockDelta: (value: string) => void;
  onStockReason: (value: string) => void;
  onStockSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
}) {
  const { locale } = usePreferences();
  const c = locale === "ar" ? AR : EN;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="border-b border-border pb-4">
          <h3 className="text-lg font-black tracking-tight text-foreground">{c.gallery}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{c.galleryHelp}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {product.images.length === 0 ? (
            <p className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{c.noImages}</p>
          ) : product.images.map((image) => (
            <div className="relative overflow-hidden rounded-lg border border-border bg-surface" key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={image.alt_text ?? product.name} className="aspect-square h-auto w-full object-contain p-3" src={resolveCatalogImage(image.url)} />
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-2">
                <span className="rounded-md bg-foreground/85 px-2 py-1 text-[9px] font-black text-background">{image.is_primary ? c.primary : `#${image.sort_order + 1}`}</span>
                {canManage ? <button className="rounded-md bg-danger px-2 py-1 text-[9px] font-black text-primary-contrast" onClick={() => onRemoveImage(image.id)} type="button">{c.delete}</button> : null}
              </div>
            </div>
          ))}
        </div>
        {canManage ? (
          <form className="mt-5 grid gap-3 border-t border-border pt-4" onSubmit={onUpload}>
            <input accept="image/jpeg,image/png,image/webp" className="form-input" onChange={(event) => onImageFile(event.target.files?.[0] ?? null)} required type="file" />
            <Check label={c.setPrimary} checked={imagePrimary} onChange={onImagePrimary} />
            <button className="button-secondary" disabled={!imageFile || saving} type="submit">{c.upload}</button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="border-b border-border pb-4">
          <h3 className="text-lg font-black tracking-tight text-foreground">{c.stockCorrection}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{c.stockHelp}</p>
        </div>
        {canManage ? (
          <form className="mt-5 grid gap-3" onSubmit={onStockSubmit}>
            <input className="form-input" placeholder={c.deltaPlaceholder} step="1" type="number" value={stockDelta} onChange={(event) => onStockDelta(event.target.value)} />
            <textarea className="form-input min-h-24 resize-y" minLength={3} placeholder={c.reasonPlaceholder} value={stockReason} onChange={(event) => onStockReason(event.target.value)} />
            <button className="button-secondary" disabled={saving} type="submit">{c.record}</button>
          </form>
        ) : (
          <p className="mt-5 rounded-lg bg-elevated p-4 text-sm text-muted">{c.readOnly}</p>
        )}
        {canArchive ? (
          <div className="mt-7 border-t border-border pt-5">
            <p className="text-xs font-bold text-danger">{c.dangerZone}</p>
            <button className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm font-black text-danger transition hover:bg-danger/10" disabled={saving} onClick={onArchive} type="button">{c.archive}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

const EN = { gallery:"Product gallery", galleryHelp:"Manage storefront media without exposing storage credentials.", noImages:"No images uploaded.", primary:"PRIMARY", delete:"Delete", setPrimary:"Set as primary image", upload:"Upload image", stockCorrection:"Controlled stock correction", stockHelp:"Use only for a verified receipt, damage, or reconciliation. Odoo remains authoritative when synchronization is enabled.", deltaPlaceholder:"Quantity delta, e.g. 5 or -2", reasonPlaceholder:"Reason for the stock change", record:"Record adjustment", readOnly:"This role can review stock but cannot record corrections.", dangerZone:"Danger zone", archive:"Archive product" } as const;
const AR = { gallery:"معرض المنتج", galleryHelp:"إدارة صور المتجر دون إظهار بيانات اعتماد التخزين.", noImages:"لا توجد صور مرفوعة.", primary:"أساسية", delete:"حذف", setPrimary:"تعيين كصورة أساسية", upload:"رفع الصورة", stockCorrection:"تصحيح مخزون منضبط", stockHelp:"استخدمه فقط للاستلام الموثق أو التلف أو التسوية. يظل Odoo هو المصدر الأساسي عند تفعيل المزامنة.", deltaPlaceholder:"فرق الكمية، مثل 5 أو -2", reasonPlaceholder:"سبب تغيير المخزون", record:"تسجيل التعديل", readOnly:"يمكن لهذا الدور مراجعة المخزون لكنه لا يستطيع تسجيل التصحيحات.", dangerZone:"منطقة الإجراءات الحساسة", archive:"أرشفة المنتج" } as const;
