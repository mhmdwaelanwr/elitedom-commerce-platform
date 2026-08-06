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
  dispatchAdminOrder,
  fetchAdminShipments,
  type AdminShipment,
} from "@/lib/admin-api";
import { formatAdminDateTime, humanize } from "@/lib/admin-ui";

const stateOptions = ["", "draft", "waiting", "confirmed", "assigned", "done"];

export default function AdminShipmentsPage() {
  const { session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "shipments");
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminShipments>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isDispatchOpen, setDispatchOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminShipments(session, { page, q: query || undefined, state: state || undefined }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load fulfilment records.");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, query, session, state]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!allowed) return <AdminSectionDenied section="fulfilment" />;

  return <>
    <AdminPageHeader actions={<button className="button-primary px-4 py-2.5 text-sm" onClick={() => setDispatchOpen(true)} type="button">Dispatch an order</button>} description="Track persisted warehouse pickings and dispatch an eligible order with a real carrier reference. The fulfilment service validates order state and serial assignments." eyebrow="Warehouse operations" title="Fulfilment" />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_11rem_auto]" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPage(1); setQuery(qDraft.trim()); }}><input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search picking reference, order, customer, or tracking" value={qDraft} /><select className="form-input" onChange={(event) => { setPage(1); setState(event.target.value); }} value={state}>{stateOptions.map((option) => <option key={option} value={option}>{option ? humanize(option) : "All picking states"}</option>)}</select><button className="button-primary px-4 py-2 text-sm" type="submit">Search</button></form>
    <div className="mt-5">{isLoading ? <AdminLoading label="Loading fulfilment records…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.shipments.length ? <><ShipmentTable shipments={data.shipments} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="No stock picking has been recorded for these filters. Confirmed orders without a delivery picking can be dispatched from the button above." />}</div>
    {isDispatchOpen ? <DispatchDialog onClose={() => setDispatchOpen(false)} onDispatched={() => void load()} /> : null}
  </>;
}

function ShipmentTable({ shipments }: { shipments: AdminShipment[] }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[60rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Picking</th><th className="px-4 py-3 font-bold">Order & customer</th><th className="px-4 py-3 font-bold">Carrier reference</th><th className="px-4 py-3 font-bold">Fulfilment state</th><th className="px-5 py-3 text-right font-bold">Timing</th></tr></thead><tbody className="divide-y divide-slate-800/80">{shipments.map((shipment) => <tr className="hover:bg-slate-900/35" key={shipment.id}><td className="px-5 py-4"><p className="font-black text-sky-200">{shipment.picking_reference}</p><p className="mt-1 text-xs text-slate-500">{humanize(shipment.picking_type)}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{shipment.order_number ?? "No sale order"}</p><p className="mt-1 text-xs text-slate-500">{shipment.customer_name ?? "No customer record"}</p>{shipment.order_state ? <div className="mt-2"><StatusPill value={shipment.order_state} /></div> : null}</td><td className="px-4 py-4"><p className="font-mono text-xs font-bold text-slate-200">{shipment.tracking_number ?? "Not assigned"}</p><p className="mt-1 text-xs text-slate-500">Supplier ref: {shipment.supplier_po_ref ?? "—"}</p></td><td className="px-4 py-4"><StatusPill value={shipment.state} /></td><td className="px-5 py-4 text-right text-xs text-slate-500"><p>Scheduled {formatAdminDateTime(shipment.scheduled_date)}</p><p className="mt-1">Completed {formatAdminDateTime(shipment.completed_date)}</p></td></tr>)}</tbody></table></div></div>;
}

function DispatchDialog({ onClose, onDispatched }: { onClose: () => void; onDispatched: () => void }) {
  const { notify, session } = useStore();
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [reference, setReference] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const parsedOrderId = Number(orderId);
    if (!Number.isSafeInteger(parsedOrderId) || parsedOrderId < 1) {
      setError("Enter a valid numeric order ID.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await dispatchAdminOrder(parsedOrderId, { tracking_number: trackingNumber, reference: reference.trim() || undefined }, session);
      notify(`${result.order_number} dispatched with ${result.tracking_number}.`);
      onDispatched();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not dispatch the order.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"><section aria-modal="true" className="w-full max-w-lg rounded-3xl border border-slate-700 bg-[#091423] p-6 shadow-2xl" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Warehouse dispatch</p><h2 className="mt-2 text-xl font-black text-white">Record carrier handoff</h2><p className="mt-2 text-sm leading-6 text-slate-400">Only an eligible sale or vetted COD order can be dispatched. Serial-tracked lines must already have valid stock lots.</p></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div><form className="mt-6 grid gap-4" onSubmit={dispatch}><label className="grid gap-2 text-sm font-bold text-slate-200"><span>Order ID</span><input className="form-input" inputMode="numeric" min="1" onChange={(event) => setOrderId(event.target.value)} required type="number" value={orderId} /></label><label className="grid gap-2 text-sm font-bold text-slate-200"><span>Carrier tracking number</span><input className="form-input" minLength={3} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Example: EG-CARRIER-123" required value={trackingNumber} /></label><label className="grid gap-2 text-sm font-bold text-slate-200"><span>Picking reference (optional)</span><input className="form-input" minLength={3} onChange={(event) => setReference(event.target.value)} placeholder="Example: DO-SO-2026-001" value={reference} /></label>{error ? <p className="rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</p> : null}<div className="mt-1 flex justify-end gap-3"><button className="button-secondary text-sm" disabled={isSaving} onClick={onClose} type="button">Cancel</button><button className="button-primary text-sm disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Dispatching…" : "Record dispatch"}</button></div></form></section></div>;
}
