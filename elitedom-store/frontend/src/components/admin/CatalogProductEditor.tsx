"use client";

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { CatalogProduct } from "@/lib/catalog-admin-api";
import { patchProductForm, type ProductForm } from "@/lib/catalog-admin-form";
import { usePreferences } from "@/providers/AppPreferencesProvider";

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
  const { locale } = usePreferences();
  const c = locale === "ar" ? AR : EN;

  return (
    <form className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="section-kicker">{selected?.sku ?? c.newDraft}</p>
          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-foreground">{selected ? c.editProduct : c.createProduct}</h2>
        </div>
        {selected ? (
          <div className="rounded-lg bg-elevated px-3 py-2 text-end">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{c.currentStock}</p>
            <p className="mt-0.5 text-xl font-black text-foreground">{selected.stock_qty}</p>
          </div>
        ) : null}
      </div>

      <fieldset className="mt-5 grid gap-4 md:grid-cols-2" disabled={!canManage || saving}>
        <Field label={c.productName}><input className="form-input" minLength={2} required value={form.name} onChange={(event) => patchProductForm(setForm, "name", event.target.value)} /></Field>
        <Field label="SKU"><input className="form-input font-mono" disabled={Boolean(selected)} required value={form.sku} onChange={(event) => patchProductForm(setForm, "sku", event.target.value.toUpperCase())} /></Field>
        <Field label={c.brand}><input className="form-input" value={form.brand} onChange={(event) => patchProductForm(setForm, "brand", event.target.value)} /></Field>
        <Field label={c.category}><select className="form-input" value={form.categoryId} onChange={(event) => patchProductForm(setForm, "categoryId", event.target.value)}><option value="">{c.uncategorized}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
        <NumberField label={c.priceEgp} value={form.listPrice} onChange={(value) => patchProductForm(setForm, "listPrice", value)} />
        <NumberField label={c.baseCostUsd} value={form.baseCostUsd} onChange={(value) => patchProductForm(setForm, "baseCostUsd", value)} />
        <NumberField label={c.targetMargin} value={form.marginPercent} onChange={(value) => patchProductForm(setForm, "marginPercent", value)} />
        <Field label={c.tracking}><select className="form-input" value={form.tracking} onChange={(event) => patchProductForm(setForm, "tracking", event.target.value as ProductForm["tracking"])}><option value="serial">{c.serial}</option><option value="barcode">{c.barcode}</option></select></Field>
        <NumberField disabled={Boolean(selected)} label={c.initialStock} step="1" value={form.stockQty} onChange={(value) => patchProductForm(setForm, "stockQty", value)} />
        <NumberField label={c.warrantyMonths} step="1" value={form.warrantyMonths} onChange={(value) => patchProductForm(setForm, "warrantyMonths", value)} />
        <NumberField label={c.weightKg} value={form.weightKg} onChange={(value) => patchProductForm(setForm, "weightKg", value)} />
        <label className="grid gap-1.5 text-sm font-semibold text-foreground md:col-span-2"><span>{c.description}</span><textarea className="form-input min-h-28 resize-y" value={form.description} onChange={(event) => patchProductForm(setForm, "description", event.target.value)} /></label>
        <Check label={c.dropship} checked={form.dropship} onChange={(checked) => patchProductForm(setForm, "dropship", checked)} />
        <Check label={c.published} checked={form.active} disabled={!selected} onChange={(checked) => patchProductForm(setForm, "active", checked)} />
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="max-w-xl text-xs leading-5 text-muted">{c.helper}</p>
        <button className="button-primary" disabled={!canManage || saving} type="submit">{saving ? c.saving : selected ? c.save : c.createDraft}</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>; }
function NumberField({ label, value, onChange, disabled = false, step = "0.01" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; step?: string }) { return <Field label={label}><input className="form-input" disabled={disabled} min="0" onChange={(event) => onChange(event.target.value)} step={step} type="number" value={value} /></Field>; }

export function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-elevated/45 p-3.5 text-sm font-semibold text-foreground"><input checked={checked} className="h-4 w-4 accent-primary" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}

const EN = { newDraft:"New draft", editProduct:"Edit product", createProduct:"Create product", currentStock:"Current stock", productName:"Product name", brand:"Brand", category:"Category", uncategorized:"Uncategorized", priceEgp:"Price EGP", baseCostUsd:"Base cost USD", targetMargin:"Target margin %", tracking:"Tracking", serial:"Serial number", barcode:"Barcode / quantity", initialStock:"Initial stock", warrantyMonths:"Warranty months", weightKg:"Weight kg", description:"Description", dropship:"Dropship enabled", published:"Published in storefront", helper:"Staff products start as drafts. Publishing requires a verified supplier; Odoo-published SKUs arrive through the signed outbox.", saving:"Saving…", save:"Save changes", createDraft:"Create draft" } as const;
const AR = { newDraft:"مسودة جديدة", editProduct:"تعديل المنتج", createProduct:"إنشاء منتج", currentStock:"المخزون الحالي", productName:"اسم المنتج", brand:"العلامة التجارية", category:"التصنيف", uncategorized:"بدون تصنيف", priceEgp:"السعر بالجنيه", baseCostUsd:"التكلفة الأساسية بالدولار", targetMargin:"هامش الربح المستهدف %", tracking:"التتبع", serial:"رقم تسلسلي", barcode:"باركود / كمية", initialStock:"المخزون الأولي", warrantyMonths:"مدة الضمان بالأشهر", weightKg:"الوزن كجم", description:"الوصف", dropship:"تفعيل الدروبشيب", published:"منشور في المتجر", helper:"تبدأ المنتجات التي ينشئها الموظفون كمسودات. النشر يتطلب مورّدًا موثقًا، بينما تصل منتجات Odoo المنشورة عبر مسار المزامنة الموقع.", saving:"جارٍ الحفظ…", save:"حفظ التغييرات", createDraft:"إنشاء المسودة" } as const;
