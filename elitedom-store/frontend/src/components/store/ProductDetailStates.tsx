"use client";

import Link from "next/link";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function ProductSkeleton() {
  return (
    <div className="site-container py-14">
      <div className="grid animate-pulse gap-10 lg:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-elevated" />
        <div className="space-y-5 pt-4">
          <div className="h-5 w-24 rounded bg-elevated" />
          <div className="h-12 w-4/5 rounded bg-elevated" />
          <div className="h-24 rounded bg-elevated" />
          <div className="h-14 rounded bg-elevated" />
        </div>
      </div>
    </div>
  );
}

export function ProductUnavailable({ message }: { message: string }) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[55vh] place-items-center py-14 text-center">
      <div>
        <p className="text-4xl text-primary">⌁</p>
        <h1 className="mt-4 text-2xl font-black text-foreground">{t("storefront", "productUnavailable")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
        <Link className="button-primary mt-6" href="/shop">
          {t("storefront", "returnToCatalogue")}
        </Link>
      </div>
    </div>
  );
}
