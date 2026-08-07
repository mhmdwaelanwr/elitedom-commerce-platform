"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  StatusPill,
} from "@/components/admin/AdminPrimitives";
import { useStore } from "@/components/store/StoreProvider";
import {
  fetchControlPurchaseOrders,
  fetchControlSuppliers,
  type AdminPurchaseOrder,
  type AdminSupplier,
} from "@/lib/admin-control-api";
import { formatAdminDateTime } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminSuppliersPage() {
  const { session } = useStore();
  const { locale, t } = usePreferences();
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<AdminPurchaseOrder[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [supplierResponse, purchaseOrderResponse] = await Promise.all([
        fetchControlSuppliers(session),
        fetchControlPurchaseOrders(session),
      ]);
      setSuppliers(supplierResponse.suppliers);
      setPurchaseOrders(purchaseOrderResponse.purchase_orders);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load procurement data.");
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
        description={t("admin", "suppliersDescription")}
        eyebrow={t("admin", "operations")}
        title={t("admin", "suppliersTitle")}
      />
      <div className="mt-7">
        {isLoading ? (
          <AdminLoading label={t("admin", "loadingAdminData")} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-black text-foreground">{t("admin", "supplierDirectory")}</h2>
              {suppliers.length === 0 ? (
                <div className="mt-4"><AdminEmpty detail={t("admin", "noSuppliers")} /></div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {suppliers.map((supplier) => (
                    <article className="rounded-xl border border-border bg-elevated/30 p-4" key={supplier.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground">{supplier.name}</p>
                          <p className="mt-1 truncate text-xs text-muted">{supplier.email}</p>
                        </div>
                        <StatusPill value={supplier.is_verified ? "verified" : "unverified"} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <Fact label={t("admin", "leadTime")} value={`${supplier.lead_time_days} d`} />
                        <Fact label={t("admin", "order")} value={String(supplier.total_orders)} />
                        <Fact label="Rating" value={supplier.performance_rating == null ? "—" : String(supplier.performance_rating)} />
                        <Fact label="Defect" value={`${supplier.defect_rate_percent}%`} />
                      </dl>
                      <p className="mt-3 text-[11px] text-muted">{formatAdminDateTime(supplier.created_at)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-black text-foreground">{t("admin", "purchaseOrders")}</h2>
              {purchaseOrders.length === 0 ? (
                <div className="mt-4"><AdminEmpty detail={t("admin", "noPurchaseOrders")} /></div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-start text-xs font-black text-muted">
                        <th className="border-b border-border px-3 py-3 text-start">PO</th>
                        <th className="border-b border-border px-3 py-3 text-start">{t("admin", "status")}</th>
                        <th className="border-b border-border px-3 py-3 text-start">{t("admin", "amount")}</th>
                        <th className="border-b border-border px-3 py-3 text-start">Supplier</th>
                        <th className="border-b border-border px-3 py-3 text-start">{t("admin", "created")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.map((po) => (
                        <tr key={po.id}>
                          <td className="border-b border-border px-3 py-3 font-mono text-xs font-bold text-foreground">{po.po_number}</td>
                          <td className="border-b border-border px-3 py-3"><StatusPill value={po.status} /></td>
                          <td className="border-b border-border px-3 py-3 font-bold text-foreground">{formatMoney(po.total_amount, po.currency, locale)}</td>
                          <td className="border-b border-border px-3 py-3 text-muted">#{po.supplier_id}</td>
                          <td className="border-b border-border px-3 py-3 text-xs text-muted">{formatAdminDateTime(po.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <dt className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-bold text-foreground">{value}</dd>
    </div>
  );
}

function formatMoney(amount: string | number, currency: string, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
