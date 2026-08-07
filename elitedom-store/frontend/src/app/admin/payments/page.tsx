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
  fetchControlPayments,
  fetchControlRefunds,
  requestControlRefund,
  type AdminPaymentAttempt,
  type AdminRefund,
} from "@/lib/admin-control-api";
import { fetchAdminAccess } from "@/lib/admin-api";
import { formatAdminDateTime } from "@/lib/admin-ui";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AdminPaymentsPage() {
  const { notify, session } = useStore();
  const { locale, t } = usePreferences();
  const [payments, setPayments] = useState<AdminPaymentAttempt[]>([]);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [canRefund, setCanRefund] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [paymentResponse, refundResponse, access] = await Promise.all([
        fetchControlPayments(session),
        fetchControlRefunds(session),
        fetchAdminAccess(session),
      ]);
      setPayments(paymentResponse.payments);
      setRefunds(refundResponse.refunds);
      setCanRefund(access.permissions.includes("payments.refund"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load finance data.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function requestRefund(payment: AdminPaymentAttempt) {
    if (!session || busyOrderId !== null || !canRefund) return;
    const reason = window.prompt(t("admin", "refundReason"), "operations_review")?.trim();
    if (!reason || reason.length < 3) return;
    if (!window.confirm(t("admin", "refundConfirmation"))) return;

    setBusyOrderId(payment.order_id);
    try {
      await requestControlRefund(payment.order_id, reason, session);
      notify(t("admin", "refundRequested"), "success");
      await load();
    } catch (requestError) {
      notify(
        requestError instanceof Error ? requestError.message : "Unable to request refund.",
        "error",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        description={t("admin", "paymentsDescription")}
        eyebrow={t("admin", "operations")}
        title={t("admin", "paymentsTitle")}
      />
      <div className="mt-7">
        {isLoading ? (
          <AdminLoading label={t("admin", "loadingAdminData")} />
        ) : error ? (
          <AdminError error={error} onRetry={() => void load()} />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-black text-foreground">{t("admin", "paymentAttempts")}</h2>
              {payments.length === 0 ? (
                <div className="mt-4"><AdminEmpty detail={t("admin", "noPayments")} /></div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {payments.map((payment) => (
                    <article className="rounded-xl border border-border bg-elevated/30 p-4" key={payment.id}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-foreground">{payment.order_number}</p>
                          <p className="mt-1 text-xs text-muted">{payment.customer_name} · {payment.customer_email}</p>
                          <p className="mt-2 font-mono text-[10px] text-muted">{payment.provider_transaction_id ?? payment.provider_intention_id ?? payment.id}</p>
                        </div>
                        <div className="text-end">
                          <StatusPill value={payment.status} />
                          <p className="mt-2 text-sm font-black text-foreground">{formatMinor(payment.amount_minor, payment.currency, locale)}</p>
                          <p className="mt-1 text-xs text-muted">{payment.provider} · {payment.payment_method}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <time className="text-xs text-muted" dateTime={payment.created_at}>{formatAdminDateTime(payment.created_at)}</time>
                        {canRefund && payment.status === "succeeded" ? (
                          <button
                            className="button-secondary px-3 py-2 text-xs"
                            disabled={busyOrderId !== null}
                            onClick={() => void requestRefund(payment)}
                            type="button"
                          >
                            {t("admin", "requestRefund")}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-black text-foreground">{t("admin", "refundRequests")}</h2>
              {refunds.length === 0 ? (
                <div className="mt-4"><AdminEmpty detail={t("admin", "noRefunds")} /></div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {refunds.map((refund) => (
                    <article className="rounded-xl border border-border bg-elevated/30 p-4" key={refund.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-foreground">{refund.order_number}</p>
                          <p className="mt-1 text-xs text-muted">{refund.customer_name}</p>
                        </div>
                        <StatusPill value={refund.status} />
                      </div>
                      <p className="mt-3 text-lg font-black text-foreground">{formatMinor(refund.amount_minor, refund.currency, locale)}</p>
                      <p className="mt-2 text-xs leading-5 text-muted">{refund.reason}</p>
                      <p className="mt-3 text-[11px] text-muted">{refund.provider} · {formatAdminDateTime(refund.created_at)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function formatMinor(amountMinor: number, currency: string, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
