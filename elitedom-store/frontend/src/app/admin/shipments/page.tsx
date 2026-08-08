"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
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
import { usePreferences } from "@/providers/AppPreferencesProvider";

const stateOptions = ["", "draft", "waiting", "confirmed", "assigned", "done"];

export default function AdminShipmentsPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
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
      setError(requestError instanceof Error ? requestError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [allowed, copy.loadError, page, query, session, state]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!allowed) return <AdminSectionDenied section="fulfilment" />;

  return (
    <>
      <AdminPageHeader
        actions={
          <button className="button-primary px-4 py-2.5 text-sm" onClick={() => setDispatchOpen(true)} type="button">
            <TruckIcon />
            {copy.dispatchOrder}
          </button>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <form
        className="mt-5 grid gap-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_11rem_auto]"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setPage(1);
          setQuery(qDraft.trim());
        }}
      >
        <div className="relative">
          <SearchIcon />
          <input
            className="form-input ps-9"
            onChange={(event) => setQDraft(event.target.value)}
            placeholder={copy.searchPlaceholder}
            value={qDraft}
          />
        </div>
        <select
          className="form-input"
          onChange={(event) => {
            setPage(1);
            setState(event.target.value);
          }}
          value={state}
        >
          {stateOptions.map((option) => (
            <option key={option} value={option}>
              {option ? humanize(option) : copy.allStates}
            </option>
          ))}
        </select>
        <button className="button-primary px-4 py-2 text-sm" type="submit">{copy.search}</button>
      </form>

      <div className="mt-4">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data?.shipments.length ? (
          <>
            <ShipmentTable copy={copy} shipments={data.shipments} />
            <AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} />
          </>
        ) : (
          <AdminEmpty detail={copy.empty} />
        )}
      </div>

      {isDispatchOpen ? (
        <DispatchDialog copy={copy} onClose={() => setDispatchOpen(false)} onDispatched={() => void load()} />
      ) : null}
    </>
  );
}

