import type { HTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-muted/20", className)}
      {...props}
    />
  );
}

export function Toast({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "success" | "danger" | "info";
}) {
  const toneClasses = {
    success: "border-success/40 bg-success/10 text-success",
    danger: "border-danger/40 bg-danger/10 text-danger",
    info: "border-primary/40 bg-primary/10 text-foreground",
  };

  return (
    <div
      className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", toneClasses[tone])}
      role="status"
    >
      {children}
    </div>
  );
}

type StateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonProps["variant"];
};

export function EmptyState(props: StateProps) {
  return <StatePanel icon="○" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StatePanel actionVariant="danger" icon="!" {...props} />;
}

function StatePanel({
  actionLabel,
  actionVariant = "secondary",
  description,
  icon,
  onAction,
  title,
}: StateProps & { icon: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-7 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-elevated text-lg font-black text-primary"
      >
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-black text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction} variant={actionVariant}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
