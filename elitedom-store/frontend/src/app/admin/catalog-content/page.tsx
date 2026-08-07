"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AdminPageHeader,
  AdminSectionDenied,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import { fetchAdminAccess } from "@/lib/admin-api";
import {
  createAttributeDefinition,
  createContentCategory,
  getCatalogContent,
  listAttributeDefinitions,
  listContentCategories,
  updateAttributeDefinition,
  updateCatalogContent,
  updateContentCategory,
  type AttributeDefinition,
  type AttributeDefinitionInput,
  type CatalogContent,
  type ContentCategory,
  type ContentCategoryInput,
} from "@/lib/catalog-content-admin-api";
import { listCatalogProducts, type CatalogProductListItem } from "@/lib/catalog-admin-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type WorkspaceTab = "content" | "categories" | "attributes";

const blankCategory: ContentCategoryInput = {
  name: "",
  name_ar: "",
  slug: "",
  parent_id: null,
  description: "",
  description_ar: "",
  seo_title: "",
  seo_title_ar: "",
  seo_description: "",
  seo_description_ar: "",
  image_url: "",
  is_featured: false,
  sort_order: 0,
  is_active: true,
};

const blankAttribute: AttributeDefinitionInput = {
  code: "",
  name: "",
  name_ar: "",
  data_type: "text",
  unit: "",
  unit_ar: "",
  is_filterable: true,
  is_active: true,
  sort_order: 0,
};

