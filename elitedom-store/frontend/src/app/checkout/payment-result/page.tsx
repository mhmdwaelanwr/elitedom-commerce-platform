"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchPublicPaymentStatus } from "@/lib/payments";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type ResultState = "checking" | "paid" | "failed" | "pending" | "missing" | "error";

const ORDER_STORAGE_KEY = "elitedom:last-payment-order";
const MAX_STATUS_CHECKS = 12;
const STATUS_CHECK_DELAY_MS = 2500;

export default function PaymentResultPage() {
  const { t } = usePreferences();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [state, setState] = useState<ResultState>("checking");
  const [checkVersion, setCheckVersion] = useState(0);

  const retry = useCallback(() => {
    setState("checking");
    setCheckVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const storedOrder = window.sessionStorage.getItem(ORDER_STORAGE_KEY);
    const callbackOrder =
      query.get("merchant_order_id") ??
      query.get("special_reference") ??
      query.get("order_number");
    const resolvedOrder = storedOrder || callbackOrder;
    if (!resolvedOrder) {
      setState("missing");
      return;
    }

    setOrderNumber(resolvedOrder);
    let active = true;
    let timer: number | undefined;
    let checks = 0;

    async function checkStatus() {
      try {
        const status = await fetchPublicPaymentStatus(resolvedOrder);
        if (!active) return;
        if (status.payment_status === "paid") {
          window.sessionStorage.removeItem(ORDER_STORAGE_KEY);
          setState("paid");
          return;
        }
        if (status.payment_status === "failed") {
          setState("failed");
          return;
        }

        checks += 1;
        if (checks >= MAX_STATUS_CHECKS) {
          setState("pending");
          return;
        }
        timer = window.setTimeout(checkStatus, STATUS_CHECK_DELAY_MS);
      } catch {
        if (!active) return;
        checks += 1;
        if (checks >= MAX_STATUS_CHECKS) {
          setState("error");
          return;
        }
        timer = window.setTimeout(checkStatus, STATUS_CHECK_DELAY_MS);
      }
    }

    void checkStatus();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [checkVersion]);

  const content = {
    checking: {
      icon: "…",
      title: t("checkout", "paymentConfirmingTitle"),
      text: t("checkout", "paymentConfirmingText"),
    },
    paid: {
      icon: "✓",
      title: t("checkout", "paymentPaidTitle"),
      text: t("checkout", "paymentPaidText"),
    },
    failed: {
      icon: "!",
      title: t("checkout", "paymentFailedTitle"),
      text: t("checkout", "paymentFailedText"),
    },
    pending: {
      icon: "⌛",
      title: t("checkout", "paymentPendingTitle"),
      text: t("checkout", "paymentPendingText"),
    },
    missing: {
      icon: "?",
      title: t("checkout", "paymentMissingTitle"),
      text: t("checkout", "paymentMissingText"),
    },
    error: {
      icon: "!",
      title: t("checkout", "paymentErrorTitle"),
      text: t("checkout", "paymentErrorText"),
    },
  }[state];

  return (
    <main className="site-container grid min-h-[60vh] place-items-center py-12">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-2xl font-black text-primary">
          {content.icon}
        </div>
        <p className="section-kicker mt-6">{t("checkout", "paymentResultEyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{content.title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted">{content.text}</p>
        {orderNumber && (
          <p className="mt-4 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
            {t("checkout", "paymentReference")} {" "}
            <strong className="font-mono text-foreground">{orderNumber}</strong>
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {(state === "pending" || state === "error") && orderNumber && (
            <button className="button-primary" onClick={retry} type="button">
              {t("checkout", "retryPaymentStatus")}
            </button>
          )}
          <Link className="button-secondary" href="/account">
            {t("checkout", "viewAccount")}
          </Link>
          <Link className="button-secondary" href="/shop">
            {t("checkout", "continueShopping")}
          </Link>
        </div>
      </section>
    </main>
  );
}
