"use client";

import type {
  HTMLAttributes,
  TableHTMLAttributes,
} from "react";
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
    <div
      aria-label={ariaLabel}
      className="inline-flex rounded-xl border border-border bg-surface p-1"
      role="tablist"
    >
      {items.map((item) => (
        <button
          aria-selected={item.value === value}
          className={cn(
            "focus-ring rounded-lg px-3 py-2 text-sm font-bold",
            item.value === value
              ? "bg-primary text-primary-contrast"
              : "text-muted hover:bg-elevated hover:text-foreground",
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

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table
        className={cn(
          "w-full border-collapse bg-surface text-start text-sm text-foreground",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-border px-4 py-3 text-start", className)}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border bg-elevated px-4 py-3 text-start text-xs font-black uppercase tracking-wide text-muted",
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
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <Button
        disabled={safePage <= 1}
        onClick={() => onChange(safePage - 1)}
        size="sm"
        variant="secondary"
      >
        {previousLabel}
      </Button>
      <span className="text-sm font-semibold text-muted">
        {safePage} / {safePageCount}
      </span>
      <Button
        disabled={safePage >= safePageCount}
        onClick={() => onChange(safePage + 1)}
        size="sm"
        variant="secondary"
      >
        {nextLabel}
      </Button>
    </nav>
  );
}