export default function CatalogContentAdminPage() {
  const { locale } = usePreferences();
  const { notify, session } = useStore();
  const ar = locale === "ar";
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [content, setContent] = useState<CatalogContent | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<ContentCategoryInput>(blankCategory);
  const [selectedAttributeId, setSelectedAttributeId] = useState<number | null>(null);
  const [attributeForm, setAttributeForm] = useState<AttributeDefinitionInput>(blankAttribute);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canView = permissions.includes("catalog.view");
  const canManage = permissions.includes("catalog.manage");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const access = await fetchAdminAccess(session);
      setPermissions(access.permissions);
      if (!access.permissions.includes("catalog.view")) return;
      const [productResult, categoryResult, attributeResult] = await Promise.all([
        listCatalogProducts(session, { q: query.trim() || undefined }),
        listContentCategories(session),
        listAttributeDefinitions(session),
      ]);
      setProducts(productResult.products);
      setCategories(categoryResult);
      setAttributes(attributeResult);
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر تحميل إدارة الكتالوج." : "Unable to load catalogue administration."));
    } finally {
      setLoading(false);
    }
  }, [ar, query, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openProduct(productId: number) {
    if (!session) return;
    setError(null);
    try {
      const next = await getCatalogContent(productId, session);
      setSelectedProductId(productId);
      setContent(next);
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر تحميل محتوى المنتج." : "Unable to load product content."));
    }
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !content || !canManage) return;
    if (
      content.publication_status === "published" &&
      !window.confirm(
        ar
          ? "نشر هذا المنتج الآن؟ سيتحقق الخادم من التصنيف والصورة والمورد المعتمد قبل النشر."
          : "Publish this product now? The server will require a category, image, and verified supplier before publishing.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateCatalogContent(content.product_id, content, session);
      setContent(saved);
      notify(ar ? "تم حفظ محتوى المنتج." : "Product content saved.");
      await load();
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر حفظ المحتوى." : "Unable to save content."));
    } finally {
      setSaving(false);
    }
  }

  function editCategory(category?: ContentCategory) {
    if (!category) {
      setSelectedCategoryId(null);
      setCategoryForm(blankCategory);
      return;
    }
    setSelectedCategoryId(category.id);
    setCategoryForm(toCategoryInput(category));
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = selectedCategoryId
        ? await updateContentCategory(selectedCategoryId, categoryForm, session)
        : await createContentCategory(categoryForm, session);
      setSelectedCategoryId(saved.id);
      setCategoryForm(toCategoryInput(saved));
      notify(ar ? "تم حفظ التصنيف." : "Category saved.");
      await load();
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر حفظ التصنيف." : "Unable to save category."));
    } finally {
      setSaving(false);
    }
  }

  function editAttribute(attribute?: AttributeDefinition) {
    if (!attribute) {
      setSelectedAttributeId(null);
      setAttributeForm(blankAttribute);
      return;
    }
    setSelectedAttributeId(attribute.id);
    setAttributeForm(toAttributeInput(attribute));
  }

  async function saveAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = selectedAttributeId
        ? await updateAttributeDefinition(selectedAttributeId, attributeForm, session)
        : await createAttributeDefinition(attributeForm, session);
      setSelectedAttributeId(saved.id);
      setAttributeForm(toAttributeInput(saved));
      notify(ar ? "تم حفظ تعريف المواصفة." : "Attribute definition saved.");
      await load();
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر حفظ المواصفة." : "Unable to save attribute."));
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  if (!session) return <AdminSectionDenied section={ar ? "إدارة الكتالوج" : "catalogue content"} />;
  if (!loading && !canView) {
    return <AdminSectionDenied section={ar ? "إدارة الكتالوج" : "catalogue content"} />;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={ar ? "المحتوى والتسويق" : "Content & merchandising"}
        title={ar ? "محتوى الكتالوج والنشر" : "Catalogue content & publishing"}
        description={
          ar
            ? "إدارة المحتوى العربي والإنجليزي، SEO، حالة النشر، التصنيفات، وتعريفات المواصفات بدون تغيير هوية SKU المستخدمة في المخزون والطلبات."
            : "Manage Arabic and English copy, SEO, publication state, categories, and flexible specifications without changing the SKU identity used by inventory and orders."
        }
      />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          {ar ? "محتوى المنتجات" : "Product content"}
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          {ar ? "التصنيفات" : "Categories"}
        </TabButton>
        <TabButton active={tab === "attributes"} onClick={() => setTab("attributes")}>
          {ar ? "المواصفات" : "Attributes"}
        </TabButton>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-danger bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-8 text-sm font-semibold text-muted">
          {ar ? "جارٍ تحميل الكتالوج…" : "Loading catalogue…"}
        </p>
      ) : null}

      {!loading && canView && tab === "content" ? (
        <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border bg-surface p-4">
            <div className="flex gap-2">
              <input
                className="form-input min-w-0"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={ar ? "ابحث باسم أو SKU" : "Search product or SKU"}
                value={query}
              />
              <button className="button-secondary px-3" onClick={() => void load()} type="button">
                {ar ? "بحث" : "Search"}
              </button>
            </div>
            <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pe-1">
              {products.map((product) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-start ${selectedProductId === product.id ? "border-primary bg-primary/10" : "border-border bg-elevated hover:border-primary"}`}
                  key={product.id}
                  onClick={() => void openProduct(product.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm text-foreground">{product.name}</strong>
                    <StatusPill value={product.is_active ? "published" : "draft"} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">{product.sku}</p>
                </button>
              ))}
            </div>
          </aside>
          <main>
            {content && selectedProduct ? (
              <ContentForm
                ar={ar}
                canManage={canManage}
                content={content}
                onChange={setContent}
                onSubmit={saveContent}
                saving={saving}
              />
            ) : (
              <EmptyPanel text={ar ? "اختر منتجًا لتحرير المحتوى." : "Select a product to edit its content."} />
            )}
          </main>
        </div>
      ) : null}

      {!loading && canView && tab === "categories" ? (
        <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border bg-surface p-4">
            {canManage ? (
              <button className="button-primary w-full" onClick={() => editCategory()} type="button">
                {ar ? "+ تصنيف جديد" : "+ New category"}
              </button>
            ) : null}
            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-start ${selectedCategoryId === category.id ? "border-primary bg-primary/10" : "border-border bg-elevated"}`}
                  key={category.id}
                  onClick={() => editCategory(category)}
                  type="button"
                >
                  <strong className="text-sm text-foreground">{ar ? category.name_ar || category.name : category.name}</strong>
                  <p className="mt-1 font-mono text-xs text-muted">/{category.slug}</p>
                </button>
              ))}
            </div>
          </aside>
          <CategoryForm
            ar={ar}
            canManage={canManage}
            categories={categories}
            form={categoryForm}
            onChange={setCategoryForm}
            onSubmit={saveCategory}
            saving={saving}
          />
        </div>
      ) : null}

      {!loading && canView && tab === "attributes" ? (
        <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border bg-surface p-4">
            {canManage ? (
              <button className="button-primary w-full" onClick={() => editAttribute()} type="button">
                {ar ? "+ مواصفة جديدة" : "+ New attribute"}
              </button>
            ) : null}
            <div className="mt-4 space-y-2">
              {attributes.map((attribute) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-start ${selectedAttributeId === attribute.id ? "border-primary bg-primary/10" : "border-border bg-elevated"}`}
                  key={attribute.id}
                  onClick={() => editAttribute(attribute)}
                  type="button"
                >
                  <strong className="text-sm text-foreground">{ar ? attribute.name_ar || attribute.name : attribute.name}</strong>
                  <p className="mt-1 font-mono text-xs text-muted">{attribute.code} · {attribute.data_type}</p>
                </button>
              ))}
            </div>
          </aside>
          <AttributeForm
            ar={ar}
            canManage={canManage}
            form={attributeForm}
            onChange={setAttributeForm}
            onSubmit={saveAttribute}
            saving={saving}
          />
        </div>
      ) : null}
    </>
  );
}

function ContentForm(props: {
  ar: boolean;
  canManage: boolean;
  content: CatalogContent;
  onChange: (value: CatalogContent) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const set = (field: keyof CatalogContent, value: string | boolean) =>
    props.onChange({ ...props.content, [field]: value });
  return (
    <form className="rounded-3xl border border-border bg-surface p-5 sm:p-6" onSubmit={props.onSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground">{props.content.name}</h2>
          <p className="mt-1 font-mono text-xs text-muted">/{props.content.slug}</p>
        </div>
        <StatusPill value={props.content.publication_status} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TextInput label="Slug" value={props.content.slug} onChange={(value) => set("slug", value)} />
        <TextInput label={props.ar ? "الاسم العربي" : "Arabic name"} value={props.content.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <TextArea label={props.ar ? "ملخص إنجليزي" : "English summary"} value={props.content.short_description ?? ""} onChange={(value) => set("short_description", value)} />
        <TextArea label={props.ar ? "ملخص عربي" : "Arabic summary"} value={props.content.short_description_ar ?? ""} onChange={(value) => set("short_description_ar", value)} />
        <TextArea label={props.ar ? "وصف إنجليزي" : "English description"} value={props.content.description ?? ""} onChange={(value) => set("description", value)} rows={6} />
        <TextArea label={props.ar ? "وصف عربي" : "Arabic description"} value={props.content.description_ar ?? ""} onChange={(value) => set("description_ar", value)} rows={6} />
        <TextInput label="SEO title (EN)" value={props.content.seo_title ?? ""} onChange={(value) => set("seo_title", value)} />
        <TextInput label="SEO title (AR)" value={props.content.seo_title_ar ?? ""} onChange={(value) => set("seo_title_ar", value)} />
        <TextArea label="SEO description (EN)" value={props.content.seo_description ?? ""} onChange={(value) => set("seo_description", value)} />
        <TextArea label="SEO description (AR)" value={props.content.seo_description_ar ?? ""} onChange={(value) => set("seo_description_ar", value)} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-5">
        <label className="text-sm font-bold text-foreground">
          {props.ar ? "حالة النشر" : "Publication"}
          <select className="form-input mt-1" onChange={(event) => set("publication_status", event.target.value)} value={props.content.publication_status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-foreground">
          <input checked={props.content.is_featured} className="accent-primary" onChange={(event) => set("is_featured", event.target.checked)} type="checkbox" />
          {props.ar ? "منتج مميز" : "Featured product"}
        </label>
        {props.canManage ? (
          <button className="button-primary ms-auto" disabled={props.saving} type="submit">
            {props.saving ? (props.ar ? "جارٍ الحفظ…" : "Saving…") : (props.ar ? "حفظ المحتوى" : "Save content")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function CategoryForm(props: {
  ar: boolean;
  canManage: boolean;
  categories: ContentCategory[];
  form: ContentCategoryInput;
  onChange: (value: ContentCategoryInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const set = <K extends keyof ContentCategoryInput>(field: K, value: ContentCategoryInput[K]) =>
    props.onChange({ ...props.form, [field]: value });
  return (
    <form className="rounded-3xl border border-border bg-surface p-5 sm:p-6" onSubmit={props.onSubmit}>
      <h2 className="text-xl font-black text-foreground">{props.ar ? "تحرير التصنيف" : "Category editor"}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <TextInput label={props.ar ? "الاسم الإنجليزي" : "English name"} value={props.form.name} onChange={(value) => set("name", value)} required />
        <TextInput label={props.ar ? "الاسم العربي" : "Arabic name"} value={props.form.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <TextInput label="Slug" value={props.form.slug} onChange={(value) => set("slug", value)} required />
        <label className="text-sm font-bold text-foreground">
          {props.ar ? "التصنيف الأب" : "Parent category"}
          <select className="form-input mt-1" onChange={(event) => set("parent_id", event.target.value ? Number(event.target.value) : null)} value={props.form.parent_id ?? ""}>
            <option value="">—</option>
            {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <TextArea label={props.ar ? "الوصف الإنجليزي" : "English description"} value={props.form.description ?? ""} onChange={(value) => set("description", value)} />
        <TextArea label={props.ar ? "الوصف العربي" : "Arabic description"} value={props.form.description_ar ?? ""} onChange={(value) => set("description_ar", value)} />
        <TextInput label="SEO title (EN)" value={props.form.seo_title ?? ""} onChange={(value) => set("seo_title", value)} />
        <TextInput label="SEO title (AR)" value={props.form.seo_title_ar ?? ""} onChange={(value) => set("seo_title_ar", value)} />
        <TextInput label={props.ar ? "رابط صورة التصنيف" : "Category image URL"} value={props.form.image_url ?? ""} onChange={(value) => set("image_url", value)} />
        <TextInput label={props.ar ? "ترتيب العرض" : "Sort order"} type="number" value={String(props.form.sort_order)} onChange={(value) => set("sort_order", Number(value) || 0)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5">
        <BooleanField checked={props.form.is_active} label={props.ar ? "نشط" : "Active"} onChange={(value) => set("is_active", value)} />
        <BooleanField checked={props.form.is_featured} label={props.ar ? "مميز" : "Featured"} onChange={(value) => set("is_featured", value)} />
        {props.canManage ? <button className="button-primary ms-auto" disabled={props.saving} type="submit">{props.ar ? "حفظ التصنيف" : "Save category"}</button> : null}
      </div>
    </form>
  );
}

function AttributeForm(props: {
  ar: boolean;
  canManage: boolean;
  form: AttributeDefinitionInput;
  onChange: (value: AttributeDefinitionInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const set = <K extends keyof AttributeDefinitionInput>(field: K, value: AttributeDefinitionInput[K]) =>
    props.onChange({ ...props.form, [field]: value });
  return (
    <form className="rounded-3xl border border-border bg-surface p-5 sm:p-6" onSubmit={props.onSubmit}>
      <h2 className="text-xl font-black text-foreground">{props.ar ? "تعريف المواصفة" : "Attribute definition"}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <TextInput label="Code" value={props.form.code} onChange={(value) => set("code", value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} required />
        <label className="text-sm font-bold text-foreground">
          {props.ar ? "نوع البيانات" : "Data type"}
          <select className="form-input mt-1" onChange={(event) => set("data_type", event.target.value as AttributeDefinitionInput["data_type"])} value={props.form.data_type}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
          </select>
        </label>
        <TextInput label={props.ar ? "الاسم الإنجليزي" : "English name"} value={props.form.name} onChange={(value) => set("name", value)} required />
        <TextInput label={props.ar ? "الاسم العربي" : "Arabic name"} value={props.form.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <TextInput label={props.ar ? "الوحدة الإنجليزية" : "English unit"} value={props.form.unit ?? ""} onChange={(value) => set("unit", value)} />
        <TextInput label={props.ar ? "الوحدة العربية" : "Arabic unit"} value={props.form.unit_ar ?? ""} onChange={(value) => set("unit_ar", value)} />
        <TextInput label={props.ar ? "ترتيب العرض" : "Sort order"} type="number" value={String(props.form.sort_order)} onChange={(value) => set("sort_order", Number(value) || 0)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5">
        <BooleanField checked={props.form.is_active} label={props.ar ? "نشط" : "Active"} onChange={(value) => set("is_active", value)} />
        <BooleanField checked={props.form.is_filterable} label={props.ar ? "يظهر في الفلاتر" : "Filterable"} onChange={(value) => set("is_filterable", value)} />
        {props.canManage ? <button className="button-primary ms-auto" disabled={props.saving} type="submit">{props.ar ? "حفظ المواصفة" : "Save attribute"}</button> : null}
      </div>
    </form>
  );
}

function TextInput(props: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: "text" | "number" }) {
  return <label className="text-sm font-bold text-foreground">{props.label}<input className="form-input mt-1" onChange={(event) => props.onChange(event.target.value)} required={props.required} type={props.type ?? "text"} value={props.value} /></label>;
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="text-sm font-bold text-foreground">{props.label}<textarea className="form-input mt-1 min-h-24" onChange={(event) => props.onChange(event.target.value)} rows={props.rows ?? 3} value={props.value} /></label>;
}

function BooleanField(props: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm font-bold text-foreground"><input checked={props.checked} className="accent-primary" onChange={(event) => props.onChange(event.target.checked)} type="checkbox" />{props.label}</label>;
}

function TabButton(props: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button aria-selected={props.active} className={`focus-ring rounded-xl border px-4 py-2 text-sm font-black ${props.active ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted"}`} onClick={props.onClick} role="tab" type="button">{props.children}</button>;
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm font-semibold text-muted">{text}</div>;
}

function toCategoryInput(category: ContentCategory): ContentCategoryInput {
  const { id: _id, ...input } = category;
  return input;
}

function toAttributeInput(attribute: AttributeDefinition): AttributeDefinitionInput {
  const { id: _id, ...input } = attribute;
  return input;
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
