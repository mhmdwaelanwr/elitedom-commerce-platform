"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import {
  fetchControlIntegrations,
  type AdminIntegrationStatusResponse,
} from "@/lib/admin-control-api";
import { humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminIntegrationsPage() {
  const { session } = useStore();
  const { t } = usePreferences();
  const [data, setData] = useState<AdminIntegrationStatusResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchControlIntegrations(session));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load integration readiness.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <AdminPageHeader
        description={t("admin", "integrationsDescription")}
        eyebrow={t("admin", "operations")}
        title={t("admin", "integrationsTitle")}
      />
      <div className="mt-7">
        {isLoading ? (
          <AdminLoading label={t("admin", "loadingAdminData")} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : data ? (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RuntimeFact label={t("admin", "environment")} value={humanize(data.runtime.environment)} />
              <RuntimeFact label="Version" value={data.runtime.app_version} />
              <RuntimeFact label="Metrics" value={data.runtime.metrics_enabled ? t("admin", "enabled") : t("admin", "disabled")} />
              <RuntimeFact label="Debug" value={data.runtime.debug ? t("admin", "enabled") : t("admin", "disabled")} />
              <RuntimeFact label="Allowed hosts" value={String(data.runtime.allowed_host_count)} />
              <RuntimeFact label="CORS origins" value={String(data.runtime.cors_origin_count)} />
              <RuntimeFact label="Trusted proxies" value={String(data.runtime.trusted_proxy_count)} />
              <RuntimeFact label="Media path" value={data.runtime.media_public_path} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {data.integrations.map((integration) => (
                <article className="rounded-2xl border border-border bg-surface p-5" key={integration.key}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-black text-foreground">{integration.label}</h2>
                      <p className="mt-1 font-mono text-[10px] text-muted">{integration.key}</p>
                    </div>
                    <StatusPill value={integration.status} />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {integration.checks.map((check) => (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/30 px-3 py-2.5" key={check.key}>
                        <span className="text-xs font-semibold text-muted">{check.label}</span>
                        <span className={`text-xs font-black ${check.configured ? "text-success" : "text-danger"}`}>
                          {check.configured ? t("admin", "configured") : t("admin", "missing")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold text-muted">
                    {t("admin", "status")}: {integration.status === "ready" ? t("admin", "ready") : integration.status === "disabled" ? t("admin", "disabled") : t("admin", "incomplete")}
                  </p>
                </article>
              ))}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-foreground">{value}</p>
    </div>
  );
}
