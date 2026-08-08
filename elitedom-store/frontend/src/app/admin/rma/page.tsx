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
  fetchAdminRmas,
  reviewAdminRma,
  type AdminRma,
} from "@/lib/admin-api";
import { formatAdminDateTime, humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const statusOptions = ["", "pending_review", "approved", "rejected", "completed"];

export default function AdminRmaPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const copy = locale === "ar" ? AR_COPY : EN_COPY;
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
      setError(requestError instanceof Error ? requestError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [allowed, copy.loadError, page, query, session, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!allowed) return <AdminSectionDenied section="warranty claims" />;

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
        ) : data?.claims.length ? (
          <>
            <RmaTable copy={copy} claims={data.claims} onOpen={setSelected} />
            <AdminPagination onChange={setPage} page={data.page} pageSize={data.limit} total={data.total_count} />
          </>
        ) : (
          <AdminEmpty detail={copy.empty} />
        )}
      </div>

      {selected ? (
        <RmaReviewPanel
          copy={copy}
          claim={selected}
          onClose={() => setSelected(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </>
  );
}

function RmaTable({
  copy,
  claims,
  onOpen,
}: {
  copy: RmaCopy;
  claims: AdminRma[];
  onOpen: (claim: AdminRma) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] text-start text-sm">
          <thead className="bg-elevated/70 text-[10px] uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-5 py-3 text-start font-black">{copy.ticket}</th>
              <th className="px-4 py-3 text-start font-black">{copy.customerOrder}</th>
              <th className="px-4 py-3 text-start font-black">{copy.product}</th>
              <th className="px-4 py-3 text-start font-black">{copy.status}</th>
              <th className="px-5 py-3 text-end font-black">{copy.review}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {claims.map((claim) => (
              <tr className="transition hover:bg-elevated/40" key={claim.ticket_number}>
                <td className="px-5 py-4">
                  <p className="font-black text-primary">{claim.ticket_number}</p>
                  <p className="mt-1 text-xs text-muted">{formatAdminDateTime(claim.created_at)}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{claim.customer_name}</p>
                  <p className="mt-1 text-xs text-muted">{claim.order_number} · {claim.customer_email}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{claim.product_name}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{claim.sku}{claim.serial_number ? ` · ${claim.serial_number}` : ""}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusPill value={claim.status} />
                  <p className="mt-2 max-w-xs truncate text-xs text-muted">{claim.resolution_notes ?? copy.noResolution}</p>
                </td>
                <td className="px-5 py-4 text-end">
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => onOpen(claim)} type="button">{copy.review}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RmaReviewPanel({
  copy,
  claim,
  onClose,
  onSaved,
}: {
  copy: RmaCopy;
  claim: AdminRma;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify, session } = useStore();
  const availableDecision = claim.status === "pending_review"
    ? (["approved", "rejected"] as const)
    : claim.status === "approved"
      ? (["completed"] as const)
      : [];
  const [decision, setDecision] = useState<(typeof availableDecision)[number] | "">(availableDecision[0] ?? "");
  const [notes, setNotes] = useState(claim.resolution_notes ?? "");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !decision) return;
    if (decision === "rejected" && !notes.trim()) {
      setError(copy.rejectionNeedsNotes);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await reviewAdminRma(
        claim.ticket_number,
        { status: decision, resolution_notes: notes.trim() || undefined },
        session,
      );
      notify(`${claim.ticket_number} · ${humanize(decision)}`);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-overlay">
      <button aria-label={copy.close} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside aria-label={copy.reviewPanel} className="relative z-10 h-full w-full max-w-2xl overflow-y-auto border-s border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-kicker">{copy.reviewPanel}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">{claim.ticket_number}</h2>
          </div>
          <button className="button-secondary px-3 py-2 text-xs" onClick={onClose} type="button">{copy.close}</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label={copy.customer} value={`${claim.customer_name}\n${claim.customer_email}\n${claim.order_number}`} />
            <Info label={copy.product} value={`${claim.product_name}\n${claim.sku}${claim.serial_number ? `\n${claim.serial_number}` : ""}`} />
          </div>
          <Info label={copy.customerReport} value={claim.reason} />

          {claim.evidence_media_url ? (
            <a className="button-secondary inline-flex" href={claim.evidence_media_url} rel="noreferrer" target="_blank">
              <EvidenceIcon />
              {copy.openEvidence}
            </a>
          ) : (
            <p className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm text-warning">{copy.noEvidence}</p>
          )}

          {availableDecision.length ? (
            <form className="rounded-xl border border-primary/20 bg-primary/5 p-4" onSubmit={save}>
              <p className="font-black text-foreground">{copy.workflowDecision}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.workflowDescription}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {availableDecision.map((option) => (
                  <label
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold transition ${decision === option ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground"}`}
                    key={option}
                  >
                    <input checked={decision === option} className="sr-only" onChange={() => setDecision(option)} type="radio" value={option} />
                    {humanize(option)}
                  </label>
                ))}
              </div>

              <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground">
                <span>{copy.resolutionNotes} {decision === "rejected" ? copy.required : copy.optional}</span>
                <textarea className="form-input min-h-24 resize-y" onChange={(event) => setNotes(event.target.value)} value={notes} />
              </label>

              {error ? <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}

              <button className="button-primary mt-4 text-sm disabled:opacity-60" disabled={isSaving} type="submit">
                {isSaving ? copy.saving : `${copy.mark} ${humanize(decision)}`}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-border bg-elevated/45 p-4">
              <StatusPill value={claim.status} />
              <p className="mt-3 text-sm leading-6 text-muted">{copy.terminalState}</p>
              {claim.resolution_notes ? <p className="mt-3 text-sm text-foreground">{claim.resolution_notes}</p> : null}
            </div>
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
  eyebrow: "Customer support",
  title: "Warranty desk",
  description: "Review warranty evidence and move claims through the guarded RMA workflow. Every decision is stored with the staff member who made it.",
  searchPlaceholder: "Search ticket, order, customer, or email",
  allStates: "All claim states",
  search: "Search",
  loading: "Loading warranty desk…",
  loadError: "Unable to load warranty claims.",
  empty: "No RMA ticket matches the selected filters.",
  ticket: "Ticket",
  customerOrder: "Customer & order",
  product: "Product",
  status: "Status",
  review: "Review",
  noResolution: "No resolution recorded",
  reviewPanel: "RMA review",
  close: "Close",
  customer: "Customer",
  customerReport: "Customer report",
  openEvidence: "Open submitted evidence",
  noEvidence: "No evidence URL is recorded for this legacy claim.",
  workflowDecision: "Workflow decision",
  workflowDescription: "The next valid states are determined from the current RMA state and validated again by the API.",
  resolutionNotes: "Resolution notes",
  required: "(required)",
  optional: "(optional)",
  rejectionNeedsNotes: "A rejection requires clear resolution notes.",
  saveError: "Could not save the RMA review.",
  saving: "Saving…",
  mark: "Mark",
  terminalState: "This claim is in a terminal state and cannot be moved further by the RMA state machine.",
} as const;

type RmaCopy = { [K in keyof typeof EN_COPY]: string };

const AR_COPY: RmaCopy = {
  eyebrow: "دعم العملاء",
  title: "إدارة الضمان",
  description: "راجع أدلة الضمان وانقل الطلبات عبر مسار RMA المحكوم. يتم تسجيل كل قرار مع الموظف الذي اتخذه.",
  searchPlaceholder: "ابحث بالتذكرة أو الطلب أو العميل أو البريد",
  allStates: "كل حالات المطالبات",
  search: "بحث",
  loading: "جارٍ تحميل مطالبات الضمان…",
  loadError: "تعذر تحميل مطالبات الضمان.",
  empty: "لا توجد تذكرة RMA مطابقة للفلاتر.",
  ticket: "التذكرة",
  customerOrder: "العميل والطلب",
  product: "المنتج",
  status: "الحالة",
  review: "مراجعة",
  noResolution: "لا يوجد قرار مسجل",
  reviewPanel: "مراجعة RMA",
  close: "إغلاق",
  customer: "العميل",
  customerReport: "بلاغ العميل",
  openEvidence: "فتح الدليل المرفق",
  noEvidence: "لا يوجد رابط دليل مسجل لهذه المطالبة القديمة.",
  workflowDecision: "قرار مسار العمل",
  workflowDescription: "يتم تحديد الحالات التالية المسموح بها من الحالة الحالية، ويعيد الـAPI التحقق منها قبل الحفظ.",
  resolutionNotes: "ملاحظات القرار",
  required: "(مطلوبة)",
  optional: "(اختيارية)",
  rejectionNeedsNotes: "يتطلب الرفض ملاحظات واضحة للقرار.",
  saveError: "تعذر حفظ مراجعة RMA.",
  saving: "جارٍ الحفظ…",
  mark: "تعيين",
  terminalState: "هذه المطالبة في حالة نهائية ولا يمكن نقلها لحالة أخرى بواسطة مسار RMA.",
};

function SearchIcon() {
  return <svg aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}

function EvidenceIcon() {
  return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M8 12.5 12.5 8a3 3 0 0 1 4.2 4.2l-5.6 5.6a5 5 0 0 1-7.1-7.1l6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
