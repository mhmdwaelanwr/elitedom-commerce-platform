import type { HTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-elevated", className)} {...props} />;
}

export function Toast({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "success" | "danger" | "info";
}) {
  const toneClasses = {
    success: "border-success/30 bg-success/5 text-success",
    danger: "border-danger/30 bg-danger/5 text-danger",
    info: "border-primary/25 bg-primary/5 text-foreground",
  };

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm", toneClasses[tone])} role="status">
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
  return <StatePanel icon="empty" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StatePanel actionVariant="danger" icon="error" {...props} />;
}

function StatePanel({
  actionLabel,
  actionVariant = "secondary",
  description,
  icon,
  onAction,
  title,
}: StateProps & { icon: "empty" | "error" }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-surface p-7 text-center">
      <span aria-hidden="true" className={`mx-auto grid h-11 w-11 place-items-center rounded-lg ${icon === "error" ? "bg-danger/10 text-danger" : "bg-elevated text-primary"}`}>
        {icon === "error" ? <ErrorIcon /> : <EmptyIcon />}
      </span>
      <h2 className="mt-4 text-lg font-black tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction} variant={actionVariant}>{actionLabel}</Button>
      ) : null}
    </section>
  );
}

function EmptyIcon() {
  return <svg fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function ErrorIcon() {
  return <svg fill="none" height="20" viewBox="0 0 24 24" width="20"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7v6m0 4h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}
