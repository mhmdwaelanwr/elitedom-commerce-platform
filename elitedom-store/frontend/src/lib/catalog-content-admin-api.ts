import type { CustomerSession } from "@/types/store";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export type CatalogContent = {
  product_id: number;
  slug: string;
  name: string;
  name_ar?: string | null;
  short_description?: string | null;
  short_description_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  seo_title?: string | null;
  seo_title_ar?: string | null;
  seo_description?: string | null;
  seo_description_ar?: string | null;
  publication_status: "draft" | "published" | "archived";
  is_featured: boolean;
  published_at?: string | null;
};

export type CatalogContentInput = Partial<Omit<CatalogContent, "product_id" | "published_at">>;

export type ContentCategory = {
  id: number;
  name: string;
  name_ar?: string | null;
  slug: string;
  parent_id?: number | null;
  description?: string | null;
  description_ar?: string | null;
  seo_title?: string | null;
  seo_title_ar?: string | null;
  seo_description?: string | null;
  seo_description_ar?: string | null;
  image_url?: string | null;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
};

export type ContentCategoryInput = Omit<ContentCategory, "id">;

export type AttributeDefinition = {
  id: number;
  code: string;
  name: string;
  name_ar?: string | null;
  data_type: "text" | "number" | "boolean";
  unit?: string | null;
  unit_ar?: string | null;
  is_filterable: boolean;
  is_active: boolean;
  sort_order: number;
};

export type AttributeDefinitionInput = Omit<AttributeDefinition, "id">;

export class CatalogContentAdminError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CatalogContentAdminError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  session: CustomerSession,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/admin/catalog${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new CatalogContentAdminError("The catalogue content service is unreachable.", 0);
  }
  if (!response.ok) {
    let message = "The catalogue content operation failed.";
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
      // Keep the stable message for non-JSON gateway errors.
    }
    throw new CatalogContentAdminError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getCatalogContent(productId: number, session: CustomerSession) {
  return request<CatalogContent>(`/products/${productId}/content`, session);
}

export function updateCatalogContent(
  productId: number,
  input: CatalogContentInput,
  session: CustomerSession,
) {
  return request<CatalogContent>(`/products/${productId}/content`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function listContentCategories(session: CustomerSession) {
  return request<ContentCategory[]>("/categories", session);
}

export function createContentCategory(
  input: ContentCategoryInput,
  session: CustomerSession,
) {
  return request<ContentCategory>("/categories", session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateContentCategory(
  categoryId: number,
  input: ContentCategoryInput,
  session: CustomerSession,
) {
  return request<ContentCategory>(`/categories/${categoryId}`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function listAttributeDefinitions(session: CustomerSession) {
  return request<AttributeDefinition[]>("/attributes", session);
}

export function createAttributeDefinition(
  input: AttributeDefinitionInput,
  session: CustomerSession,
) {
  return request<AttributeDefinition>("/attributes", session, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAttributeDefinition(
  attributeId: number,
  input: AttributeDefinitionInput,
  session: CustomerSession,
) {
  return request<AttributeDefinition>(`/attributes/${attributeId}`, session, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
