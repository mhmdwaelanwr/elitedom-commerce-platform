import { fetchRemoteCart, mapRemoteCart } from "@/lib/api";
import { fetchRichCatalog } from "@/lib/catalog-api";
import { getGuestCartSessionId } from "@/lib/guest-cart";
import type { StoreLocale } from "@/components/store/StoreHeader";
import type { CartItem, CustomerSession } from "@/types/store";

export type GuestCartSnapshot = {
  sessionId?: string;
  session?: CustomerSession;
  items: CartItem[];
};

export async function loadGuestCart(
  locale: StoreLocale,
  session?: CustomerSession | null,
): Promise<GuestCartSnapshot> {
  const sessionId = session ? undefined : getGuestCartSessionId();
  const cart = await fetchRemoteCart(sessionId, session);
  const serverItems = mapRemoteCart(cart);

  let richProducts = [] as Awaited<ReturnType<typeof fetchRichCatalog>>;
  try {
    richProducts = await fetchRichCatalog({ locale, limit: 100 });
  } catch {
    // The cart stays usable even when catalogue enrichment is unavailable.
  }

  const byId = new Map(richProducts.map((product) => [product.id, product]));
  const bySku = new Map(richProducts.map((product) => [product.sku, product]));
  const items = serverItems.map((item) => {
    const rich = byId.get(item.product.id) ?? bySku.get(item.product.sku);
    if (!rich) return item;
    return {
      ...item,
      product: {
        ...rich,
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        priceEgp: item.product.priceEgp,
      },
    };
  });

  return { sessionId, session: session ?? undefined, items };
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + item.product.priceEgp * item.quantity, 0);
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}
