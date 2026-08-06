import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 text-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-black text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
