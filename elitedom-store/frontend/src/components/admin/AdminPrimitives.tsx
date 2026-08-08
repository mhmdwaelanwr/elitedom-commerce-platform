import Link from "next/link";
import type { ReactNode } from "react";
import { humanize, statusTone } from "@/lib/admin-ui";

export function AdminPageHeader({
  actions,
  description,
  eyebrow = "Operations console",
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-5">
      <div className="min-w-0">
        <p className="section-kicker">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({ value }: { value: string | null | undefined }) {
  const tone = statusTone(value);
  const toneClasses = {
    amber: "border-warning/25 bg-warning/5 text-warning",
    emerald: "border-success/25 bg-success/5 text-success",
    rose: "border-danger/25 bg-danger/5 text-danger",
    slate: "border-border bg-elevated text-muted",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${toneClasses[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {humanize(value)}
    </span>
  );
}

export function AdminLoading({ label = "Loading operational data…" }: { label?: string }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-e-transparent" />
        {label}
      </div>
    </div>
  );
}

export function AdminError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-danger/25 bg-danger/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger"><ErrorIcon /></span>
        <div>
          <p className="font-black text-danger">The console could not load this data.</p>
          <p className="mt-1 text-sm leading-6 text-muted">{error}</p>
        </div>
      </div>
      {onRetry ? <button className="button-secondary mt-4 text-sm" onClick={onRetry} type="button">Try again</button> : null}
    </div>
  );
}

export function AdminEmpty({ detail, title = "No records found" }: { detail: string; title?: string }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-border bg-surface p-6 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-elevated text-primary"><EmptyIcon /></span>
        <p className="mt-3 font-black text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
      </div>
    </div>
  );
}

export function AdminSectionDenied({ section }: { section: string }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-xl border border-warning/20 bg-warning/5 p-7 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-warning/10 text-warning"><LockIcon /></span>
        <p className="mt-4 text-sm font-black text-foreground">This staff role cannot open {section}.</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">Access is enforced by the API as well as this console. Ask a system administrator to assign the appropriate operational role.</p>
        <Link className="button-secondary mt-5 text-sm" href="/admin">Back to overview</Link>
      </div>
    </div>
  );
}

export function AdminPagination({
  onChange,
  page,
  pageSize,
  total,
}: {
  onChange: (nextPage: number) => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
      <p className="text-xs font-medium text-muted">Page {page} of {totalPages} · {total} total</p>
      <div className="flex gap-2">
        <button className="button-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={page <= 1} onClick={() => onChange(page - 1)} type="button">Previous</button>
        <button className="button-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={page >= totalPages} onClick={() => onChange(page + 1)} type="button">Next</button>
      </div>
    </div>
  );
}

function ErrorIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7v6m0 4h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>; }
function EmptyIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function LockIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="11" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" /></svg>; }
