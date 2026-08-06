import { ProductDetail } from "@/components/store/ProductDetail";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetail key={id} productId={id} />;
}
