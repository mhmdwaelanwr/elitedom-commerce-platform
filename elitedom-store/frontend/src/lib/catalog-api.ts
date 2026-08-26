import { CATALOG, CATEGORIES, findCatalogProduct } from "@/lib/catalog";
import { clientEnv } from "@/lib/env";
import type { Category, Product } from "@/types/store";

const API_BASE_URL = clientEnv.apiUrl;
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();
const DEMO_FALLBACK = clientEnv.demoCatalogFallback;
const PRODUCT_PLACEHOLDER = "/images/gpu_card.png";
const CATEGORY_PLACEHOLDER = "/template/images/categories/categories-02.png";

export type CatalogLocale = "en" | "ar";

type ApiCategory = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_featured: boolean;
  children: ApiCategory[];
};

type ApiAttribute = {
  definition_id: number;
  code: string;
  label: string;
  data_type: "text" | "number" | "boolean";
  value: string;
  unit?: string | null;
  is_filterable: boolean;
  sort_order: number;
};

type ApiImage = {
  id: number;
  url: string;
  alt_text?: string | null;
  caption?: string | null;
  sort_order: number;
  is_primary: boolean;
};

type ApiProduct = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  short_description?: string | null;
  description?: string | null;
  brand?: string | null;
  list_price: string | number;
  stock_qty: number;
  is_dropship_enabled: boolean;
  warranty_months: number;
  category?: ApiCategory | null;
  is_featured: boolean;
  images: ApiImage[];
  attributes: ApiAttribute[];
  seo_title?: string | null;
  seo_description?: string | null;
};

type ApiProductList = {
  products: ApiProduct[];
  total_count: number;
  page: number;
  limit: number;
};

export class CatalogApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogApiError";
    this.status = status;
  }
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
  } catch {
    throw new CatalogApiError("The Elitedom catalogue service is currently unreachable.", 0);
  }
  if (!response.ok) {
    let message = "We could not load the catalogue.";
    try {
      const payload = (await response.json()) as {
        detail?: string | { message?: string };
        message?: string;
      };
      message =
        (typeof payload.detail === "string" ? payload.detail : payload.detail?.message) ??
        payload.message ??
        message;
    } catch {
      // Keep the stable message for proxy and gateway errors.
    }
    throw new CatalogApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

function resolveMediaUrl(url?: string | null): string {
  if (!url) return PRODUCT_PLACEHOLDER;
  if (url.startsWith("/media/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return PRODUCT_PLACEHOLDER;
}

function mapProduct(product: ApiProduct): Product {
  const orderedImages = [...product.images].sort(
    (first, second) =>
      Number(second.is_primary) - Number(first.is_primary) ||
      first.sort_order - second.sort_order ||
      first.id - second.id,
  );
  const gallery = orderedImages.map((image) => resolveMediaUrl(image.url));
  const image = gallery[0] ?? PRODUCT_PLACEHOLDER;
  return {
    id: String(product.id),
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description:
      product.short_description ??
      product.description ??
      "Product details are available in the technical specifications.",
    longDescription: product.description ?? undefined,
    brand: product.brand ?? "Elitedom",
    category: product.category?.slug ?? "uncategorized",
    categoryName: product.category?.name ?? "Technology",
    priceEgp: Number(product.list_price),
    stockQty: product.stock_qty,
    dropshipEnabled: product.is_dropship_enabled,
    image,
    gallery: gallery.length > 0 ? gallery : [image],
    specs: product.attributes.map((attribute) => ({
      code: attribute.code,
      label: attribute.label,
      value: attribute.unit ? `${attribute.value} ${attribute.unit}` : attribute.value,
      filterable: attribute.is_filterable,
    })),
    warrantyMonths: product.warranty_months,
    rating: 0,
    featured: product.is_featured,
    seoTitle: product.seo_title ?? undefined,
    seoDescription: product.seo_description ?? undefined,
  };
}

function mapCategory(category: ApiCategory): Category {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
    image: resolveCategoryImage(category.image_url),
    featured: category.is_featured,
    children: category.children.map(mapCategory),
  };
}

function resolveCategoryImage(url?: string | null): string {
  if (!url) return CATEGORY_PLACEHOLDER;
  if (url.startsWith("/media/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return CATEGORY_PLACEHOLDER;
}

export async function fetchRichCatalog(input: {
  locale: CatalogLocale;
  query?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
}): Promise<Product[]> {
  const parameters = new URLSearchParams({
    locale: input.locale,
    limit: String(input.limit ?? 100),
  });
  if (input.query?.trim()) parameters.set("q", input.query.trim());
  if (input.category) parameters.set("category", input.category);
  if (input.featured !== undefined) parameters.set("featured", String(input.featured));
  try {
    const payload = await request<ApiProductList>(`/catalog/products?${parameters}`);
    return payload.products.map(mapProduct);
  } catch (error) {
    if (!DEMO_FALLBACK || (error instanceof CatalogApiError && error.status !== 0)) throw error;
    const normalizedQuery = input.query?.trim().toLowerCase();
    return CATALOG.filter((product) =>
      (!input.category || product.category === input.category) &&
      (!input.featured || product.featured) &&
      (!normalizedQuery ||
        [product.name, product.brand, product.sku, product.categoryName]
          .concat(product.specs.flatMap((specification) => [specification.label, specification.value]))
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)),
    );
  }
}

export async function fetchRichProduct(
  identifier: string,
  locale: CatalogLocale,
): Promise<Product | undefined> {
  try {
    return mapProduct(
      await request<ApiProduct>(
        `/catalog/products/${encodeURIComponent(identifier)}?locale=${locale}`,
      ),
    );
  } catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) return undefined;
    if (!DEMO_FALLBACK || (error instanceof CatalogApiError && error.status !== 0)) throw error;
    return findCatalogProduct(identifier) ?? CATALOG.find((product) => product.slug === identifier);
  }
}

export async function fetchRichCategories(locale: CatalogLocale): Promise<Category[]> {
  try {
    return (await request<ApiCategory[]>(`/catalog/categories?locale=${locale}`)).map(mapCategory);
  } catch (error) {
    if (!DEMO_FALLBACK || (error instanceof CatalogApiError && error.status !== 0)) throw error;
    return CATEGORIES;
  }
}
