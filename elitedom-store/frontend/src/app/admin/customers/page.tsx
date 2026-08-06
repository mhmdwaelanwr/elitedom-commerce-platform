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
  fetchAdminCustomer,
  fetchAdminCustomers,
  type AdminCustomer,
  type AdminCustomerDetail,
} from "@/lib/admin-api";
import { formatAdminDate, formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";

export default function AdminCustomersPage() {
  const { session } = useStore();
  const allowed = canAccessAdminSection(session?.role, "customers");
  const [qDraft, setQDraft] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminCustomers>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminCustomers(session, { page, q: query || undefined, active: active === "all" ? undefined : active === "active" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, [active, allowed, page, query, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openCustomer(customer: AdminCustomer) {
    if (!session) return;
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelected(await fetchAdminCustomer(customer.id, session));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "Unable to load customer details.");
    } finally {
      setDetailLoading(false);
    }
  }

  if (!allowed) return <AdminSectionDenied section="customer records" />;

  return <>
    <AdminPageHeader description="Review purchaser records and their recorded order history. Passwords, payment credentials, and device tokens are never exposed through this console." eyebrow="Customer operations" title="Customers" />
    <form className="mt-7 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:grid-cols-[minmax(0,1fr)_11rem_auto]" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPage(1); setQuery(qDraft.trim()); }}><input className="form-input" onChange={(event) => setQDraft(event.target.value)} placeholder="Search name, email, or mobile" value={qDraft} /><select className="form-input" onChange={(event) => { setPage(1); setActive(event.target.value as typeof active); }} value={active}><option value="all">All accounts</option><option value="active">Active accounts</option><option value="inactive">Inactive accounts</option></select><button className="button-primary px-4 py-2 text-sm" type="submit">Search</button></form>
    <div className="mt-5">{isLoading ? <AdminLoading label="Loading customer records…" /> : error ? <AdminError error={error} onRetry={() => void load()} /> : data?.customers.length ? <><CustomerTable customers={data.customers} onOpen={(customer) => void openCustomer(customer)} /><AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} /></> : <AdminEmpty detail="No customer record matches your search." />}</div>
    {(selected || detailLoading || detailError) ? <CustomerInspector customer={selected} error={detailError} isLoading={detailLoading} onClose={() => { setSelected(null); setDetailError(null); }} /> : null}
  </>;
}

function CustomerTable({ customers, onOpen }: { customers: AdminCustomer[]; onOpen: (customer: AdminCustomer) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/35"><div className="overflow-x-auto"><table className="w-full min-w-[54rem] text-left text-sm"><thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Account</th><th className="px-4 py-3 font-bold">Orders</th><th className="px-4 py-3 font-bold">Lifetime value</th><th className="px-5 py-3 text-right font-bold">Details</th></tr></thead><tbody className="divide-y divide-slate-800/80">{customers.map((customer) => <tr className="hover:bg-slate-900/35" key={customer.id}><td className="px-5 py-4"><p className="font-bold text-slate-100">{customer.name}</p><p className="mt-1 text-xs text-slate-500">{customer.email}</p><p className="mt-1 text-xs text-slate-600">{customer.phone}</p></td><td className="px-4 py-4"><StatusPill value={customer.is_active ? "active" : "inactive"} /><p className="mt-2 text-xs text-slate-500">{customer.email_verified ? "Email verified" : "Email unverified"}</p><p className="mt-1 text-xs text-slate-600">{customer.governorate ?? "No governorate set"}</p></td><td className="px-4 py-4"><p className="text-xl font-black text-white">{customer.order_count}</p><p className="mt-1 text-xs text-slate-500">Since {formatAdminDate(customer.created_at)}</p></td><td className="px-4 py-4 font-black text-white">{formatEgp(customer.lifetime_value)}</td><td className="px-5 py-4 text-right"><button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(customer)} type="button">Open</button></td></tr>)}</tbody></table></div></div>;
}

function CustomerInspector({
  customer,
  error,
  isLoading,
  onClose,
}: {
  customer: AdminCustomerDetail | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 p-0 backdrop-blur-sm sm:p-4"><aside aria-label="Customer details" className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-700 bg-[#091423] shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-[#091423]/95 px-5 py-4 backdrop-blur"><div><p className="section-kicker">Customer record</p><h2 className="mt-1 text-lg font-black text-white">{customer?.name ?? "Loading customer"}</h2></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 focus-ring" onClick={onClose} type="button">Close</button></div>{isLoading ? <div className="p-5"><AdminLoading label="Loading customer details…" /></div> : error ? <div className="p-5"><AdminError error={error} /></div> : customer ? <div className="space-y-4 p-5"><DetailCard label="Contact" value={`${customer.email}\n${customer.phone}`} /><DetailCard label="Account" value={`${humanize(customer.role)} · ${customer.is_active ? "Active" : "Inactive"}\n${customer.email_verified ? "Email verified" : "Email not verified"}`} /><DetailCard label="Commercial history" value={`${customer.order_count} recorded order${customer.order_count === 1 ? "" : "s"}\n${formatEgp(customer.lifetime_value)} lifetime value\nLast order: ${formatAdminDateTime(customer.last_order_at)}`} /><DetailCard label="Address on profile" value={[customer.street_address, customer.governorate].filter(Boolean).join("\n") || "No profile address recorded"} /><p className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs leading-5 text-slate-500">This panel intentionally excludes authentication secrets, password data, card information, and device tokens.</p></div> : null}</aside></div>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-200">{value}</p></div>;
}
