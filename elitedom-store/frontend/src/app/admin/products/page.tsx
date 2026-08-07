"use client";

import Link from "next/link";
import { CatalogAdminWorkspace } from "@/components/admin/CatalogAdminWorkspace";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminProductsPage() {
  const { locale } = usePreferences();
  const ar = locale === "ar";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-black text-foreground">
            {ar ? "إدارة الكتالوج المتقدمة" : "Advanced catalogue management"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {ar
              ? "افتح مساحة المحتوى لإدارة العربي والإنجليزي وSEO والنشر والتصنيفات والمواصفات المرنة."
              : "Open the content workspace for bilingual copy, SEO, publishing, categories, and flexible specifications."}
          </p>
        </div>
        <Link className="button-primary" href="/admin/catalog-content">
          {ar ? "محتوى وSEO" : "Content & SEO"}
        </Link>
      </div>
      <CatalogAdminWorkspace />
    </>
  );
}
