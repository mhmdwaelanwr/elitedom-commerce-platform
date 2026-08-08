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
  fetchAdminOrder,
  fetchAdminOrders,
  updateAdminOrderState,
  type AdminOrder,
  type AdminOrderDetail,
} from "@/lib/admin-api";
import { formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const stateOptions = ["", "draft", "sent", "sale", "done", "cancel"];
const paymentOptions = ["", "pending", "paid", "failed", "refunded"];

export default function AdminOrdersPage() {
  const { notify, session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
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
      setData(
        await fetchAdminOrders(session, {
          page,
          q: query || undefined,
          state: state || undefined,
          payment_status: paymentStatus || undefined,
        }),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [allowed, copy.loadError, page, paymentStatus, query, session, state]);

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
      setDetailError(requestError instanceof Error ? requestError.message : copy.detailLoadError);
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
      notify(`${updated.order_number} · ${humanize(updated.state)}`);
      await load();
    } catch (requestError) {
      notify(requestError instanceof Error ? requestError.message : copy.transitionError, "error");
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

  return (
    <>
      <AdminPageHeader description={copy.description} eyebrow={copy.eyebrow} title={copy.title} />

      <form className="mt-5 grid gap-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" onSubmit={applySearch}>
        <div className="relative">
          <SearchIcon />
          <input className="form-input ps-9" onChange={(event) => setQDraft(event.target.value)} placeholder={copy.searchPlaceholder} value={qDraft} />
        </div>
        <select className="form-input" onChange={(event) => { setPage(1); setState(event.target.value); }} value={state}>
          {stateOptions.map((option) => <option key={option} value={option}>{option ? humanize(option) : copy.allStates}</option>)}
        </select>
        <select className="form-input" onChange={(event) => { setPage(1); setPaymentStatus(event.target.value); }} value={paymentStatus}>
          {paymentOptions.map((option) => <option key={option} value={option}>{option ? `${copy.payment}: ${humanize(option)}` : copy.allPayments}</option>)}
        </select>
        <button className="button-primary px-4 py-2 text-sm" type="submit">{copy.search}</button>
      </form>

      <div className="mt-4">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data?.orders.length ? (
          <>
            <OrderTable copy={copy} orders={data.orders} onOpen={(order) => void openOrder(order.id)} />
            <AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} />
          </>
        ) : (
          <AdminEmpty detail={copy.noOrdersDetail} title={copy.noOrdersTitle} />
        )}
      </div>

      {selected || isDetailLoading || detailError ? (
        <OrderInspector
          canManageStates={canManageStates}
          copy={copy}
          detail={selected}
          error={detailError}
          isLoading={isDetailLoading}
          isTransitioning={isTransitioning}
          onClose={() => { setSelected(null); setDetailError(null); }}
          onTransition={(target) => void transitionOrder(target)}
        />
      ) : null}
    </>
  );
}

