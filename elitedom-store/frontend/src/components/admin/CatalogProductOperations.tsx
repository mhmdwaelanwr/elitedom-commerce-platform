import type { FormEvent } from "react";
import { Check } from "@/components/admin/CatalogProductEditor";
import { resolveCatalogImage, type CatalogProduct } from "@/lib/catalog-admin-api";

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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
        <h3 className="text-lg font-black text-white">Product gallery</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {product.images.length === 0 ? <p className="col-span-full rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No images uploaded.</p> : product.images.map((image) => (
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-white" key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={image.alt_text ?? product.name} className="aspect-square h-auto w-full object-contain p-3" src={resolveCatalogImage(image.url)} />
              <div className="absolute inset-x-2 bottom-2 flex justify-between">
                <span className="rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-black text-white">{image.is_primary ? "PRIMARY" : `#${image.sort_order + 1}`}</span>
                {canManage ? <button className="rounded-full bg-rose-600 px-2 py-1 text-[10px] font-black text-white" onClick={() => onRemoveImage(image.id)} type="button">Delete</button> : null}
              </div>
            </div>
          ))}
        </div>
        {canManage ? <form className="mt-5 grid gap-3" onSubmit={onUpload}><input accept="image/jpeg,image/png,image/webp" className="form-input" onChange={(event) => onImageFile(event.target.files?.[0] ?? null)} required type="file" /><Check label="Set as primary image" checked={imagePrimary} onChange={onImagePrimary} /><button className="button-secondary" disabled={!imageFile || saving} type="submit">Upload image</button></form> : null}
      </section>
      <section className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
        <h3 className="text-lg font-black text-white">Controlled stock correction</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">Use only for a verified receipt, damage, or reconciliation. Odoo remains authoritative when synchronization is enabled.</p>
        {canManage ? <form className="mt-5 grid gap-3" onSubmit={onStockSubmit}><input className="form-input" placeholder="Quantity delta, e.g. 5 or -2" step="1" type="number" value={stockDelta} onChange={(event) => onStockDelta(event.target.value)} /><textarea className="form-input min-h-24" minLength={3} placeholder="Reason for the stock change" value={stockReason} onChange={(event) => onStockReason(event.target.value)} /><button className="button-secondary" disabled={saving} type="submit">Record adjustment</button></form> : null}
        {canArchive ? <button className="mt-8 rounded-xl border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm font-black text-rose-200" disabled={saving} onClick={onArchive} type="button">Archive product</button> : null}
      </section>
    </div>
  );
}
