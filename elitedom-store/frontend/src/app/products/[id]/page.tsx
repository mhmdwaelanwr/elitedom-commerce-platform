import type { Metadata } from "next";
import { ProductDetail } from "@/components/store/ProductDetail";
import { fetchRichProduct } from "@/lib/catalog-api";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type ProductPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchRichProduct(id, "en").catch(() => undefined);
  if (!product) {
    return {
      title: "Product unavailable",
      robots: { index: false, follow: false },
    };
  }
  const slug = product.slug ?? product.id;
  const canonical = `/products/${encodeURIComponent(slug)}`;
  const description = product.seoDescription ?? product.description;
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: product.seoTitle ?? product.name,
      description,
      images: product.image ? [{ url: product.image, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.seoTitle ?? product.name,
      description,
      images: product.image ? [product.image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await fetchRichProduct(id, "en").catch(() => undefined);
  const canonicalSlug = product?.slug ?? id;
  const structuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.longDescription ?? product.description,
        sku: product.sku,
        brand: { "@type": "Brand", name: product.brand },
        image: product.gallery,
        url: `${SITE_URL}/products/${encodeURIComponent(canonicalSlug)}`,
        offers: {
          "@type": "Offer",
          priceCurrency: "EGP",
          price: product.priceEgp,
          availability:
            product.stockQty > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/products/${encodeURIComponent(canonicalSlug)}`,
        },
      }
    : null;

  return (
    <>
      {structuredData && (
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
          type="application/ld+json"
        />
      )}
      <ProductDetail key={id} productId={id} />
    </>
  );
}
