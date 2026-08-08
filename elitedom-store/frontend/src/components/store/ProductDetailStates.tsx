"use client";

import Link from "next/link";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export function ProductSkeleton() {
  return (
    <div className="pb-16">
      <div className="site-container py-7">
        <div className="h-4 w-72 animate-pulse rounded bg-elevated" />
      </div>
      <div className="border-y border-border bg-surface">
        <div className="site-container grid gap-8 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,.85fr)] lg:gap-12">
          <div className="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)]">
            <div className="hidden space-y-2 md:block">
              {Array.from({ length: 4 }, (_, index) => <div className="h-20 animate-pulse rounded-xl bg-elevated" key={index} />)}
            </div>
            <div className="aspect-square animate-pulse rounded-2xl border border-border bg-elevated" />
          </div>
          <div className="space-y-5">
            <div className="h-4 w-28 animate-pulse rounded bg-elevated" />
            <div className="h-9 w-5/6 animate-pulse rounded bg-elevated" />
            <div className="h-5 w-full animate-pulse rounded bg-elevated" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-elevated" />
            <div className="h-10 w-44 animate-pulse rounded bg-elevated" />
            <div className="grid grid-cols-3 gap-3 border-y border-border py-5">
              {Array.from({ length: 3 }, (_, index) => <div className="h-12 animate-pulse rounded bg-elevated" key={index} />)}
            </div>
            <div className="h-12 w-full animate-pulse rounded-xl bg-elevated" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-elevated" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductUnavailable({ message }: { message: string }) {
  const { t } = usePreferences();
  return (
    <div className="site-container py-20 text-center sm:py-28">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-border bg-elevated text-xl font-black text-muted" aria-hidden="true">!</span>
      <h1 className="mt-5 text-2xl font-black text-foreground">{t("storefront", "productUnavailable")}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{message}</p>
      <Link className="button-primary mt-6" href="/shop">{t("storefront", "returnToCatalogue")}</Link>
    </div>
  );
}
