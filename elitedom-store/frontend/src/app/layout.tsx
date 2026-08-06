import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { PreferenceBar } from "@/components/preferences/PreferenceBar";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SiteFooter } from "@/components/store/SiteFooter";
import { SiteHeader } from "@/components/store/SiteHeader";
import { StoreProvider } from "@/components/store/StoreProvider";
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  getDirection,
  isLocale,
  isThemePreference,
  LOCALE_COOKIE,
  PREFERENCE_BOOTSTRAP_SCRIPT,
  resolveTheme,
  THEME_COOKIE,
} from "@/config/preferences";
import { AppPreferencesProvider } from "@/providers/AppPreferencesProvider";

export const metadata: Metadata = {
  title: "Elitedom Store — Technology built around trust",
  description:
    "Egypt's enterprise commerce storefront for hardware, workstations, and B2B procurement, synchronized with Odoo 17.",
  keywords: [
    "elitedom",
    "egypt hardware",
    "odoo erp",
    "gaming pc egypt",
    "workstations cairo",
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const initialLocale = isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;
  const initialTheme = isThemePreference(themeCookie) ? themeCookie : DEFAULT_THEME;
  const initialResolvedTheme = resolveTheme(initialTheme);

  return (
    <html
      className="scroll-smooth"
      data-theme={initialResolvedTheme}
      data-theme-preference={initialTheme}
      dir={getDirection(initialLocale)}
      lang={initialLocale}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground">
        <AppPreferencesProvider
          initialLocale={initialLocale}
          initialTheme={initialTheme}
        >
          <StoreProvider>
            <div className="flex min-h-screen flex-col">
              <PreferenceBar />
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <CartDrawer />
          </StoreProvider>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
