"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminSectionDenied,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import {
  canAccessAdminSection,
  fetchAdminPermissionCatalog,
  fetchAdminStaff,
  updateAdminStaffAccess,
  type AdminPermission,
  type AdminPermissionDefinition,
  type AdminPermissionOverride,
  type AdminStaffAccess,
} from "@/lib/admin-api";
import { humanize } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

const STAFF_ROLES = [
  "system_admin",
  "operations_manager",
  "finance_officer",
  "inventory_manager",
  "warehouse_operator",
  "customer_support",
  "content_catalog",
] as const;

type OverrideMode = "default" | "allow" | "deny";

export default function AdminStaffPage() {
  const { notify, session } = useStore();
  const { t } = usePreferences();
  const allowed = canAccessAdminSection(session?.role, "staff");
  const [staff, setStaff] = useState<AdminStaffAccess[]>([]);
  const [catalog, setCatalog] = useState<AdminPermissionDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [overrides, setOverrides] = useState<Record<string, OverrideMode>>({});
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const [staffResponse, permissionResponse] = await Promise.all([
        fetchAdminStaff(session),
        fetchAdminPermissionCatalog(session),
      ]);
      setStaff(staffResponse.staff);
      setCatalog(permissionResponse.permissions);
      setSelectedId((current) => current ?? staffResponse.staff[0]?.id ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load staff access.");
    } finally {
      setLoading(false);
    }
  }, [allowed, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = staff.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => {
      setRole(selected.role);
      setOverrides(
        Object.fromEntries(
          selected.overrides.map((item) => [item.permission, item.effect]),
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AdminPermissionDefinition[]>();
    for (const permission of catalog) {
      const current = groups.get(permission.area) ?? [];
      current.push(permission);
      groups.set(permission.area, current);
    }
    return [...groups.entries()];
  }, [catalog]);

  async function save() {
    if (!session || !selected || !role || isSaving) return;
    const confirmed = window.confirm(
      `${t("admin", "saveAccess")} — ${selected.name}?`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const payload: AdminPermissionOverride[] = Object.entries(overrides)
        .filter(([, effect]) => effect !== "default")
        .map(([permission, effect]) => ({
          permission: permission as AdminPermission,
          effect: effect as "allow" | "deny",
        }));
      const updated = await updateAdminStaffAccess(
        selected.id,
        { role, overrides: payload },
        session,
      );
      setStaff((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      notify(t("admin", "accessSaved"), "success");
    } catch (requestError) {
      notify(
        requestError instanceof Error ? requestError.message : "Unable to save staff access.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <AdminSectionDenied section={t("admin", "staffAccess")} />;

  return (
    <>
      <AdminPageHeader
        description={t("admin", "staffAccessDescription")}
        eyebrow={t("admin", "operations")}
        title={t("admin", "staffAccessTitle")}
      />
      <div className="mt-7">
        {isLoading ? (
          <AdminLoading label={t("admin", "loadingAdminData")} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : staff.length === 0 ? (
          <AdminEmpty detail={t("admin", "noStaff")} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="border-b border-border px-4 py-3 text-xs font-black uppercase tracking-wider text-muted">
                {t("admin", "staffAccess")}
              </div>
              <div className="divide-y divide-border">
                {staff.map((item) => (
                  <button
                    className={`focus-ring block w-full px-4 py-4 text-start transition ${selectedId === item.id ? "bg-primary/10" : "hover:bg-elevated"}`}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-muted">{item.email}</p>
                      </div>
                      <StatusPill value={item.is_active ? "active" : "inactive"} />
                    </div>
                    <p className="mt-3 text-xs font-bold text-primary">{humanize(item.role)}</p>
                  </button>
                ))}
              </div>
            </aside>

            {selected ? (
              <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                  <div>
                    <p className="text-lg font-black text-foreground">{selected.name}</p>
                    <p className="mt-1 text-sm text-muted">{selected.email}</p>
                    <p className="mt-2 text-xs text-muted">
                      {selected.permissions.length} {t("admin", "activePermissions")}
                    </p>
                  </div>
                  <label className="min-w-56 text-xs font-bold text-muted">
                    {t("admin", "role")}
                    <select
                      className="form-input mt-2"
                      onChange={(event) => setRole(event.target.value)}
                      value={role}
                    >
                      {STAFF_ROLES.map((item) => (
                        <option key={item} value={item}>{humanize(item)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-5 space-y-5">
                  {groupedPermissions.map(([area, permissions]) => (
                    <div className="rounded-xl border border-border bg-elevated/40 p-4" key={area}>
                      <h2 className="text-sm font-black text-foreground">{humanize(area)}</h2>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {permissions.map((permission) => {
                          const mode = overrides[permission.key] ?? "default";
                          const effective = selected.permissions.includes(permission.key);
                          return (
                            <div className="rounded-xl border border-border bg-surface p-3" key={permission.key}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-foreground">{humanize(permission.key)}</p>
                                  <p className="mt-1 font-mono text-[10px] text-muted">{permission.key}</p>
                                </div>
                                <StatusPill value={effective ? "active" : "denied"} />
                              </div>
                              <select
                                aria-label={`${permission.key} override`}
                                className="form-input mt-3 text-xs"
                                disabled={role === "system_admin"}
                                onChange={(event) => setOverrides((current) => ({
                                  ...current,
                                  [permission.key]: event.target.value as OverrideMode,
                                }))}
                                value={role === "system_admin" ? "default" : mode}
                              >
                                <option value="default">{t("admin", "defaultRoleAccess")}</option>
                                <option value="allow">{t("admin", "explicitAllow")}</option>
                                <option value="deny">{t("admin", "explicitDeny")}</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <button
                    className="button-primary min-w-36"
                    disabled={isSaving}
                    onClick={() => void save()}
                    type="button"
                  >
                    {isSaving ? t("admin", "savingAccess") : t("admin", "saveAccess")}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
