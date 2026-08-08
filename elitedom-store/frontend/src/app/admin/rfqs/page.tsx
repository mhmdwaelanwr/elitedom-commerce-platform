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
  fetchAdminRfqs,
  issueAdminRfqQuote,
  type AdminRfq,
} from "@/lib/admin-api";
import { formatAdminDate, formatAdminDateTime, formatEgp, humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const statusOptions = ["", "submitted", "under_review", "quoted", "accepted", "declined"];

export default function AdminRfqsPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
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
      setError(requestError instanceof Error ? requestError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [allowed, copy.loadError, page, query, session, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!allowed) return <AdminSectionDenied section="B2B RFQs" />;

  return (
    <>
      <AdminPageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <form
        className="mt-5 grid gap-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_12rem_auto]"
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
            setStatus(event.target.value);
          }}
          value={status}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>{option ? humanize(option) : copy.allStates}</option>
          ))}
        </select>
        <button className="button-primary px-4 py-2 text-sm" type="submit">{copy.search}</button>
      </form>

      <div className="mt-4">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data?.rfqs.length ? (
          <>
            <RfqTable copy={copy} onOpen={setSelected} rfqs={data.rfqs} />
            <AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} />
          </>
        ) : (
          <AdminEmpty detail={copy.empty} />
        )}
      </div>

      {selected ? (
        <QuotePanel
          copy={copy}
          onClose={() => setSelected(null)}
          onQuoted={() => void load()}
          rfq={selected}
        />
      ) : null}
    </>
  );
}

