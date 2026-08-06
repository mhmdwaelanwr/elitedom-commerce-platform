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
  fetchAdminOrder,
  fetchAdminOrders,
  updateAdminOrderState,
  type AdminOrder,
  type AdminOrderDetail,
} from "@/lib/admin-api";
import { formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";

const stateOptions = ["", "draft", "sent", "sale", "done", "cancel"];
const paymentOptions = ["", "pending", "paid", "failed", "refunded"];

export default function AdminOrdersPage() {
  const { notify, session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "orders");
  const canManageStates = session?.role === "system_admin" || session?.role === "warehouse_operator";
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminOrders>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const [isTransitioning, setTransitioning] = useState(false);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminOrders(session, { page, q: query || undefined, state: state || undefined, payment_status: paymentStatus || undefined }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, paymentStatus, query, session, state]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openOrder(orderId: number) {
    if (!session) return;
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelected(await fetchAdminOrder(orderId, session));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "Unable to load the order.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function transitionOrder(target: string) {
    if (!session || !selected) return;
    setTransitioning(true);
    try {
      const updated = await updateAdminOrderState(selected.id, target, session);
      setSelected(updated);
      notify(`${updated.order_number} is now ${humanize(updated.state)}.`);
      await load();
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : "Could not update order state.", "error");
    } finally {
      setTransitioning(false);
    }
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(qDraft.trim());
  }

  if (!allowed) return <AdminSectionDenied section="orders" />;

  return <>
    <AdminPageHeader
      description="Search, inspect, and progress recorded customer orders. State transitions are validated by the order workflow before they are saved."
      eyebrow="Commerce operations"
      title="Order desk"
    />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" onSubmit={applySearch}>
      <input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search order number, customer name, or email" value={qDraft} />
      <select className="form-input" onChange={(event) => { setPage(1); setState(event.target.value); }} value={state}>{stateOptions.map((option) => <option key={option} value={option}>{option ? humanize(option) : "All states"}</option>)}</select>
      <select className="form-input" onChange={(event) => { setPage(1); setPaymentStatus(event.target.value); }} value={paymentStatus}>{paymentOptions.map((option) => <option key={option} value={option}>{option ? `Payment: ${humanize(option)}` : "All payments"}</option>)}</select>
      <button className="button-primary px-4 py-2 text-sm" type="submit">Search</button>
    </form>
    <div className="mt-5">
      {isLoading ? <AdminLoading label="Loading order desk…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.orders.length ? <><OrderTable orders={data.orders} onOpen={(order) => void openOrder(order.id)} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="Try a different search or clear the state filters." title="No orders match these filters" />}
    </div>
    {(selected || isDetailLoading || detailError) ? <OrderInspector canManageStates={canManageStates} detail={selected} error={detailError} isLoading={isDetailLoading} isTransitioning={isTransitioning} onClose={() => { setSelected(null); setDetailError(null); }} onTransition={(target) => void transitionOrder(target)} /> : null}
  </>;
}

function OrderTable({ orders, onOpen }: { orders: AdminOrder[]; onOpen: (order: AdminOrder) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[56rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Payment</th><th className="px-4 py-3 font-bold">Fulfilment</th><th className="px-5 py-3 text-right font-bold">Total</th></tr></thead><tbody className="divide-y divide-slate-800/80">{orders.map((order) => <tr className="cursor-pointer transition hover:bg-slate-900/55" key={order.id} onClick={() => onOpen(order)}><td className="px-5 py-4"><button className="font-black text-sky-200 hover:text-white focus-ring" onClick={(event) => { event.stopPropagation(); onOpen(order); }} type="button">{order.order_number}</button><p className="mt-1 text-xs text-slate-500">{formatAdminDateTime(order.created_at)}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-200">{order.customer_name}</p><p className="mt-1 text-xs text-slate-500">{order.customer_email}</p></td><td className="px-4 py-4"><p className="text-xs font-semibold text-slate-300">{humanize(order.payment_method)}</p><div className="mt-2"><StatusPill value={order.payment_status} /></div></td><td className="px-4 py-4"><StatusPill value={order.state} /><p className="mt-2 text-xs text-slate-500">{order.shipping_governorate ?? "Egypt"}{order.is_dropship ? " · Dropship" : ""}</p></td><td className="px-5 py-4 text-right font-black text-white">{formatEgp(order.amount_total)}</td></tr>)}</tbody></table></div></div>;
}

function OrderInspector({
  canManageStates,
  detail,
  error,
  isLoading,
  isTransitioning,
  onClose,
  onTransition,
}: {
  canManageStates: boolean;
  detail: AdminOrderDetail | null;
  error: string | null;
  isLoading: boolean;
  isTransitioning: boolean;
  onClose: () => void;
  onTransition: (state: string) => void;
}) {
  const transitionTargets: Record<string, string[]> = { draft: ["sent", "sale", "cancel"], sent: ["sale", "cancel"], sale: ["done", "cancel"] };
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 p-0 backdrop-blur-sm sm:p-4"><aside aria-label="Order details" className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-700 bg-[#091423] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#091423]/95 px-5 py-4 backdrop-blur"><div><p className="section-kicker">Order inspector</p><h2 className="mt-1 text-lg font-black text-white">{detail?.order_number ?? "Loading order"}</h2></div><button aria-label="Close order details" className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div>{isLoading ? <div className="p-5"><AdminLoading label="Loading order details…" /></div> : error ? <div className="p-5"><AdminError error={error} /></div> : detail ? <div className="space-y-6 p-5"><div className="grid gap-3 sm:grid-cols-2"><Info label="Customer" value={`${detail.customer_name}\n${detail.customer_email}\n${detail.customer_phone}`} /><Info label="Delivery" value={`${detail.shipping_address}\n${detail.shipping_governorate ?? "Egypt"}`} /><Info label="Payment" value={`${humanize(detail.payment_method)} · ${humanize(detail.payment_status)}`} /><Info label="Order total" value={formatEgp(detail.amount_total)} /></div><section className="overflow-hidden rounded-2xl border border-slate-800"><div className="border-b border-slate-800 px-4 py-3"><h3 className="font-black text-white">Items</h3></div><div className="divide-y divide-slate-800">{detail.order_lines.map((line) => <div className="flex items-start justify-between gap-4 p-4" key={line.id}><div><p className="font-bold text-slate-100">{line.product_name}</p><p className="mt-1 font-mono text-xs text-slate-500">{line.sku} · {line.quantity} unit{line.quantity === 1 ? "" : "s"}</p></div><p className="shrink-0 font-black text-white">{formatEgp(line.line_total)}</p></div>)}</div></section>{detail.notes ? <Info label="Customer note" value={detail.notes} /> : null}{canManageStates && transitionTargets[detail.state]?.length ? <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4"><p className="font-black text-cyan-100">Workflow transition</p><p className="mt-1 text-sm text-slate-400">Only valid next states are available. The API validates this again before committing.</p><div className="mt-4 flex flex-wrap gap-2">{transitionTargets[detail.state].map((state) => <button className="button-secondary px-3 py-2 text-xs" disabled={isTransitioning} key={state} onClick={() => onTransition(state)} type="button">Mark {humanize(state)}</button>)}</div></section> : null}</div> : null}</aside></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3.5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-200">{value}</p></div>;
}
