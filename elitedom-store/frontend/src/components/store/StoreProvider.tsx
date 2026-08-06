"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addRemoteCartItem,
  addRemoteWishlistItem,
  fetchRemoteCart,
  fetchRemoteWishlist,
  mapRemoteCart,
  mergeGuestCart,
  removeRemoteCartItem,
  removeRemoteWishlistItem,
  updateRemoteCartItem,
} from "@/lib/api";
import { getCartSubtotal } from "@/lib/checkout";
import type { CartItem, Currency, CustomerSession, Product } from "@/types/store";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};

type StoreContextValue = {
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  currency: Currency;
  session: CustomerSession | null;
  guestSessionId: string | null;
  wishlist: string[];
  isCartOpen: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  setCurrency: (currency: Currency) => void;
  setSession: (session: CustomerSession | null) => void;
  setCartOpen: (isOpen: boolean) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
};

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const CART_KEY = "elitedom.store.cart.v1";
const WISHLIST_KEY = "elitedom.store.wishlist.v1";
const CURRENCY_KEY = "elitedom.store.currency.v1";
const SESSION_KEY = "elitedom.store.session.v1";
const GUEST_SESSION_KEY = "elitedom.store.guest-session.v1";

function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function createGuestSessionId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isServerProductId(productId: string) {
  const numericId = Number(productId);
  return Number.isSafeInteger(numericId) && numericId > 0;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [currency, setCurrencyState] = useState<Currency>("EGP");
  const [session, setSessionState] = useState<CustomerSession | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isCartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(safeRead<CartItem[]>(CART_KEY, []));
      setWishlist(safeRead<string[]>(WISHLIST_KEY, []));
      setCurrencyState(safeRead<Currency>(CURRENCY_KEY, "EGP"));
      try {
        const savedGuestSessionId = window.localStorage.getItem(GUEST_SESSION_KEY);
        const nextGuestSessionId = savedGuestSessionId || createGuestSessionId();
        if (!savedGuestSessionId) {
          window.localStorage.setItem(GUEST_SESSION_KEY, nextGuestSessionId);
        }
        setGuestSessionId(nextGuestSessionId);
      } catch {
        setGuestSessionId(createGuestSessionId());
      }
      try {
        const storedSession = window.sessionStorage.getItem(SESSION_KEY);
        setSessionState(storedSession ? (JSON.parse(storedSession) as CustomerSession) : null);
      } catch {
        setSessionState(null);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CURRENCY_KEY, JSON.stringify(currency));
  }, [currency, hydrated]);

  useEffect(() => {
    if (!hydrated || !guestSessionId) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const loadCart = async () => {
        try {
          const remoteCart = session
            ? await mergeGuestCart(session, guestSessionId)
            : await fetchRemoteCart(guestSessionId);
          if (!cancelled) setCart(mapRemoteCart(remoteCart));
        } catch {
          // Keep the browser copy usable while the API is unavailable.
        }
      };
      void loadCart();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [guestSessionId, hydrated, session]);

  useEffect(() => {
    if (!hydrated || !session) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const synchronizeWishlist = async () => {
        try {
          const remoteWishlist = await fetchRemoteWishlist(session);
          const localWishlist = safeRead<string[]>(WISHLIST_KEY, []).filter(isServerProductId);
          const missingRemoteItems = localWishlist.filter((productId) => !remoteWishlist.includes(productId));
          await Promise.all(
            missingRemoteItems.map((productId) =>
              addRemoteWishlistItem(productId, session).catch(() => undefined),
            ),
          );
          if (!cancelled) {
            setWishlist([...new Set([...remoteWishlist, ...localWishlist])]);
          }
        } catch {
          // The local wishlist remains available when the account API is offline.
        }
      };
      void synchronizeWishlist();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hydrated, session]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  }, []);

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      const available = product.stockQty > 0 || product.dropshipEnabled;
      if (!available) {
        notify(`${product.name} is currently unavailable.`, "error");
        return;
      }

      setCart((current) => {
        const existing = current.find((item) => item.product.id === product.id);
        if (!existing) return [...current, { product, quantity }];
        const maximum = product.dropshipEnabled ? 100 : product.stockQty;
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(maximum, item.quantity + quantity) }
            : item,
        );
      });
      setCartOpen(true);
      notify(`${product.name} was added to your cart.`);

      if (!guestSessionId || !isServerProductId(product.id)) return;
      void addRemoteCartItem({ productId: product.id, quantity }, guestSessionId, session)
        .then((remoteCart) => setCart(mapRemoteCart(remoteCart)))
        .catch(() => undefined);
    },
    [guestSessionId, notify, session],
  );

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const target = cart.find((item) => item.product.id === productId);
    const maximum = target?.product.dropshipEnabled ? 100 : target?.product.stockQty ?? 0;
    const nextQuantity = Math.min(maximum, Math.max(0, quantity));
    setCart((current) =>
      current.flatMap((item) => {
        if (item.product.id !== productId) return [item];
        if (nextQuantity <= 0) return [];
        const maximum = item.product.dropshipEnabled ? 100 : item.product.stockQty;
        return [{ ...item, quantity: Math.min(maximum, nextQuantity) }];
      }),
    );
    if (!guestSessionId || !target?.serverItemId) return;
    const request = nextQuantity <= 0
      ? removeRemoteCartItem(target.serverItemId, guestSessionId, session)
      : updateRemoteCartItem(target.serverItemId, nextQuantity, guestSessionId, session);
    void request.then((remoteCart) => setCart(mapRemoteCart(remoteCart))).catch(() => undefined);
  }, [cart, guestSessionId, session]);

  const removeFromCart = useCallback((productId: string) => {
    const target = cart.find((item) => item.product.id === productId);
    setCart((current) => current.filter((item) => item.product.id !== productId));
    if (!guestSessionId || !target?.serverItemId) return;
    void removeRemoteCartItem(target.serverItemId, guestSessionId, session)
      .then((remoteCart) => setCart(mapRemoteCart(remoteCart)))
      .catch(() => undefined);
  }, [cart, guestSessionId, session]);

  const clearCart = useCallback(() => {
    const remoteItemIds = cart.flatMap((item) => item.serverItemId ? [item.serverItemId] : []);
    setCart([]);
    if (!guestSessionId || remoteItemIds.length === 0) return;
    void Promise.all(
      remoteItemIds.map((itemId) =>
        removeRemoteCartItem(itemId, guestSessionId, session).catch(() => undefined),
      ),
    );
  }, [cart, guestSessionId, session]);

  const toggleWishlist = useCallback((productId: string) => {
    const isSaved = wishlist.includes(productId);
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
    if (!session || !isServerProductId(productId)) return;
    const request = isSaved
      ? removeRemoteWishlistItem(productId, session)
      : addRemoteWishlistItem(productId, session);
    void request.catch(() => undefined);
  }, [session, wishlist]);

  const setCurrency = useCallback((nextCurrency: Currency) => {
    setCurrencyState(nextCurrency);
  }, []);

  const setSession = useCallback((nextSession: CustomerSession | null) => {
    setSessionState(nextSession);
    try {
      if (nextSession) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // A private browser session may block storage; keep the in-memory session usable.
    }
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      cart,
      cartCount: cart.reduce((total, item) => total + item.quantity, 0),
      cartSubtotal: getCartSubtotal(cart),
      currency,
      session,
      guestSessionId,
      wishlist,
      isCartOpen,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      setCurrency,
      setSession,
      setCartOpen,
      notify,
    }),
    [
      addToCart,
      cart,
      clearCart,
      currency,
      guestSessionId,
      isCartOpen,
      notify,
      removeFromCart,
      session,
      setCurrency,
      setSession,
      toggleWishlist,
      updateQuantity,
      wishlist,
    ],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] mx-auto flex max-w-md flex-col gap-2 px-4" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.tone === "error"
                ? "border-rose-300/40 bg-rose-950/95 text-rose-100"
                : toast.tone === "info"
                  ? "border-sky-300/40 bg-sky-950/95 text-sky-100"
                  : "border-emerald-300/40 bg-emerald-950/95 text-emerald-100"
            }`}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider.");
  return context;
}