function RfqTable({
  copy,
  onOpen,
  rfqs,
}: {
  copy: RfqCopy;
  onOpen: (rfq: AdminRfq) => void;
  rfqs: AdminRfq[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-start text-sm">
          <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 text-start font-black">{copy.rfq}</th>
              <th className="px-4 py-3 text-start font-black">{copy.institution}</th>
              <th className="px-4 py-3 text-start font-black">{copy.scope}</th>
              <th className="px-4 py-3 text-start font-black">{copy.commercialState}</th>
              <th className="px-5 py-3 text-end font-black">{copy.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rfqs.map((rfq) => (
              <tr className="transition hover:bg-elevated/40" key={rfq.id}>
                <td className="px-5 py-4">
                  <p className="font-black text-primary">{rfq.rfq_code}</p>
                  <p className="mt-1 text-xs text-muted">{copy.submitted} {formatAdminDateTime(rfq.created_at)}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{rfq.customer_name}</p>
                  <p className="mt-1 text-xs text-muted">{rfq.customer_email}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-black text-foreground">{rfq.item_count} {rfq.item_count === 1 ? copy.line : copy.lines}</p>
                  <p className="mt-1 text-xs text-muted">
                    {copy.estimate}: {rfq.total_estimated_value == null ? copy.notAvailable : formatEgp(rfq.total_estimated_value)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <StatusPill value={rfq.status} />
                  <p className="mt-2 text-xs text-muted">{copy.validUntil} {formatAdminDate(rfq.validity_date)}</p>
                </td>
                <td className="px-5 py-4 text-end">
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(rfq)} type="button">{copy.open}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotePanel({
  copy,
  onClose,
  onQuoted,
  rfq,
}: {
  copy: RfqCopy;
  onClose: () => void;
  onQuoted: () => void;
  rfq: AdminRfq;
}) {
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
      const result = await issueAdminRfqQuote(
        rfq.rfq_code,
        { validity_date: validityDate, terms: terms.trim() || undefined },
        session,
      );
      notify(`${result.rfq_code} · ${humanize(result.status)}`);
      onQuoted();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.quoteError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-overlay">
      <button aria-label={copy.close} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside aria-label={copy.details} className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-s border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-kicker">{copy.institutionalRequest}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">{rfq.rfq_code}</h2>
          </div>
          <button className="button-secondary px-3 py-2 text-xs" onClick={onClose} type="button">{copy.close}</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label={copy.buyer} value={`${rfq.customer_name}\n${rfq.customer_email}`} />
            <Info
              label={copy.requestScope}
              value={`${rfq.item_count} ${rfq.item_count === 1 ? copy.line : copy.lines}\n${copy.estimated} ${rfq.total_estimated_value == null ? "—" : formatEgp(rfq.total_estimated_value)}`}
            />
          </div>

          {rfq.notes ? <Info label={copy.buyerNotes} value={rfq.notes} /> : null}

          <div className="rounded-xl border border-border bg-elevated/45 p-4">
            <StatusPill value={rfq.status} />
            <p className="mt-3 text-sm leading-6 text-muted">{copy.pricingNote}</p>
          </div>

          {canQuote ? (
            <form className="rounded-xl border border-primary/20 bg-primary/5 p-4" onSubmit={issueQuote}>
              <p className="font-black text-foreground">{copy.issueQuote}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.issueQuoteDescription}</p>

              <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground">
                <span>{copy.validityDate}</span>
                <input
                  className="form-input"
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setValidityDate(event.target.value)}
                  required
                  type="date"
                  value={validityDate}
                />
              </label>

              <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground">
                <span>{copy.commercialTerms}</span>
                <textarea
                  className="form-input min-h-24 resize-y"
                  onChange={(event) => setTerms(event.target.value)}
                  placeholder={copy.termsPlaceholder}
                  value={terms}
                />
              </label>

              {error ? <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}

              <button className="button-primary mt-4 text-sm disabled:opacity-60" disabled={isSaving} type="submit">
                <QuoteIcon />
                {isSaving ? copy.issuing : copy.issue}
              </button>
            </form>
          ) : (
            <p className="rounded-xl border border-border bg-elevated/45 p-4 text-sm leading-6 text-muted">{copy.notQuoteable}</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated/45 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-foreground">{value}</p>
    </div>
  );
}

const EN_COPY = {
  eyebrow: "B2B commercial desk",
  title: "Request for quotation",
  description: "Review institutional demand and issue an auditable quote using the B2B pricing service. Product quantities and price rules remain validated server-side.",
  searchPlaceholder: "Search RFQ code, company contact, or email",
  allStates: "All RFQ states",
  search: "Search",
  loading: "Loading RFQ desk…",
  loadError: "Unable to load B2B RFQs.",
  empty: "No B2B request matches the selected filters.",
  rfq: "RFQ",
  institution: "Institution",
  scope: "Scope",
  commercialState: "Commercial state",
  action: "Action",
  submitted: "Submitted",
  line: "line",
  lines: "lines",
  estimate: "Estimate",
  estimated: "Estimated",
  notAvailable: "Not available",
  validUntil: "Valid until",
  open: "Open",
  close: "Close",
  details: "RFQ details",
  institutionalRequest: "Institutional request",
  buyer: "Buyer",
  requestScope: "Request scope",
  buyerNotes: "Buyer notes",
  pricingNote: "Quote issuance applies the current institutional pricelist and server-side commercial rules; this UI never manufactures a price.",
  issueQuote: "Issue or revise quote",
  issueQuoteDescription: "Set validity and optional delivery/payment/support terms. Pricing is calculated by the server-side B2B service.",
  validityDate: "Validity date",
  commercialTerms: "Commercial terms (optional)",
  termsPlaceholder: "Delivery, payment, and support terms",
  quoteError: "Could not issue the quote.",
  issuing: "Issuing…",
  issue: "Issue quote",
  notQuoteable: "This RFQ is not in a quoteable state. Its lifecycle is managed by the B2B workflow.",
} as const;

type RfqCopy = { [K in keyof typeof EN_COPY]: string };

const AR_COPY: RfqCopy = {
  eyebrow: "إدارة المبيعات B2B",
  title: "طلبات عروض الأسعار",
  description: "راجع طلبات المؤسسات وأصدر عرض سعر قابلًا للتدقيق باستخدام خدمة تسعير B2B. تظل الكميات وقواعد الأسعار متحققة على الخادم.",
  searchPlaceholder: "ابحث بكود RFQ أو جهة الاتصال أو البريد",
  allStates: "كل حالات RFQ",
  search: "بحث",
  loading: "جارٍ تحميل طلبات عروض الأسعار…",
  loadError: "تعذر تحميل طلبات B2B.",
  empty: "لا توجد طلبات B2B مطابقة للفلاتر.",
  rfq: "RFQ",
  institution: "المؤسسة",
  scope: "نطاق الطلب",
  commercialState: "الحالة التجارية",
  action: "الإجراء",
  submitted: "تم الإرسال",
  line: "بند",
  lines: "بنود",
  estimate: "التقدير",
  estimated: "تقديري",
  notAvailable: "غير متاح",
  validUntil: "صالح حتى",
  open: "فتح",
  close: "إغلاق",
  details: "تفاصيل RFQ",
  institutionalRequest: "طلب مؤسسة",
  buyer: "المشتري",
  requestScope: "نطاق الطلب",
  buyerNotes: "ملاحظات المشتري",
  pricingNote: "إصدار عرض السعر يطبق قائمة أسعار المؤسسات الحالية وقواعد التجارة على الخادم؛ الواجهة لا تنشئ سعرًا من نفسها.",
  issueQuote: "إصدار أو تعديل عرض السعر",
  issueQuoteDescription: "حدد مدة الصلاحية وشروط التسليم أو الدفع أو الدعم الاختيارية. يتم حساب السعر بواسطة خدمة B2B على الخادم.",
  validityDate: "تاريخ الصلاحية",
  commercialTerms: "الشروط التجارية (اختياري)",
  termsPlaceholder: "شروط التسليم والدفع والدعم",
  quoteError: "تعذر إصدار عرض السعر.",
  issuing: "جارٍ الإصدار…",
  issue: "إصدار عرض السعر",
  notQuoteable: "طلب RFQ الحالي ليس في حالة تسمح بإصدار عرض. تتم إدارة دورة حياته بواسطة مسار B2B.",
};

function SearchIcon() {
  return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function QuoteIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M5 5h14v10H9l-4 4V5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M9 9h.01M15 9h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>;
}
