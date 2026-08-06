"use client";

import { useEffect, useState } from "react";
import { ProductSkeleton, ProductUnavailable } from "@/components/store/ProductDetailStates";
import { ProductDetailView } from "@/components/store/ProductDetailView";
import { fetchCatalog, fetchProduct } from "@/lib/api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { Product } from "@/types/store";

export function ProductDetail({ productId }: { productId: string }) {
  const { t } = usePreferences();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      setProduct(null);
      setRelatedProducts([]);

      void fetchProduct(productId)
        .then(async (nextProduct) => {
          if (!active) return;
          if (!nextProduct) {
            setError(t("storefront", "productNoLongerAvailable"));
            return;
          }

          setProduct(nextProduct);
          try {
            const catalogue = await fetchCatalog();
            if (active) {
              setRelatedProducts(
                catalogue
                  .filter((item) => item.category === nextProduct.category && item.id !== nextProduct.id)
                  .slice(0, 3),
              );
            }
          } catch {
            // Related products are optional and must not block the product page.
          }
        })
        .catch((requestError: unknown) => {
          if (!active) return;
          setError(requestError instanceof Error ? requestError.message : t("storefront", "productLoadError"));
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [productId, t]);

  if (isLoading) return <ProductSkeleton />;
  if (error || !product) {
    return <ProductUnavailable message={error ?? t("storefront", "productNoLongerAvailable")} />;
  }

  return <ProductDetailView key={product.id} product={product} relatedProducts={relatedProducts} />;
}
