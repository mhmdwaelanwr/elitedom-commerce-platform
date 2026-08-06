import type { Metadata } from "next";
import "./globals.css";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SiteFooter } from "@/components/store/SiteFooter";
import { SiteHeader } from "@/components/store/SiteHeader";
import { StoreProvider } from "@/components/store/StoreProvider";

export const metadata: Metadata = {
  title: "Elitedom Store — Technology built around trust",
  description:
    "Egypt's premier enterprise e-commerce storefront for high-performance hardware, workstations, and institutional B2B procurement, synchronized with Odoo 17 CE ERP.",
  keywords: [
    "elitedom",
    "egypt hardware",
    "odoo erp",
    "gaming pc egypt",
    "workstations cairo",
    "rtx 4090 egypt",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#060b13] text-[#f8fafc] antialiased selection:bg-sky-400 selection:text-slate-950">
        <StoreProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <CartDrawer />
        </StoreProvider>
      </body>
    </html>
  );
}
