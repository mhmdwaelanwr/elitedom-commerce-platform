"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import { fetchAdminAccess } from "@/lib/admin-api";
import {
  fetchLaunchReadiness,
  updateLaunchGate,
  type AdminLaunchGate,
  type AdminLaunchReadinessResponse,
  type LaunchAcceptanceStatus,
} from "@/lib/admin-control-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminLaunchReadinessPage() {
  const { session } = useStore();
  const { locale } = usePreferences();
  const [data, setData] = useState<AdminLaunchReadinessResponse | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = locale === "ar" ? arabicCopy : englishCopy;

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [readiness, access] = await Promise.all([
        fetchLaunchReadiness(session),
        fetchAdminAccess(session),
      ]);
      setData(readiness);
      setCanManage(access.permissions.includes("config.manage"));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : copy.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AdminLaunchGate[]>();
    for (const gate of data?.gates ?? []) {
      const items = groups.get(gate.category) ?? [];
      items.push(gate);
      groups.set(gate.category, items);
    }
    return [...groups.entries()];
  }, [data]);

  async function saveGate(
    gate: AdminLaunchGate,
    status: LaunchAcceptanceStatus,
    evidenceRef: string,
    notes: string,
  ) {
    if (!session) return;
    setError(null);
    try {
      setData(
        await updateLaunchGate(
          gate.key,
          {
            status,
            evidence_ref: evidenceRef.trim() || null,
            notes: notes.trim() || null,
          },
          session,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : copy.saveError,
      );
      throw requestError;
    }
  }

  return (
    <>
      <AdminPageHeader
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />
      <div className="mt-7">
        {isLoading ? (
          <AdminLoading label={copy.loading} />
        ) : error && !data ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data ? (
          <div className="space-y-6">
            {error ? <AdminError error={error} onRetry={() => void load()} /> : null}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={copy.overall}
                value={localizeOverall(data.overall_status, locale)}
                tone={data.overall_status === "ready" ? "pass" : data.overall_status === "conditional" ? "warn" : "block"}
              />
              <SummaryCard label={copy.blockers} value={String(data.blocker_count)} tone={data.blocker_count ? "block" : "pass"} />
              <SummaryCard label={copy.warnings} value={String(data.warning_count)} tone={data.warning_count ? "warn" : "pass"} />
              <SummaryCard label={copy.generated} value={new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generated_at))} />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-base font-black text-foreground">{copy.releaseRule}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{copy.releaseRuleBody}</p>
              {!canManage ? (
                <p className="mt-3 rounded-xl border border-border bg-elevated/40 px-3 py-2 text-xs font-semibold text-muted">
                  {copy.readOnly}
                </p>
              ) : null}
            </section>

            {grouped.map(([category, gates]) => (
              <section className="space-y-3" key={category}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-muted">
                    {localizeCategory(category, locale)}
                  </h2>
                  <span className="text-xs font-bold text-muted">{gates.length} {copy.gates}</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {gates.map((gate) => (
                    <LaunchGateCard
                      canManage={canManage}
                      copy={copy}
                      gate={gate}
                      key={gate.key}
                      locale={locale}
                      onSave={saveGate}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function LaunchGateCard({
  canManage,
  copy,
  gate,
  locale,
  onSave,
}: {
  canManage: boolean;
  copy: typeof englishCopy;
  gate: AdminLaunchGate;
  locale: "en" | "ar";
  onSave: (
    gate: AdminLaunchGate,
    status: LaunchAcceptanceStatus,
    evidenceRef: string,
    notes: string,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<LaunchAcceptanceStatus>(
    gate.status === "automatic" ? "pending" : gate.status,
  );
  const [evidenceRef, setEvidenceRef] = useState(gate.evidence_ref ?? "");
  const [notes, setNotes] = useState(gate.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (gate.status !== "automatic") setStatus(gate.status);
    setEvidenceRef(gate.evidence_ref ?? "");
    setNotes(gate.notes ?? "");
  }, [gate.evidence_ref, gate.notes, gate.status]);

  const operatorGate = gate.source === "operator";

  async function save() {
    setSaving(true);
    try {
      await onSave(gate, status, evidenceRef, notes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-foreground">{localizeGateLabel(gate.key, gate.label, locale)}</h3>
            {gate.required ? <span className="rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 text-[10px] font-black text-danger">{copy.required}</span> : null}
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted">{gate.key}</p>
        </div>
        <ResultBadge result={gate.result} locale={locale} />
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">{localizeDetail(gate, locale)}</p>

      {operatorGate ? (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <label className="block text-xs font-black text-foreground">
            {copy.status}
            <select
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
              disabled={!canManage || saving}
              onChange={(event) => setStatus(event.target.value as LaunchAcceptanceStatus)}
              value={status}
            >
              <option value="pending">{copy.pending}</option>
              <option value="passed">{copy.passed}</option>
              <option value="failed">{copy.failed}</option>
              <option value="waived">{copy.waived}</option>
            </select>
          </label>
          <label className="block text-xs font-black text-foreground">
            {copy.evidence}
            <input
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
              disabled={!canManage || saving}
              maxLength={512}
              onChange={(event) => setEvidenceRef(event.target.value)}
              placeholder={copy.evidencePlaceholder}
              value={evidenceRef}
            />
          </label>
          <label className="block text-xs font-black text-foreground">
            {copy.notes}
            <textarea
              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
              disabled={!canManage || saving}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={copy.notesPlaceholder}
              value={notes}
            />
          </label>
          {gate.verified_at ? (
            <p className="text-[11px] font-semibold text-muted">
              {copy.lastVerified}: {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(gate.verified_at))}
              {gate.verified_by ? ` · #${gate.verified_by}` : ""}
            </p>
          ) : null}
          {canManage ? (
            <button className="button-primary w-full sm:w-auto" disabled={saving} onClick={() => void save()} type="button">
              {saving ? copy.saving : copy.save}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-elevated/30 px-3 py-2 text-xs font-semibold text-muted">
          {copy.automatic}
        </p>
      )}
    </article>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "pass" | "warn" | "block" }) {
  const toneClass = tone === "pass" ? "text-success" : tone === "warn" ? "text-warning" : tone === "block" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 break-words text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function ResultBadge({ result, locale }: { result: "pass" | "warn" | "block"; locale: "en" | "ar" }) {
  const label = locale === "ar" ? ({ pass: "ناجح", warn: "تحذير", block: "حاجب" } as const)[result] : ({ pass: "Pass", warn: "Warning", block: "Blocker" } as const)[result];
  const className = result === "pass" ? "border-success/30 bg-success/10 text-success" : result === "warn" ? "border-warning/30 bg-warning/10 text-warning" : "border-danger/30 bg-danger/10 text-danger";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</span>;
}

function localizeOverall(status: AdminLaunchReadinessResponse["overall_status"], locale: "en" | "ar") {
  if (locale === "ar") return ({ ready: "جاهز للإطلاق", conditional: "جاهزية مشروطة", blocked: "الإطلاق محجوب" } as const)[status];
  return ({ ready: "Ready to launch", conditional: "Conditional readiness", blocked: "Launch blocked" } as const)[status];
}

function localizeCategory(category: string, locale: "en" | "ar") {
  if (locale !== "ar") return category;
  return ({ deployment: "النشر", security: "الأمان", observability: "المراقبة", providers: "مزودو الخدمات", communications: "الاتصالات", performance: "الأداء", experience: "تجربة المستخدم", operations: "العمليات" } as Record<string, string>)[category] ?? category;
}

function localizeGateLabel(key: string, fallback: string, locale: "en" | "ar") {
  if (locale !== "ar") return fallback;
  return arabicGateLabels[key] ?? fallback;
}

function localizeDetail(gate: AdminLaunchGate, locale: "en" | "ar") {
  if (locale !== "ar") return gate.detail;
  if (gate.source === "operator") {
    if (gate.status === "passed") return "تم تسجيل قبول المشغل مع مرجع دليل داعم.";
    if (gate.status === "waived") return "تم استثناء هذا الشرط ويجب مراجعته قبل الموافقة النهائية على الإطلاق.";
    if (gate.status === "failed") return "فشل آخر اختبار قبول لهذا الشرط.";
    return "لم يكتمل اختبار القبول التشغيلي لهذا الشرط بعد.";
  }
  return gate.result === "pass" ? "تم التحقق من هذا الشرط تلقائيًا من إعدادات التشغيل." : gate.result === "warn" ? "هذا الشرط لا يمنع الإطلاق لكنه يحتاج مراجعة تشغيلية." : "إعدادات التشغيل الحالية لا تحقق هذا الشرط الإلزامي.";
}

const englishCopy = {
  eyebrow: "Release operations",
  title: "Launch readiness",
  description: "A fail-closed release gate that combines deployment configuration with audited operator acceptance evidence.",
  loading: "Checking launch readiness…",
  loadError: "Unable to load launch readiness.",
  saveError: "Unable to save launch acceptance evidence.",
  overall: "Overall status",
  blockers: "Blockers",
  warnings: "Warnings",
  generated: "Generated",
  releaseRule: "Release rule",
  releaseRuleBody: "Do not promote a release while any blocker remains. Warnings require an explicit release-owner decision and operator gates must carry evidence before they can pass.",
  readOnly: "You have read-only configuration access. A staff member with config.manage permission must record launch sign-offs.",
  gates: "gates",
  required: "Required",
  status: "Acceptance status",
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  waived: "Waived",
  evidence: "Evidence reference",
  evidencePlaceholder: "Run URL, ticket, report, or runbook reference",
  notes: "Operator notes",
  notesPlaceholder: "What was tested, result, exception, or rollback detail",
  lastVerified: "Last verified",
  save: "Save acceptance",
  saving: "Saving…",
  automatic: "Automatic gate — derived from safe runtime configuration only.",
} as const;

const arabicCopy: typeof englishCopy = {
  eyebrow: "عمليات الإصدار",
  title: "جاهزية الإطلاق",
  description: "بوابة إطلاق صارمة تجمع بين إعدادات التشغيل وأدلة قبول تشغيلية مدققة.",
  loading: "جارٍ فحص جاهزية الإطلاق…",
  loadError: "تعذر تحميل جاهزية الإطلاق.",
  saveError: "تعذر حفظ دليل قبول الإطلاق.",
  overall: "الحالة العامة",
  blockers: "العوائق",
  warnings: "التحذيرات",
  generated: "وقت الفحص",
  releaseRule: "قاعدة الإطلاق",
  releaseRuleBody: "لا يتم ترقية أي إصدار مع وجود عائق. التحذيرات تحتاج قرارًا صريحًا من مسؤول الإصدار، وشروط القبول التشغيلية لا تنجح بدون دليل.",
  readOnly: "لديك صلاحية قراءة الإعدادات فقط. تسجيل اعتماد الإطلاق يحتاج صلاحية config.manage.",
  gates: "شروط",
  required: "إلزامي",
  status: "حالة القبول",
  pending: "معلق",
  passed: "ناجح",
  failed: "فاشل",
  waived: "مستثنى",
  evidence: "مرجع الدليل",
  evidencePlaceholder: "رابط تشغيل أو تذكرة أو تقرير أو مرجع Runbook",
  notes: "ملاحظات المشغل",
  notesPlaceholder: "ما الذي تم اختباره والنتيجة والاستثناء أو تفاصيل التراجع",
  lastVerified: "آخر تحقق",
  save: "حفظ الاعتماد",
  saving: "جارٍ الحفظ…",
  automatic: "شرط تلقائي — مشتق فقط من إعدادات التشغيل الآمنة.",
};

const arabicGateLabels: Record<string, string> = {
  production_environment: "اختيار بيئة الإنتاج",
  debug_disabled: "إيقاف وضع التصحيح",
  staff_mfa: "فرض التحقق متعدد العوامل للموظفين",
  distributed_rate_limit: "تفعيل تحديد المعدل الموزع",
  metrics_protected: "حماية الوصول إلى المقاييس",
  allowed_hosts_scoped: "تقييد المضيفين المسموحين",
  cors_https_scoped: "تقييد CORS إلى HTTPS",
  integration_paymob: "جاهزية إعداد Paymob",
  integration_google_oauth: "جاهزية Google Sign-In",
  integration_apple_oauth: "جاهزية Apple Sign-In",
  integration_twilio: "جاهزية Twilio OTP",
  integration_odoo: "جاهزية Odoo 17",
  integration_email: "جاهزية البريد التشغيلي",
  media_delivery: "إعداد Object Storage وCDN",
  otel_export: "إعداد تصدير التتبع الموزع",
  uat_english: "اختبار قبول الواجهة الإنجليزية",
  uat_arabic_rtl: "اختبار قبول العربية وRTL",
  responsive_accessibility: "اختبار الاستجابة وإتاحة الوصول",
  paymob_live_flow: "قبول الدفع وWebhook والاسترداد عبر Paymob",
  google_oauth_live: "قبول Google Sign-In الفعلي",
  apple_oauth_live: "قبول Apple Sign-In الفعلي",
  twilio_otp_live: "قبول OTP الفعلي عبر الهاتف",
  odoo_round_trip: "قبول دورة الطلب والمخزون مع Odoo",
  fulfillment_refund: "اختبار التنفيذ والتسليم والمرتجع والاسترداد",
  backup_restore: "اختبار النسخ الاحتياطي والاستعادة لـPostgreSQL",
  monitoring_alerts: "التحقق من المقاييس والسجلات والتتبع والتنبيهات",
  rollback_drill: "اختبار التراجع عن الإصدار",
};
