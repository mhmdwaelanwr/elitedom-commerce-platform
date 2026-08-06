import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { CatalogProduct } from "@/lib/catalog-admin-api";
import {
  patchProductForm,
  type ProductForm,
} from "@/lib/catalog-admin-form";

export function CatalogProductEditor({
  selected,
  form,
  setForm,
  categories,
  canManage,
  saving,
  onSubmit,
}: {
  selected: CatalogProduct | null;
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  categories: Array<{ id: number; label: string }>;
  canManage: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-3xl border border-slate-800 bg-slate-950/40 p-6" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">{selected?.sku ?? "New draft"}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{selected ? "Edit product" : "Create product"}</h2>
        </div>
        {selected ? <p className="text-sm text-slate-400">Current stock <strong className="ml-2 text-xl text-white">{selected.stock_qty}</strong></p> : null}
      </div>
      <fieldset className="mt-6 grid gap-4 md:grid-cols-2" disabled={!canManage || saving}>
        <Field label="Product name"><input className="form-input" minLength={2} required value={form.name} onChange={(event) => patchProductForm(setForm, "name", event.target.value)} /></Field>
        <Field label="SKU"><input className="form-input font-mono" disabled={Boolean(selected)} required value={form.sku} onChange={(event) => patchProductForm(setForm, "sku", event.target.value.toUpperCase())} /></Field>
        <Field label="Brand"><input className="form-input" value={form.brand} onChange={(event) => patchProductForm(setForm, "brand", event.target.value)} /></Field>
        <Field label="Category"><select className="form-input" value={form.categoryId} onChange={(event) => patchProductForm(setForm, "categoryId", event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
        <NumberField label="Price EGP" value={form.listPrice} onChange={(value) => patchProductForm(setForm, "listPrice", value)} />
        <NumberField label="Base cost USD" value={form.baseCostUsd} onChange={(value) => patchProductForm(setForm, "baseCostUsd", value)} />
        <NumberField label="Target margin %" value={form.marginPercent} onChange={(value) => patchProductForm(setForm, "marginPercent", value)} />
        <Field label="Tracking"><select className="form-input" value={form.tracking} onChange={(event) => patchProductForm(setForm, "tracking", event.target.value as ProductForm["tracking"])}><option value="serial">Serial number</option><option value="barcode">Barcode / quantity</option></select></Field>
        <NumberField disabled={Boolean(selected)} label="Initial stock" step="1" value={form.stockQty} onChange={(value) => patchProductForm(setForm, "stockQty", value)} />
        <NumberField label="Warranty months" step="1" value={form.warrantyMonths} onChange={(value) => patchProductForm(setForm, "warrantyMonths", value)} />
        <NumberField label="Weight kg" value={form.weightKg} onChange={(value) => patchProductForm(setForm, "weightKg", value)} />
        <label className="md:col-span-2 grid gap-2 text-sm font-bold text-slate-200"><span>Description</span><textarea className="form-input min-h-28" value={form.description} onChange={(event) => patchProductForm(setForm, "description", event.target.value)} /></label>
        <Check label="Dropship enabled" checked={form.dropship} onChange={(checked) => patchProductForm(setForm, "dropship", checked)} />
        <Check label="Published in storefront" checked={form.active} disabled={!selected} onChange={(checked) => patchProductForm(setForm, "active", checked)} />
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-slate-500">Staff products start as drafts. Publishing requires a verified supplier; Odoo-published SKUs arrive through the signed outbox.</p>
        <button className="button-primary" disabled={!canManage || saving} type="submit">{saving ? "Saving…" : selected ? "Save changes" : "Create draft"}</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-200"><span>{label}</span>{children}</label>;
}

function NumberField({ label, value, onChange, disabled = false, step = "0.01" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; step?: string }) {
  return <Field label={label}><input className="form-input" disabled={disabled} min="0" onChange={(event) => onChange(event.target.value)} step={step} type="number" value={value} /></Field>;
}

export function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm font-bold text-slate-200"><input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}
