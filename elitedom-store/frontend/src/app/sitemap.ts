import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

type CatalogPage = {
  products: Array<{ id: number; slug: string }>;
  total_count: number;
  page: number;
  limit: number;
};

async function catalogProductPaths(): Promise<string[]> {
  const paths: string[] = [];
  const limit = 100;
  try {
    for (let page = 1; page <= 100; page += 1) {
      const response = await fetch(
        `${API_BASE_URL}/catalog/products?locale=en&page=${page}&limit=${limit}`,
        { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
      );
      if (!response.ok) break;
      const payload = (await response.json()) as CatalogPage;
      paths.push(
        ...payload.products.map(
          (product) => `/products/${encodeURIComponent(product.slug || String(product.id))}`,
        ),
      );
      if (page * payload.limit >= payload.total_count || payload.products.length === 0) break;
    }
  } catch {
    // A temporary catalogue outage must not make the entire sitemap endpoint fail.
  }
  return [...new Set(paths)];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
  ];
  const productRoutes = (await catalogProductPaths()).map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  return [...staticRoutes, ...productRoutes];
}
