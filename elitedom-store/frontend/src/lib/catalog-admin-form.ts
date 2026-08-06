import type { Dispatch, SetStateAction } from "react";
import type { CatalogCategory, CatalogProduct } from "@/lib/catalog-admin-api";

export const blankProductForm = {
  name: "",
  sku: "",
  description: "",
  tracking: "serial" as "serial" | "barcode",
  baseCostUsd: "0",
  marginPercent: "0",
  listPrice: "0",
  categoryId: "",
  brand: "",
  dropship: false,
  active: false,
  stockQty: "0",
  weightKg: "",
  warrantyMonths: "12",
};

export type ProductForm = typeof blankProductForm;

export function patchProductForm<Key extends keyof ProductForm>(
  setter: Dispatch<SetStateAction<ProductForm>>,
  key: Key,
  value: ProductForm[Key],
) {
  setter((current) => ({ ...current, [key]: value }));
}

export function productToForm(product: CatalogProduct): ProductForm {
  return {
    name: product.name,
    sku: product.sku,
    description: product.description ?? "",
    tracking: product.tracking,
    baseCostUsd: String(product.base_cost_usd),
    marginPercent: String(product.target_margin_percent),
    listPrice: String(product.list_price),
    categoryId: product.category_id ? String(product.category_id) : "",
    brand: product.brand ?? "",
    dropship: product.is_dropship_enabled,
    active: product.is_active,
    stockQty: String(product.stock_qty),
    weightKg: product.weight_kg == null ? "" : String(product.weight_kg),
    warrantyMonths: String(product.warranty_months),
  };
}

export function productInput(form: ProductForm) {
  return {
    name: form.name,
    description: form.description || null,
    tracking: form.tracking,
    base_cost_usd: Number(form.baseCostUsd),
    target_margin_percent: Number(form.marginPercent),
    list_price: Number(form.listPrice),
    category_id: form.categoryId ? Number(form.categoryId) : null,
    brand: form.brand || null,
    is_dropship_enabled: form.dropship,
    is_active: form.active,
    stock_qty: Number(form.stockQty),
    weight_kg: form.weightKg ? Number(form.weightKg) : null,
    warranty_months: Number(form.warrantyMonths),
  };
}

export function flattenCatalogCategories(
  categories: CatalogCategory[],
  depth = 0,
): Array<{ id: number; label: string }> {
  return categories.flatMap((category) => [
    { id: category.id, label: `${"— ".repeat(depth)}${category.name}` },
    ...flattenCatalogCategories(category.children ?? [], depth + 1),
  ]);
}
