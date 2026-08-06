"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminSectionDenied,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import {
  canAccessAdminSection,
  fetchAdminRmas,
  reviewAdminRma,
  type AdminRma,
} from "@/lib/admin-api";
import { formatAdminDateTime, humanize } from "@/lib/admin-ui";

const statusOptions = ["", "pending_review", "approved", "rejected", "completed"];

export default function AdminRmaPage() {
  const { session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "rma");
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminRmas>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminRma | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminRmas(session, { page, q: query || undefined, status: status || undefined }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load warranty claims.");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, query, session, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!allowed) return <AdminSectionDenied section="warranty claims" />;

  return <>
    <AdminPageHeader description="Review warranty evidence and move claims through the guarded RMA workflow. Every decision is stored with the staff member who made it." eyebrow="Customer support" title="Warranty desk" />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPage(1); setQuery(qDraft.trim()); }}><input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search ticket, order, customer name, or email" value={qDraft} /><select className="form-input" onChange={(event) => { setPage(1); setStatus(event.target.value); }} value={status}>{statusOptions.map((option) => <option key={option} value={option}>{option ? humanize(option) : "All claim states"}</option>)}</select><button className="button-primary px-4 py-2 text-sm" type="submit">Search</button></form>
    <div className="mt-5">{isLoading ? <AdminLoading label="Loading warranty desk…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.claims.length ? <><RmaTable claims={data.claims} onOpen={setSelected} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="No RMA ticket matches the selected filters." />}</div>
    {selected ? <RmaReviewPanel claim={selected} onClose={() => setSelected(null)} onSaved={() => void load()} /> : null}
  </>;
}

function RmaTable({ claims, onOpen }: { claims: AdminRma[]; onOpen: (claim: AdminRma) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[62rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Ticket</th><th className="px-4 py-3 font-bold">Customer & order</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Review</th></tr></thead><tbody className="divide-y divide-slate-800/80">{claims.map((claim) => <tr className="hover:bg-slate-900/35" key={claim.ticket_number}><td className="px-5 py-4"><p className="font-black text-sky-200">{claim.ticket_number}</p><p className="mt-1 text-xs text-slate-500">{formatAdminDateTime(claim.created_at)}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{claim.customer_name}</p><p className="mt-1 text-xs text-slate-500">{claim.order_number} · {claim.customer_email}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{claim.product_name}</p><p className="mt-1 font-mono text-xs text-slate-500">{claim.sku}{claim.serial_number ? ` · ${claim.serial_number}` : ""}</p></td><td className="px-4 py-4"><StatusPill value={claim.status} /><p className="mt-2 max-w-xs truncate text-xs text-slate-500">{claim.resolution_notes ?? "No resolution recorded"}</p></td><td className="px-5 py-4 text-right"><button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(claim)} type="button">Review</button></td></tr>)}</tbody></table></div></div>;
}

function RmaReviewPanel({ claim, onClose, onSaved }: { claim: AdminRma; onClose: () => void; onSaved: () => void }) {
  const { notify, session } = useStore();
  const availableDecision = claim.status === "pending_review" ? ["approved", "rejected"] as const : claim.status === "approved" ? ["completed"] as const : [];
  const [decision, setDecision] = useState<(typeof availableDecision)[number] | "">(availableDecision[0] ?? "");
  const [notes, setNotes] = useState(claim.resolution_notes ?? "");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !decision) return;
    if (decision === "rejected" && !notes.trim()) {
      setError("A rejection requires clear resolution notes.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reviewAdminRma(claim.ticket_number, { status: decision, resolution_notes: notes.trim() || undefined }, session);
      notify(`${claim.ticket_number} marked ${humanize(decision)}.`);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save the RMA review.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 p-0 backdrop-blur-sm sm:p-4"><aside aria-label="RMA review" className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-700 bg-[#091423] shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-[#091423]/95 px-5 py-4 backdrop-blur"><div><p className="section-kicker">RMA review</p><h2 className="mt-1 text-lg font-black text-white">{claim.ticket_number}</h2></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div><div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><Info label="Customer" value={`${claim.customer_name}\n${claim.customer_email}\n${claim.order_number}`} /><Info label="Product" value={`${claim.product_name}\n${claim.sku}${claim.serial_number ? `\n${claim.serial_number}` : ""}`} /></div><Info label="Customer report" value={claim.reason} />{claim.evidence_media_url ? <a className="inline-flex rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm font-bold text-sky-100 hover:bg-sky-400/15 focus-ring" href={claim.evidence_media_url} rel="noreferrer" target="_blank">Open submitted evidence ↗</a> : <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-sm text-amber-100">No evidence URL is recorded for this legacy claim.</p>}{availableDecision.length ? <form className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4" onSubmit={save}><p className="font-black text-cyan-100">Workflow decision</p><p className="mt-1 text-sm text-slate-400">The next valid states are determined from the current RMA state.</p><div className="mt-4 flex flex-wrap gap-2">{availableDecision.map((option) => <label className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold ${decision === option ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-700 text-slate-400"}`} key={option}><input checked={decision === option} className="sr-only" onChange={() => setDecision(option)} type="radio" value={option} />{humanize(option)}</label>)}</div><label className="mt-4 grid gap-2 text-sm font-bold text-slate-200"><span>Resolution notes {decision === "rejected" ? "(required)" : "(optional)"}</span><textarea className="form-input min-h-24 resize-y" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>{error ? <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">{error}</p> : null}<button className="button-primary mt-4 text-sm disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving…" : `Mark ${humanize(decision)}`}</button></form> : <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4"><StatusPill value={claim.status} /><p className="mt-3 text-sm leading-6 text-slate-400">This claim is in a terminal state and cannot be moved further by the RMA state machine.</p>{claim.resolution_notes ? <p className="mt-3 text-sm text-slate-200">{claim.resolution_notes}</p> : null}</div>}</div></aside></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-200">{value}</p></div>;
}