function OrderTable({ copy, orders, onOpen }: { copy: OrderCopy; orders: AdminOrder[]; onOpen: (order: AdminOrder) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] text-start text-sm">
          <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 text-start font-black">{copy.order}</th>
              <th className="px-4 py-3 text-start font-black">{copy.customer}</th>
              <th className="px-4 py-3 text-start font-black">{copy.payment}</th>
              <th className="px-4 py-3 text-start font-black">{copy.fulfilment}</th>
              <th className="px-5 py-3 text-end font-black">{copy.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr className="cursor-pointer transition hover:bg-elevated/40" key={order.id} onClick={() => onOpen(order)}>
                <td className="px-5 py-4">
                  <button className="focus-ring rounded-md font-black text-primary hover:brightness-110" onClick={(event) => { event.stopPropagation(); onOpen(order); }} type="button">{order.order_number}</button>
                  <p className="mt-1 text-xs text-muted">{formatAdminDateTime(order.created_at)}</p>
                </td>
                <td className="px-4 py-4"><p className="font-semibold text-foreground">{order.customer_name}</p><p className="mt-1 text-xs text-muted">{order.customer_email}</p></td>
                <td className="px-4 py-4"><p className="text-xs font-semibold text-foreground">{humanize(order.payment_method)}</p><div className="mt-2"><StatusPill value={order.payment_status} /></div></td>
                <td className="px-4 py-4"><StatusPill value={order.state} /><p className="mt-2 text-xs text-muted">{order.shipping_governorate ?? "Egypt"}{order.is_dropship ? ` · ${copy.dropship}` : ""}</p></td>
                <td className="px-5 py-4 text-end font-black text-foreground">{formatEgp(order.amount_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderInspector({
  canManageStates,
  copy,
  detail,
  error,
  isLoading,
  isTransitioning,
  onClose,
  onTransition,
}: {
  canManageStates: boolean;
  copy: OrderCopy;
  detail: AdminOrderDetail | null;
  error: string | null;
  isLoading: boolean;
  isTransitioning: boolean;
  onClose: () => void;
  onTransition: (state: string) => void;
}) {
  const transitionTargets: Record<string, string[]> = {
    draft: ["sent", "sale", "cancel"],
    sent: ["sale", "cancel"],
    sale: ["done", "cancel"],
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-overlay">
      <button aria-label={copy.close} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside aria-label={copy.inspector} className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-s border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div><p className="section-kicker">{copy.inspector}</p><h2 className="mt-1 text-lg font-black tracking-tight text-foreground">{detail?.order_number ?? copy.loadingOrder}</h2></div>
          <button aria-label={copy.close} className="button-secondary px-3 py-2 text-xs" onClick={onClose} type="button">{copy.close}</button>
        </div>

        {isLoading ? (
          <div className="p-5"><AdminLoading label={copy.loadingDetails} /></div>
        ) : error ? (
          <div className="p-5"><AdminError error={error} /></div>
        ) : detail ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label={copy.customer} value={`${detail.customer_name}\n${detail.customer_email}\n${detail.customer_phone}`} />
              <Info label={copy.delivery} value={`${detail.shipping_address}\n${detail.shipping_governorate ?? "Egypt"}`} />
              <Info label={copy.payment} value={`${humanize(detail.payment_method)} · ${humanize(detail.payment_status)}`} />
              <Info label={copy.orderTotal} value={formatEgp(detail.amount_total)} />
            </div>

            <section className="overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-elevated/55 px-4 py-3"><h3 className="font-black text-foreground">{copy.items}</h3></div>
              <div className="divide-y divide-border">
                {detail.order_lines.map((line) => (
                  <div className="flex items-start justify-between gap-4 p-4" key={line.id}>
                    <div className="min-w-0"><p className="font-bold text-foreground">{line.product_name}</p><p className="mt-1 font-mono text-xs text-muted">{line.sku} · {line.quantity} {copy.units}</p></div>
                    <p className="shrink-0 font-black text-foreground">{formatEgp(line.line_total)}</p>
                  </div>
                ))}
              </div>
            </section>

            {detail.notes ? <Info label={copy.customerNote} value={detail.notes} /> : null}

            {canManageStates && transitionTargets[detail.state]?.length ? (
              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="font-black text-foreground">{copy.workflowTransition}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{copy.workflowDescription}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {transitionTargets[detail.state].map((nextState) => (
                    <button className="button-secondary px-3 py-2 text-xs" disabled={isTransitioning} key={nextState} onClick={() => onTransition(nextState)} type="button">
                      {copy.mark} {humanize(nextState)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-elevated/45 p-3.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-foreground">{value}</p></div>;
}

const EN_COPY = {
  eyebrow: "Commerce operations",
  title: "Order desk",
  description: "Search, inspect, and progress recorded customer orders. State transitions are validated by the order workflow before they are saved.",
  searchPlaceholder: "Search order number, customer name, or email",
  allStates: "All states",
  allPayments: "All payments",
  payment: "Payment",
  search: "Search",
  loading: "Loading order desk…",
  loadError: "Unable to load orders.",
  detailLoadError: "Unable to load the order.",
  transitionError: "Could not update order state.",
  noOrdersTitle: "No orders match these filters",
  noOrdersDetail: "Try a different search or clear the state filters.",
  order: "Order",
  customer: "Customer",
  fulfilment: "Fulfilment",
  total: "Total",
  dropship: "Dropship",
  inspector: "Order inspector",
  loadingOrder: "Loading order",
  close: "Close",
  loadingDetails: "Loading order details…",
  delivery: "Delivery",
  orderTotal: "Order total",
  items: "Items",
  units: "units",
  customerNote: "Customer note",
  workflowTransition: "Workflow transition",
  workflowDescription: "Only valid next states are available. The API validates this again before committing.",
  mark: "Mark",
} as const;

type OrderCopy = { [K in keyof typeof EN_COPY]: string };

const AR_COPY: OrderCopy = {
  eyebrow: "عمليات التجارة",
  title: "إدارة الطلبات",
  description: "ابحث في طلبات العملاء وافحصها وتابع حالتها. يتم التحقق من انتقالات الحالة داخل مسار الطلب قبل حفظها.",
  searchPlaceholder: "ابحث برقم الطلب أو اسم العميل أو البريد الإلكتروني",
  allStates: "كل الحالات",
  allPayments: "كل حالات الدفع",
  payment: "الدفع",
  search: "بحث",
  loading: "جارٍ تحميل الطلبات…",
  loadError: "تعذر تحميل الطلبات.",
  detailLoadError: "تعذر تحميل تفاصيل الطلب.",
  transitionError: "تعذر تحديث حالة الطلب.",
  noOrdersTitle: "لا توجد طلبات مطابقة",
  noOrdersDetail: "جرّب بحثًا آخر أو امسح فلاتر الحالة.",
  order: "الطلب",
  customer: "العميل",
  fulfilment: "التنفيذ",
  total: "الإجمالي",
  dropship: "دروبشيب",
  inspector: "تفاصيل الطلب",
  loadingOrder: "جارٍ تحميل الطلب",
  close: "إغلاق",
  loadingDetails: "جارٍ تحميل تفاصيل الطلب…",
  delivery: "التوصيل",
  orderTotal: "إجمالي الطلب",
  items: "المنتجات",
  units: "وحدات",
  customerNote: "ملاحظة العميل",
  workflowTransition: "تغيير حالة الطلب",
  workflowDescription: "تظهر الحالات التالية المسموح بها فقط، ويعيد الـAPI التحقق منها قبل الحفظ.",
  mark: "تعيين",
};

function SearchIcon() { return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
