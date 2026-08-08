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
  fetchAdminCustomer,
  fetchAdminCustomers,
  type AdminCustomer,
  type AdminCustomerDetail,
} from "@/lib/admin-api";
import { formatAdminDate, formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminCustomersPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
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
      setData(
        await fetchAdminCustomers(session, {
          page,
          q: query || undefined,
          active: active === "all" ? undefined : active === "active",
        }),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [active, allowed, copy.loadError, page, query, session]);

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
      setDetailError(requestError instanceof Error ? requestError.message : copy.detailError);
    } finally {
      setDetailLoading(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(qDraft.trim());
  }

  if (!allowed) return <AdminSectionDenied section="customer records" />;

  return (
    <>
      <AdminPageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <form
        className="mt-5 grid gap-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_11rem_auto]"
        onSubmit={submitSearch}
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
            setActive(event.target.value as typeof active);
          }}
          value={active}
        >
          <option value="all">{copy.allAccounts}</option>
          <option value="active">{copy.activeAccounts}</option>
          <option value="inactive">{copy.inactiveAccounts}</option>
        </select>
        <button className="button-primary px-4 py-2 text-sm" type="submit">{copy.search}</button>
      </form>

      <div className="mt-4">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data?.customers.length ? (
          <>
            <CustomerTable copy={copy} customers={data.customers} onOpen={(customer) => void openCustomer(customer)} />
            <AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} />
          </>
        ) : (
          <AdminEmpty detail={copy.noCustomers} />
        )}
      </div>

      {selected || detailLoading || detailError ? (
        <CustomerInspector
          copy={copy}
          customer={selected}
          error={detailError}
          isLoading={detailLoading}
          onClose={() => {
            setSelected(null);
            setDetailError(null);
          }}
        />
      ) : null}
    </>
  );
}

