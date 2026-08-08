function readString(value: string | undefined, fallback = "") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const clientEnv = Object.freeze({
  apiUrl: withoutTrailingSlash(
    readString(import.meta.env.VITE_API_URL, "http://localhost:8000/api/v1"),
  ),
  siteUrl: withoutTrailingSlash(
    readString(import.meta.env.VITE_SITE_URL, "http://localhost:3000"),
  ),
  mediaUrl: withoutTrailingSlash(readString(import.meta.env.VITE_MEDIA_URL)),
  demoCatalogFallback: import.meta.env.VITE_DEMO_CATALOG_FALLBACK === "true",
  googleClientId: readString(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  appleClientId: readString(import.meta.env.VITE_APPLE_CLIENT_ID),
});
