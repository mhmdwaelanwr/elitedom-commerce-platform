/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_MEDIA_URL?: string;
  readonly VITE_DEMO_CATALOG_FALLBACK?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Temporary source-compatibility declaration for the retained typed API layer.
 * Vite replaces these exact expressions at build time from VITE_* values.
 * There is no Node/Next.js process object in the browser runtime.
 */
declare const process: {
  readonly env: {
    readonly NEXT_PUBLIC_API_URL?: string;
    readonly NEXT_PUBLIC_SITE_URL?: string;
    readonly NEXT_PUBLIC_MEDIA_URL?: string;
    readonly NEXT_PUBLIC_DEMO_CATALOG_FALLBACK?: string;
    readonly NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    readonly NEXT_PUBLIC_APPLE_CLIENT_ID?: string;
  };
};