function CustomerTable({
  copy,
  customers,
  onOpen,
}: {
  copy: CustomerCopy;
  customers: AdminCustomer[];
  onOpen: (customer: AdminCustomer) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] text-start text-sm">
          <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 text-start font-black">{copy.customer}</th>
              <th className="px-4 py-3 text-start font-black">{copy.account}</th>
              <th className="px-4 py-3 text-start font-black">{copy.orders}</th>
              <th className="px-4 py-3 text-start font-black">{copy.lifetimeValue}</th>
              <th className="px-5 py-3 text-end font-black">{copy.details}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr className="transition hover:bg-elevated/40" key={customer.id}>
                <td className="px-5 py-4">
                  <p className="font-bold text-foreground">{customer.name}</p>
                  <p className="mt-1 text-xs text-muted">{customer.email}</p>
                  <p className="mt-1 text-xs text-muted">{customer.phone}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusPill value={customer.is_active ? "active" : "inactive"} />
                  <p className="mt-2 text-xs text-muted">
                    {customer.email_verified ? copy.emailVerified : copy.emailUnverified}
                  </p>
                  <p className="mt-1 text-xs text-muted">{customer.governorate ?? copy.noGovernorate}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-xl font-black text-foreground">{customer.order_count}</p>
                  <p className="mt-1 text-xs text-muted">{copy.since} {formatAdminDate(customer.created_at)}</p>
                </td>
                <td className="px-4 py-4 font-black text-foreground">{formatEgp(customer.lifetime_value)}</td>
                <td className="px-5 py-4 text-end">
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(customer)} type="button">{copy.open}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerInspector({
  copy,
  customer,
  error,
  isLoading,
  onClose,
}: {
  copy: CustomerCopy;
  customer: AdminCustomerDetail | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-overlay">
      <button aria-label={copy.close} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside aria-label={copy.customerDetails} className="relative z-10 h-full w-full max-w-lg overflow-y-auto border-s border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-kicker">{copy.customerRecord}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">{customer?.name ?? copy.loadingCustomer}</h2>
          </div>
          <button className="button-secondary px-3 py-2 text-xs" onClick={onClose} type="button">{copy.close}</button>
        </div>

        {isLoading ? (
          <div className="p-5"><AdminLoading label={copy.loadingDetails} /></div>
        ) : error ? (
          <div className="p-5"><AdminError error={error} /></div>
        ) : customer ? (
          <div className="space-y-3 p-5">
            <DetailCard label={copy.contact} value={`${customer.email}\n${customer.phone}`} />
            <DetailCard
              label={copy.account}
              value={`${humanize(customer.role)} · ${customer.is_active ? copy.active : copy.inactive}\n${customer.email_verified ? copy.emailVerified : copy.emailNotVerified}`}
            />
            <DetailCard
              label={copy.commercialHistory}
              value={`${customer.order_count} ${copy.recordedOrders}\n${formatEgp(customer.lifetime_value)} ${copy.lifetimeValueLower}\n${copy.lastOrder}: ${formatAdminDateTime(customer.last_order_at)}`}
            />
            <DetailCard
              label={copy.profileAddress}
              value={[customer.street_address, customer.governorate].filter(Boolean).join("\n") || copy.noAddress}
            />
            <p className="rounded-lg border border-border bg-elevated/55 p-3 text-xs leading-5 text-muted">
              {copy.privacyNote}
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated/45 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-foreground">{value}</p>
    </div>
  );
}

const EN_COPY = {
  eyebrow: "Customer operations",
  title: "Customers",
  description: "Review purchaser records and their recorded order history. Passwords, payment credentials, and device tokens are never exposed through this console.",
  searchPlaceholder: "Search name, email, or mobile",
  allAccounts: "All accounts",
  activeAccounts: "Active accounts",
  inactiveAccounts: "Inactive accounts",
  search: "Search",
  loading: "Loading customer records…",
  loadError: "Unable to load customers.",
  detailError: "Unable to load customer details.",
  noCustomers: "No customer record matches your search.",
  customer: "Customer",
  account: "Account",
  orders: "Orders",
  lifetimeValue: "Lifetime value",
  details: "Details",
  emailVerified: "Email verified",
  emailUnverified: "Email unverified",
  noGovernorate: "No governorate set",
  since: "Since",
  open: "Open",
  close: "Close",
  customerDetails: "Customer details",
  customerRecord: "Customer record",
  loadingCustomer: "Loading customer",
  loadingDetails: "Loading customer details…",
  contact: "Contact",
  active: "Active",
  inactive: "Inactive",
  emailNotVerified: "Email not verified",
  commercialHistory: "Commercial history",
  recordedOrders: "recorded orders",
  lifetimeValueLower: "lifetime value",
  lastOrder: "Last order",
  profileAddress: "Address on profile",
  noAddress: "No profile address recorded",
  privacyNote: "This panel intentionally excludes authentication secrets, password data, card information, and device tokens.",
} as const;

type CustomerCopy = { [K in keyof typeof EN_COPY]: string };

const AR_COPY: CustomerCopy = {
  eyebrow: "عمليات العملاء",
  title: "العملاء",
  description: "راجع سجلات المشترين وتاريخ طلباتهم المسجل. لا يتم عرض كلمات المرور أو بيانات الدفع أو رموز الأجهزة من خلال لوحة الإدارة.",
  searchPlaceholder: "ابحث بالاسم أو البريد أو الهاتف",
  allAccounts: "كل الحسابات",
  activeAccounts: "الحسابات النشطة",
  inactiveAccounts: "الحسابات غير النشطة",
  search: "بحث",
  loading: "جارٍ تحميل سجلات العملاء…",
  loadError: "تعذر تحميل العملاء.",
  detailError: "تعذر تحميل تفاصيل العميل.",
  noCustomers: "لا يوجد سجل عميل مطابق للبحث.",
  customer: "العميل",
  account: "الحساب",
  orders: "الطلبات",
  lifetimeValue: "القيمة الإجمالية",
  details: "التفاصيل",
  emailVerified: "البريد موثّق",
  emailUnverified: "البريد غير موثّق",
  noGovernorate: "لم تُحدد محافظة",
  since: "منذ",
  open: "فتح",
  close: "إغلاق",
  customerDetails: "تفاصيل العميل",
  customerRecord: "سجل العميل",
  loadingCustomer: "جارٍ تحميل العميل",
  loadingDetails: "جارٍ تحميل تفاصيل العميل…",
  contact: "التواصل",
  active: "نشط",
  inactive: "غير نشط",
  emailNotVerified: "البريد غير موثّق",
  commercialHistory: "السجل التجاري",
  recordedOrders: "طلبات مسجلة",
  lifetimeValueLower: "قيمة إجمالية",
  lastOrder: "آخر طلب",
  profileAddress: "العنوان المسجل",
  noAddress: "لا يوجد عنوان مسجل",
  privacyNote: "هذه اللوحة لا تعرض عمدًا أسرار المصادقة أو كلمات المرور أو بيانات البطاقات أو رموز الأجهزة.",
};

function SearchIcon() {
  return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
