import type { ReactNode } from "react";
import Link from "next/link";
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
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({ value }: { value: string | null | undefined }) {
  const tone = statusTone(value);
  const toneClasses = {
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    slate: "border-slate-600 bg-slate-800/80 text-slate-300",
  } as const;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${toneClasses[tone]}`}>{humanize(value)}</span>;
}

export function AdminLoading({ label = "Loading operational data…" }: { label?: string }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-800 bg-slate-950/35"><div className="flex items-center gap-3 text-sm font-semibold text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-r-transparent" />{label}</div></div>;
}

export function AdminError({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return <div className="rounded-2xl border border-rose-400/25 bg-rose-950/25 p-5"><p className="font-bold text-rose-100">The console could not load this data.</p><p className="mt-1 text-sm text-rose-200/80">{error}</p>{onRetry ? <button className="button-secondary mt-4 text-sm" onClick={onRetry} type="button">Try again</button> : null}</div>;
}

export function AdminEmpty({
  detail,
  title = "No records found",
}: {
  detail: string;
  title?: string;
}) {
  return <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/25 p-6 text-center"><div><p className="font-bold text-slate-200">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div></div>;
}

export function AdminSectionDenied({ section }: { section: string }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-7 text-center"><div><p className="text-sm font-black text-amber-100">This staff role cannot open {section}.</p><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Access is enforced by the API as well as this console. Ask a system administrator to assign the appropriate operational role.</p><Link className="button-secondary mt-5 text-sm" href="/admin">Back to overview</Link></div></div>;
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
  return <div className="mt-4 flex items-center justify-between gap-3 text-sm"><p className="text-slate-500">Page {page} of {totalPages} · {total} total</p><div className="flex gap-2"><button className="button-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={page <= 1} onClick={() => onChange(page - 1)} type="button">Previous</button><button className="button-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={page >= totalPages} onClick={() => onChange(page + 1)} type="button">Next</button></div></div>;
}