function ShipmentTable({ copy, shipments }: { copy: ShipmentCopy; shipments: AdminShipment[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-start text-sm">
          <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 text-start font-black">{copy.picking}</th>
              <th className="px-4 py-3 text-start font-black">{copy.orderCustomer}</th>
              <th className="px-4 py-3 text-start font-black">{copy.carrierReference}</th>
              <th className="px-4 py-3 text-start font-black">{copy.fulfilmentState}</th>
              <th className="px-5 py-3 text-end font-black">{copy.timing}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shipments.map((shipment) => (
              <tr className="transition hover:bg-elevated/40" key={shipment.id}>
                <td className="px-5 py-4">
                  <p className="font-black text-primary">{shipment.picking_reference}</p>
                  <p className="mt-1 text-xs text-muted">{humanize(shipment.picking_type)}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{shipment.order_number ?? copy.noSaleOrder}</p>
                  <p className="mt-1 text-xs text-muted">{shipment.customer_name ?? copy.noCustomer}</p>
                  {shipment.order_state ? <div className="mt-2"><StatusPill value={shipment.order_state} /></div> : null}
                </td>
                <td className="px-4 py-4">
                  <p className="font-mono text-xs font-bold text-foreground">{shipment.tracking_number ?? copy.notAssigned}</p>
                  <p className="mt-1 text-xs text-muted">{copy.supplierRef}: {shipment.supplier_po_ref ?? "—"}</p>
                </td>
                <td className="px-4 py-4"><StatusPill value={shipment.state} /></td>
                <td className="px-5 py-4 text-end text-xs text-muted">
                  <p>{copy.scheduled} {formatAdminDateTime(shipment.scheduled_date)}</p>
                  <p className="mt-1">{copy.completed} {formatAdminDateTime(shipment.completed_date)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispatchDialog({
  copy,
  onClose,
  onDispatched,
}: {
  copy: ShipmentCopy;
  onClose: () => void;
  onDispatched: () => void;
}) {
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
      setError(copy.invalidOrderId);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await dispatchAdminOrder(
        parsedOrderId,
        {
          tracking_number: trackingNumber,
          reference: reference.trim() || undefined,
        },
        session,
      );
      notify(`${result.order_number} · ${result.tracking_number}`);
      onDispatched();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.dispatchError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-overlay p-4">
      <button aria-label={copy.close} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section aria-modal="true" className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="section-kicker">{copy.dispatchEyebrow}</p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-foreground">{copy.dispatchTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.dispatchDescription}</p>
          </div>
          <button className="button-secondary shrink-0 px-3 py-2 text-xs" onClick={onClose} type="button">{copy.close}</button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={dispatch}>
          <Field label={copy.orderId}>
            <input className="form-input" inputMode="numeric" min="1" onChange={(event) => setOrderId(event.target.value)} required type="number" value={orderId} />
          </Field>
          <Field label={copy.trackingNumber}>
            <input className="form-input" minLength={3} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="EG-CARRIER-123" required value={trackingNumber} />
          </Field>
          <Field label={copy.pickingReference}>
            <input className="form-input" minLength={3} onChange={(event) => setReference(event.target.value)} placeholder="DO-SO-2026-001" value={reference} />
          </Field>

          {error ? <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

          <div className="mt-1 flex justify-end gap-2 border-t border-border pt-4">
            <button className="button-secondary text-sm" disabled={isSaving} onClick={onClose} type="button">{copy.cancel}</button>
            <button className="button-primary text-sm disabled:opacity-60" disabled={isSaving} type="submit">
              <TruckIcon />
              {isSaving ? copy.dispatching : copy.recordDispatch}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>;
}

const EN_COPY = {
  eyebrow: "Warehouse operations",
  title: "Fulfilment",
  description: "Track persisted warehouse pickings and dispatch an eligible order with a real carrier reference. The fulfilment service validates order state and serial assignments.",
  dispatchOrder: "Dispatch an order",
  searchPlaceholder: "Search picking, order, customer, or tracking",
  allStates: "All picking states",
  search: "Search",
  loading: "Loading fulfilment records…",
  loadError: "Unable to load fulfilment records.",
  empty: "No stock picking has been recorded for these filters. Confirmed orders without a delivery picking can be dispatched from the button above.",
  picking: "Picking",
  orderCustomer: "Order & customer",
  carrierReference: "Carrier reference",
  fulfilmentState: "Fulfilment state",
  timing: "Timing",
  noSaleOrder: "No sale order",
  noCustomer: "No customer record",
  notAssigned: "Not assigned",
  supplierRef: "Supplier ref",
  scheduled: "Scheduled",
  completed: "Completed",
  close: "Close",
  dispatchEyebrow: "Warehouse dispatch",
  dispatchTitle: "Record carrier handoff",
  dispatchDescription: "Only an eligible sale or vetted COD order can be dispatched. Serial-tracked lines must already have valid stock lots.",
  orderId: "Order ID",
  trackingNumber: "Carrier tracking number",
  pickingReference: "Picking reference (optional)",
  invalidOrderId: "Enter a valid numeric order ID.",
  dispatchError: "Could not dispatch the order.",
  cancel: "Cancel",
  dispatching: "Dispatching…",
  recordDispatch: "Record dispatch",
} as const;

type ShipmentCopy = { [K in keyof typeof EN_COPY]: string };

const AR_COPY: ShipmentCopy = {
  eyebrow: "عمليات المخزن",
  title: "التنفيذ والشحن",
  description: "تابع عمليات التجهيز المسجلة وسجّل تسليم الطلب المؤهل لشركة الشحن بمرجع حقيقي. تتحقق خدمة التنفيذ من حالة الطلب والأرقام التسلسلية.",
  dispatchOrder: "تسجيل شحن طلب",
  searchPlaceholder: "ابحث بمرجع التجهيز أو الطلب أو العميل أو التتبع",
  allStates: "كل حالات التجهيز",
  search: "بحث",
  loading: "جارٍ تحميل سجلات التنفيذ…",
  loadError: "تعذر تحميل سجلات التنفيذ.",
  empty: "لا توجد عمليات تجهيز مطابقة لهذه الفلاتر. يمكن شحن الطلبات المؤكدة التي لا تحتوي على عملية تسليم من الزر أعلاه.",
  picking: "التجهيز",
  orderCustomer: "الطلب والعميل",
  carrierReference: "مرجع شركة الشحن",
  fulfilmentState: "حالة التنفيذ",
  timing: "التوقيت",
  noSaleOrder: "لا يوجد طلب بيع",
  noCustomer: "لا يوجد سجل عميل",
  notAssigned: "غير معيّن",
  supplierRef: "مرجع المورد",
  scheduled: "المجدول",
  completed: "المكتمل",
  close: "إغلاق",
  dispatchEyebrow: "شحن المخزن",
  dispatchTitle: "تسجيل تسليم لشركة الشحن",
  dispatchDescription: "يمكن شحن طلب بيع مؤهل أو طلب دفع عند الاستلام تم التحقق منه فقط. يجب أن تحتوي المنتجات ذات التتبع التسلسلي على سجلات مخزون صالحة.",
  orderId: "رقم الطلب",
  trackingNumber: "رقم تتبع شركة الشحن",
  pickingReference: "مرجع التجهيز (اختياري)",
  invalidOrderId: "أدخل رقم طلب رقميًا صالحًا.",
  dispatchError: "تعذر تسجيل شحن الطلب.",
  cancel: "إلغاء",
  dispatching: "جارٍ تسجيل الشحن…",
  recordDispatch: "تسجيل الشحن",
};

function SearchIcon() {
  return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function TruckIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
