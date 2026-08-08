"use client";

import type { HTMLAttributes, TableHTMLAttributes } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel = "Tabs",
}: {
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-elevated/60 p-1" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={item.value === value}
          className={cn(
            "focus-ring whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition sm:text-sm",
            item.value === value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:bg-surface/60 hover:text-foreground",
          )}
          key={item.value}
          onClick={() => onChange(item.value)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className={cn("w-full border-collapse text-start text-sm text-foreground", className)} {...props} />
    </div>
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-4 py-3.5 text-start align-middle", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border bg-elevated/70 px-4 py-3 text-start text-[11px] font-black uppercase tracking-[0.08em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
  previousLabel = "Previous",
  nextLabel = "Next",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safePageCount);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <Button disabled={safePage <= 1} onClick={() => onChange(safePage - 1)} size="sm" variant="secondary">
        {previousLabel}
      </Button>
      <span className="rounded-md bg-elevated px-2.5 py-1 text-xs font-bold text-muted">{safePage} / {safePageCount}</span>
      <Button disabled={safePage >= safePageCount} onClick={() => onChange(safePage + 1)} size="sm" variant="secondary">
        {nextLabel}
      </Button>
    </nav>
  );
}
