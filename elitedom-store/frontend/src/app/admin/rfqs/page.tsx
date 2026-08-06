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
  fetchAdminRfqs,
  issueAdminRfqQuote,
  type AdminRfq,
} from "@/lib/admin-api";
import { formatAdminDate, formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";

const statusOptions = ["", "submitted", "under_review", "quoted", "accepted", "declined"];

export default function AdminRfqsPage() {
  const { session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "rfqs");
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminRfqs>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminRfq | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminRfqs(session, { page, q: query || undefined, status: status || undefined }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load B2B RFQs.");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, query, session, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!allowed) return <AdminSectionDenied section="B2B RFQs" />;

  return <>
    <AdminPageHeader description="Review institutional demand and issue an auditable quote using the B2B pricing service. Product line quantities and price rules remain validated server-side." eyebrow="B2B commercial desk" title="Request for quotation" />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPage(1); setQuery(qDraft.trim()); }}><input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search RFQ code, company contact, or email" value={qDraft} /><select className="form-input" onChange={(event) => { setPage(1); setStatus(event.target.value); }} value={status}>{statusOptions.map((option) => <option key={option} value={option}>{option ? humanize(option) : "All RFQ states"}</option>)}</select><button className="button-primary px-4 py-2 text-sm" type="submit">Search</button></form>
    <div className="mt-5">{isLoading ? <AdminLoading label="Loading RFQ desk…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.rfqs.length ? <><RfqTable onOpen={setSelected} rfqs={data.rfqs} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="No B2B request matches the selected filters." />}</div>
    {selected ? <QuotePanel onClose={() => setSelected(null)} onQuoted={() => void load()} rfq={selected} /> : null}
  </>;
}

function RfqTable({ onOpen, rfqs }: { onOpen: (rfq: AdminRfq) => void; rfqs: AdminRfq[] }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[60rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">RFQ</th><th className="px-4 py-3 font-bold">Institution</th><th className="px-4 py-3 font-bold">Scope</th><th className="px-4 py-3 font-bold">Commercial state</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead><tbody className="divide-y divide-slate-800/80">{rfqs.map((rfq) => <tr className="hover:bg-slate-900/35" key={rfq.id}><td className="px-5 py-4"><p className="font-black text-sky-200">{rfq.rfq_code}</p><p className="mt-1 text-xs text-slate-500">Submitted {formatAdminDateTime(rfq.created_at)}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{rfq.customer_name}</p><p className="mt-1 text-xs text-slate-500">{rfq.customer_email}</p></td><td className="px-4 py-4"><p className="font-black text-white">{rfq.item_count} line{rfq.item_count === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-slate-500">Estimate: {rfq.total_estimated_value == null ? "Not available" : formatEgp(rfq.total_estimated_value)}</p></td><td className="px-4 py-4"><StatusPill value={rfq.status} /><p className="mt-2 text-xs text-slate-500">Valid until {formatAdminDate(rfq.validity_date)}</p></td><td className="px-5 py-4 text-right"><button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(rfq)} type="button">Open</button></td></tr>)}</tbody></table></div></div>;
}

function QuotePanel({ onClose, onQuoted, rfq }: { onClose: () => void; onQuoted: () => void; rfq: AdminRfq }) {
  const { notify, session } = useStore();
  const canQuote = ["submitted", "under_review", "quoted"].includes(rfq.status);
  const [validityDate, setValidityDate] = useState(() => {
    if (rfq.validity_date) return rfq.validity_date;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().slice(0, 10);
  });
  const [terms, setTerms] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issueQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const result = await issueAdminRfqQuote(rfq.rfq_code, { validity_date: validityDate, terms: terms.trim() || undefined }, session);
      notify(`${result.rfq_code} is now ${humanize(result.status)}.`);
      onQuoted();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not issue the quote.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 p-0 backdrop-blur-sm sm:p-4"><aside aria-label="RFQ details" className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-700 bg-[#091423] shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-[#091423]/95 px-5 py-4 backdrop-blur"><div><p className="section-kicker">Institutional request</p><h2 className="mt-1 text-lg font-black text-white">{rfq.rfq_code}</h2></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div><div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2"><Info label="Buyer" value={`${rfq.customer_name}\n${rfq.customer_email}`} /><Info label="Request scope" value={`${rfq.item_count} line${rfq.item_count === 1 ? "" : "s"}\nEstimated ${rfq.total_estimated_value == null ? "—" : formatEgp(rfq.total_estimated_value)}`} /></div>{rfq.notes ? <Info label="Buyer notes" value={rfq.notes} /> : null}<div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><StatusPill value={rfq.status} /><p className="mt-3 text-sm leading-6 text-slate-400">Quote issuance applies the current institutional pricelist or other server-side commercial rules; no price is manufactured by this UI.</p></div>{canQuote ? <form className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4" onSubmit={issueQuote}><p className="font-black text-cyan-100">Issue or revise quote</p><label className="mt-4 grid gap-2 text-sm font-bold text-slate-200"><span>Validity date</span><input className="form-input" min={new Date().toISOString().slice(0, 10)} onChange={(event) => setValidityDate(event.target.value)} required type="date" value={validityDate} /></label><label className="mt-4 grid gap-2 text-sm font-bold text-slate-200"><span>Commercial terms (optional)</span><textarea className="form-input min-h-24 resize-y" onChange={(event) => setTerms(event.target.value)} placeholder="Delivery, payment, and support terms" value={terms} /></label>{error ? <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-950/30 px-3 py-2 text-sm text-rose-100">{error}</p> : null}<button className="button-primary mt-4 text-sm disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Issuing…" : "Issue quote"}</button></form> : <p className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 text-sm leading-6 text-slate-400">This RFQ is not in a quoteable state. Its lifecycle is managed by the B2B workflow.</p>}</div></aside></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-200">{value}</p></div>;
}
