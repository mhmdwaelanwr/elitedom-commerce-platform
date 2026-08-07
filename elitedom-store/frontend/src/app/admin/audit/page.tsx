"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminSectionDenied,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import {
  canAccessAdminSection,
  fetchAdminAuditLogs,
  type AdminAuditLog,
} from "@/lib/admin-api";
import { formatAdminDateTime, humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminAuditPage() {
  const { session } = useStore();
  const { t } = usePreferences();
  const allowed = canAccessAdminSection(session?.role, "audit");
  const [page, setPage] = useState(1);
  const [actionDraft, setActionDraft] = useState("");
  const [entityDraft, setEntityDraft] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminAuditLogs>> | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminAuditLogs(session, {
        page,
        action: action || undefined,
        entity_type: entityType || undefined,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load audit records.");
    } finally {
      setLoading(false);
    }
  }, [action, allowed, entityType, page, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!allowed) return <AdminSectionDenied section="audit logs" />;

  return (
    <>
      <AdminPageHeader
        description={t("admin", "auditDescription")}
        eyebrow={t("admin", "operations")}
        title={t("admin", "auditTitle")}
      />
      <form
        className="mt-7 grid gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setPage(1);
          setAction(actionDraft.trim());
          setEntityType(entityDraft.trim());
        }}
      >
        <input
          className="form-input"
          onChange={(event) => setActionDraft(event.target.value)}
          placeholder="order.cancel / inventory.stock.adjust"
          value={actionDraft}
        />
        <input
          className="form-input"
          onChange={(event) => setEntityDraft(event.target.value)}
          placeholder="order / product / staff"
          value={entityDraft}
        />
        <button className="button-primary px-4 py-2 text-sm" type="submit">Filter</button>
      </form>

      <div className="mt-5">
        {isLoading ? (
          <AdminLoading label={t("admin", "loadingAdminData")} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data?.logs.length ? (
          <>
            <div className="space-y-3">
              {data.logs.map((log) => <AuditCard key={log.id} log={log} />)}
            </div>
            <AdminPagination
              onChange={setPage}
              page={data.page}
              pageSize={data.limit}
              total={data.total_count}
            />
          </>
        ) : (
          <AdminEmpty detail={t("admin", "noAuditEvents")} />
        )}
      </div>
    </>
  );
}

function AuditCard({ log }: { log: AdminAuditLog }) {
  const { t } = usePreferences();
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold text-primary">{log.action}</p>
          <h2 className="mt-1 text-base font-black text-foreground">
            {humanize(log.entity_type)}{log.entity_id ? ` #${log.entity_id}` : ""}
          </h2>
        </div>
        <time className="text-xs font-semibold text-muted" dateTime={log.created_at}>
          {formatAdminDateTime(log.created_at)}
        </time>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <AuditFact
          label={t("admin", "actor")}
          value={`${log.actor_partner_id ?? "system"} · ${humanize(log.actor_role)}`}
        />
        <AuditFact
          label={t("admin", "requestContext")}
          value={[log.request_method, log.request_path, log.ip_address].filter(Boolean).join(" · ") || "—"}
        />
        <AuditFact label={t("admin", "entity")} value={`${log.entity_type}${log.entity_id ? ` · ${log.entity_id}` : ""}`} />
      </dl>
      {(log.before_summary || log.after_summary) ? (
        <details className="mt-4 rounded-xl border border-border bg-elevated/40 p-3">
          <summary className="focus-ring cursor-pointer text-xs font-black text-foreground">
            {t("admin", "beforeAfter")}
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <AuditJson label="Before" value={log.before_summary} />
            <AuditJson label="After" value={log.after_summary} />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function AuditFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/30 p-3">
      <dt className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function AuditJson({ label, value }: { label: string; value?: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-[11px] leading-5 text-muted">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}
