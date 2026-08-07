"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import {
  listCatalogProducts,
  type CatalogProductListItem,
} from "@/lib/catalog-admin-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type WorkspaceTab = "content" | "categories" | "attributes";

const emptyCategory: ContentCategoryInput = {
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

const emptyAttribute: AttributeDefinitionInput = {
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
  const [productId, setProductId] = useState<number | null>(null);
  const [content, setContent] = useState<CatalogContent | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<ContentCategoryInput>(emptyCategory);
  const [attributeId, setAttributeId] = useState<number | null>(null);
  const [attributeForm, setAttributeForm] = useState<AttributeDefinitionInput>(emptyAttribute);
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
      const [productResult, nextCategories, nextAttributes] = await Promise.all([
        listCatalogProducts(session),
        listContentCategories(session),
        listAttributeDefinitions(session),
      ]);
      setProducts(productResult.products);
      setCategories(nextCategories);
      setAttributes(nextAttributes);
    } catch (reason) {
      setError(
        messageOf(
          reason,
          ar ? "تعذر تحميل إدارة الكتالوج." : "Unable to load catalogue administration.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [ar, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function selectProduct(nextId: number) {
    if (!session) return;
    setProductId(nextId);
    setError(null);
    try {
      setContent(await getCatalogContent(nextId, session));
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر تحميل محتوى المنتج." : "Unable to load product content."));
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !content || !canManage) return;
    if (
      content.publication_status === "published" &&
      !window.confirm(
        ar
          ? "تأكيد النشر؟ سيتحقق الخادم من التصنيف والصورة والمورد المعتمد."
          : "Publish now? The server will verify category, image, and approved sourcing.",
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

  function selectCategory(id: number | null) {
    setCategoryId(id);
    const selected = categories.find((item) => item.id === id);
    setCategoryForm(selected ? categoryInput(selected) : { ...emptyCategory });
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = categoryId
        ? await updateContentCategory(categoryId, categoryForm, session)
        : await createContentCategory(categoryForm, session);
      setCategoryId(saved.id);
      setCategoryForm(categoryInput(saved));
      notify(ar ? "تم حفظ التصنيف." : "Category saved.");
      await load();
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر حفظ التصنيف." : "Unable to save category."));
    } finally {
      setSaving(false);
    }
  }

  function selectAttribute(id: number | null) {
    setAttributeId(id);
    const selected = attributes.find((item) => item.id === id);
    setAttributeForm(selected ? attributeInput(selected) : { ...emptyAttribute });
  }

  async function saveAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = attributeId
        ? await updateAttributeDefinition(attributeId, attributeForm, session)
        : await createAttributeDefinition(attributeForm, session);
      setAttributeId(saved.id);
      setAttributeForm(attributeInput(saved));
      notify(ar ? "تم حفظ تعريف المواصفة." : "Attribute definition saved.");
      await load();
    } catch (reason) {
      setError(messageOf(reason, ar ? "تعذر حفظ المواصفة." : "Unable to save attribute."));
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return <AdminSectionDenied section={ar ? "إدارة الكتالوج" : "catalogue content"} />;
  }
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
            ? "إدارة العربي والإنجليزي وSEO والنشر والتصنيفات والمواصفات المرنة بدون تغيير هوية SKU التشغيلية."
            : "Manage bilingual copy, SEO, publishing, categories, and flexible specifications without changing operational SKU identity."
        }
      />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        <Tab active={tab === "content"} label={ar ? "محتوى المنتجات" : "Product content"} onClick={() => setTab("content")} />
        <Tab active={tab === "categories"} label={ar ? "التصنيفات" : "Categories"} onClick={() => setTab("categories")} />
        <Tab active={tab === "attributes"} label={ar ? "المواصفات" : "Attributes"} onClick={() => setTab("attributes")} />
      </div>

      {error ? <p className="mt-5 rounded-2xl border border-danger bg-danger/10 p-4 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="mt-8 text-sm font-semibold text-muted">{ar ? "جارٍ التحميل…" : "Loading…"}</p> : null}

      {!loading && canView && tab === "content" ? (
        <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Picker title={ar ? "المنتجات" : "Products"}>
            {products.map((product) => (
              <button
                className={`w-full rounded-2xl border p-4 text-start ${productId === product.id ? "border-primary bg-primary/10" : "border-border bg-elevated hover:border-primary"}`}
                key={product.id}
                onClick={() => void selectProduct(product.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm text-foreground">{product.name}</strong>
                  <StatusPill value={product.is_active ? "published" : "draft"} />
                </div>
                <p className="mt-1 font-mono text-xs text-muted">{product.sku}</p>
              </button>
            ))}
          </Picker>
          {content ? (
            <ProductContentForm
              ar={ar}
              canManage={canManage}
              content={content}
              onChange={setContent}
              onSubmit={saveProduct}
              saving={saving}
            />
          ) : (
            <Empty text={ar ? "اختر منتجًا لتحرير المحتوى." : "Select a product to edit its content."} />
          )}
        </div>
      ) : null}

      {!loading && canView && tab === "categories" ? (
        <div className="mt-7 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Picker title={ar ? "التصنيفات" : "Categories"}>
            {canManage ? <button className="button-primary w-full" onClick={() => selectCategory(null)} type="button">{ar ? "+ تصنيف جديد" : "+ New category"}</button> : null}
            {categories.map((category) => (
              <button
                className={`w-full rounded-2xl border p-4 text-start ${categoryId === category.id ? "border-primary bg-primary/10" : "border-border bg-elevated"}`}
                key={category.id}
                onClick={() => selectCategory(category.id)}
                type="button"
              >
                <strong className="text-sm text-foreground">{ar ? category.name_ar || category.name : category.name}</strong>
                <p className="mt-1 font-mono text-xs text-muted">/{category.slug}</p>
              </button>
            ))}
          </Picker>
          <CategoryEditor
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
          <Picker title={ar ? "المواصفات" : "Attributes"}>
            {canManage ? <button className="button-primary w-full" onClick={() => selectAttribute(null)} type="button">{ar ? "+ مواصفة جديدة" : "+ New attribute"}</button> : null}
            {attributes.map((attribute) => (
              <button
                className={`w-full rounded-2xl border p-4 text-start ${attributeId === attribute.id ? "border-primary bg-primary/10" : "border-border bg-elevated"}`}
                key={attribute.id}
                onClick={() => selectAttribute(attribute.id)}
                type="button"
              >
                <strong className="text-sm text-foreground">{ar ? attribute.name_ar || attribute.name : attribute.name}</strong>
                <p className="mt-1 font-mono text-xs text-muted">{attribute.code} · {attribute.data_type}</p>
              </button>
            ))}
          </Picker>
          <AttributeEditor
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

function ProductContentForm(props: {
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
        <div><h2 className="text-xl font-black text-foreground">{props.content.name}</h2><p className="mt-1 font-mono text-xs text-muted">/{props.content.slug}</p></div>
        <StatusPill value={props.content.publication_status} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Input label="Slug" value={props.content.slug} onChange={(value) => set("slug", value)} />
        <Input label={props.ar ? "الاسم العربي" : "Arabic name"} value={props.content.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <Area label="Summary EN" value={props.content.short_description ?? ""} onChange={(value) => set("short_description", value)} />
        <Area label="Summary AR" value={props.content.short_description_ar ?? ""} onChange={(value) => set("short_description_ar", value)} />
        <Area label="Description EN" rows={6} value={props.content.description ?? ""} onChange={(value) => set("description", value)} />
        <Area label="Description AR" rows={6} value={props.content.description_ar ?? ""} onChange={(value) => set("description_ar", value)} />
        <Input label="SEO title EN" value={props.content.seo_title ?? ""} onChange={(value) => set("seo_title", value)} />
        <Input label="SEO title AR" value={props.content.seo_title_ar ?? ""} onChange={(value) => set("seo_title_ar", value)} />
        <Area label="SEO description EN" value={props.content.seo_description ?? ""} onChange={(value) => set("seo_description", value)} />
        <Area label="SEO description AR" value={props.content.seo_description_ar ?? ""} onChange={(value) => set("seo_description_ar", value)} />
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-border pt-5">
        <label className="text-sm font-bold text-foreground">{props.ar ? "حالة النشر" : "Publication"}<select className="form-input mt-1" onChange={(event) => set("publication_status", event.target.value)} value={props.content.publication_status}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <Check checked={props.content.is_featured} label={props.ar ? "منتج مميز" : "Featured product"} onChange={(value) => set("is_featured", value)} />
        {props.canManage ? <button className="button-primary ms-auto" disabled={props.saving} type="submit">{props.saving ? (props.ar ? "جارٍ الحفظ…" : "Saving…") : (props.ar ? "حفظ المحتوى" : "Save content")}</button> : null}
      </div>
    </form>
  );
}

function CategoryEditor(props: {
  ar: boolean;
  canManage: boolean;
  categories: ContentCategory[];
  form: ContentCategoryInput;
  onChange: (value: ContentCategoryInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const set = <K extends keyof ContentCategoryInput>(field: K, value: ContentCategoryInput[K]) => props.onChange({ ...props.form, [field]: value });
  return (
    <form className="rounded-3xl border border-border bg-surface p-5 sm:p-6" onSubmit={props.onSubmit}>
      <h2 className="text-xl font-black text-foreground">{props.ar ? "تحرير التصنيف" : "Category editor"}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Input label="Name EN" required value={props.form.name} onChange={(value) => set("name", value)} />
        <Input label="Name AR" value={props.form.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <Input label="Slug" required value={props.form.slug} onChange={(value) => set("slug", value)} />
        <label className="text-sm font-bold text-foreground">{props.ar ? "التصنيف الأب" : "Parent"}<select className="form-input mt-1" onChange={(event) => set("parent_id", event.target.value ? Number(event.target.value) : null)} value={props.form.parent_id ?? ""}><option value="">—</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <Area label="Description EN" value={props.form.description ?? ""} onChange={(value) => set("description", value)} />
        <Area label="Description AR" value={props.form.description_ar ?? ""} onChange={(value) => set("description_ar", value)} />
        <Input label="SEO title EN" value={props.form.seo_title ?? ""} onChange={(value) => set("seo_title", value)} />
        <Input label="SEO title AR" value={props.form.seo_title_ar ?? ""} onChange={(value) => set("seo_title_ar", value)} />
        <Input label={props.ar ? "رابط الصورة" : "Image URL"} value={props.form.image_url ?? ""} onChange={(value) => set("image_url", value)} />
        <Input label={props.ar ? "الترتيب" : "Sort order"} type="number" value={String(props.form.sort_order)} onChange={(value) => set("sort_order", Number(value) || 0)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5"><Check checked={props.form.is_active} label={props.ar ? "نشط" : "Active"} onChange={(value) => set("is_active", value)} /><Check checked={props.form.is_featured} label={props.ar ? "مميز" : "Featured"} onChange={(value) => set("is_featured", value)} />{props.canManage ? <button className="button-primary ms-auto" disabled={props.saving} type="submit">{props.ar ? "حفظ التصنيف" : "Save category"}</button> : null}</div>
    </form>
  );
}

function AttributeEditor(props: {
  ar: boolean;
  canManage: boolean;
  form: AttributeDefinitionInput;
  onChange: (value: AttributeDefinitionInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const set = <K extends keyof AttributeDefinitionInput>(field: K, value: AttributeDefinitionInput[K]) => props.onChange({ ...props.form, [field]: value });
  return (
    <form className="rounded-3xl border border-border bg-surface p-5 sm:p-6" onSubmit={props.onSubmit}>
      <h2 className="text-xl font-black text-foreground">{props.ar ? "تعريف المواصفة" : "Attribute definition"}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Input label="Code" required value={props.form.code} onChange={(value) => set("code", value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
        <label className="text-sm font-bold text-foreground">{props.ar ? "نوع البيانات" : "Data type"}<select className="form-input mt-1" onChange={(event) => set("data_type", event.target.value as AttributeDefinitionInput["data_type"])} value={props.form.data_type}><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select></label>
        <Input label="Name EN" required value={props.form.name} onChange={(value) => set("name", value)} />
        <Input label="Name AR" value={props.form.name_ar ?? ""} onChange={(value) => set("name_ar", value)} />
        <Input label="Unit EN" value={props.form.unit ?? ""} onChange={(value) => set("unit", value)} />
        <Input label="Unit AR" value={props.form.unit_ar ?? ""} onChange={(value) => set("unit_ar", value)} />
        <Input label={props.ar ? "الترتيب" : "Sort order"} type="number" value={String(props.form.sort_order)} onChange={(value) => set("sort_order", Number(value) || 0)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-5"><Check checked={props.form.is_active} label={props.ar ? "نشط" : "Active"} onChange={(value) => set("is_active", value)} /><Check checked={props.form.is_filterable} label={props.ar ? "قابل للفلترة" : "Filterable"} onChange={(value) => set("is_filterable", value)} />{props.canManage ? <button className="button-primary ms-auto" disabled={props.saving} type="submit">{props.ar ? "حفظ المواصفة" : "Save attribute"}</button> : null}</div>
    </form>
  );
}

function Picker({ title, children }: { title: string; children: React.ReactNode }) {
  return <aside className="rounded-3xl border border-border bg-surface p-4"><h2 className="mb-4 font-black text-foreground">{title}</h2><div className="max-h-[65vh] space-y-2 overflow-y-auto pe-1">{children}</div></aside>;
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={`focus-ring rounded-xl border px-4 py-2 text-sm font-black ${active ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted"}`} onClick={onClick} role="tab" type="button">{label}</button>;
}

function Input(props: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: "text" | "number" }) {
  return <label className="text-sm font-bold text-foreground">{props.label}<input className="form-input mt-1" onChange={(event) => props.onChange(event.target.value)} required={props.required} type={props.type ?? "text"} value={props.value} /></label>;
}

function Area(props: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="text-sm font-bold text-foreground">{props.label}<textarea className="form-input mt-1 min-h-24" onChange={(event) => props.onChange(event.target.value)} rows={props.rows ?? 3} value={props.value} /></label>;
}

function Check(props: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm font-bold text-foreground"><input checked={props.checked} className="accent-primary" onChange={(event) => props.onChange(event.target.checked)} type="checkbox" />{props.label}</label>;
}

function Empty({ text }: { text: string }) {
  return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm font-semibold text-muted">{text}</div>;
}

function categoryInput(category: ContentCategory): ContentCategoryInput {
  return {
    name: category.name,
    name_ar: category.name_ar,
    slug: category.slug,
    parent_id: category.parent_id,
    description: category.description,
    description_ar: category.description_ar,
    seo_title: category.seo_title,
    seo_title_ar: category.seo_title_ar,
    seo_description: category.seo_description,
    seo_description_ar: category.seo_description_ar,
    image_url: category.image_url,
    is_featured: category.is_featured,
    sort_order: category.sort_order,
    is_active: category.is_active,
  };
}

function attributeInput(attribute: AttributeDefinition): AttributeDefinitionInput {
  return {
    code: attribute.code,
    name: attribute.name,
    name_ar: attribute.name_ar,
    data_type: attribute.data_type,
    unit: attribute.unit,
    unit_ar: attribute.unit_ar,
    is_filterable: attribute.is_filterable,
    is_active: attribute.is_active,
    sort_order: attribute.sort_order,
  };
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
