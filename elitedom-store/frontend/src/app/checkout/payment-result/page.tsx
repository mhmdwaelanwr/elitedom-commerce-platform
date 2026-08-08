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
    let active = true;
    let pollTimer: number | undefined;
    let checks = 0;

    async function checkStatus(resolvedOrder: string) {
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
        pollTimer = window.setTimeout(
          () => void checkStatus(resolvedOrder),
          STATUS_CHECK_DELAY_MS,
        );
      } catch {
        if (!active) return;
        checks += 1;
        if (checks >= MAX_STATUS_CHECKS) {
          setState("error");
          return;
        }
        pollTimer = window.setTimeout(
          () => void checkStatus(resolvedOrder),
          STATUS_CHECK_DELAY_MS,
        );
      }
    }

    const initializationTimer = window.setTimeout(() => {
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
      void checkStatus(resolvedOrder);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(initializationTimer);
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [checkVersion]);

  const content = {
    checking: {
      title: t("checkout", "paymentConfirmingTitle"),
      text: t("checkout", "paymentConfirmingText"),
      tone: "primary" as const,
    },
    paid: {
      title: t("checkout", "paymentPaidTitle"),
      text: t("checkout", "paymentPaidText"),
      tone: "success" as const,
    },
    failed: {
      title: t("checkout", "paymentFailedTitle"),
      text: t("checkout", "paymentFailedText"),
      tone: "danger" as const,
    },
    pending: {
      title: t("checkout", "paymentPendingTitle"),
      text: t("checkout", "paymentPendingText"),
      tone: "warning" as const,
    },
    missing: {
      title: t("checkout", "paymentMissingTitle"),
      text: t("checkout", "paymentMissingText"),
      tone: "neutral" as const,
    },
    error: {
      title: t("checkout", "paymentErrorTitle"),
      text: t("checkout", "paymentErrorText"),
      tone: "danger" as const,
    },
  }[state];

  return (
    <main className="site-container grid min-h-[68vh] place-items-center py-12 sm:py-16">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface shadow-sm" aria-live="polite">
        <div className={`border-b border-border px-7 py-9 text-center sm:px-10 sm:py-11 ${toneBackground(content.tone)}`}>
          <StatusMark state={state} tone={content.tone} />
          <p className={`mt-6 text-xs font-black uppercase tracking-[0.14em] ${toneText(content.tone)}`}>
            {t("checkout", "paymentResultEyebrow")}
          </p>
          <h1 className="mx-auto mt-2 max-w-xl text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted sm:text-base">
            {content.text}
          </p>
        </div>

        <div className="px-7 py-7 sm:px-10 sm:py-8">
          {orderNumber && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted">{t("checkout", "paymentReference")}</span>
              <strong className="font-mono text-foreground">{orderNumber}</strong>
            </div>
          )}

          <PaymentProgress state={state} />

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {(state === "pending" || state === "error") && orderNumber && (
              <button className="button-primary" onClick={retry} type="button">
                {t("checkout", "retryPaymentStatus")}
              </button>
            )}
            <Link className={state === "paid" ? "button-primary" : "button-secondary"} href="/account">
              {t("checkout", "viewAccount")}
            </Link>
            <Link className="button-secondary" href="/shop">
              {t("checkout", "continueShopping")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusMark({ state, tone }: { state: ResultState; tone: "primary" | "success" | "danger" | "warning" | "neutral" }) {
  return (
    <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl border shadow-sm ${toneMark(tone)}`}>
      {state === "checking" ? <SpinnerIcon /> : state === "paid" ? <CheckIcon /> : state === "pending" ? <ClockIcon /> : state === "missing" ? <SearchIcon /> : <AlertIcon />}
    </span>
  );
}

function PaymentProgress({ state }: { state: ResultState }) {
  const { t } = usePreferences();
  const confirmed = state === "paid";
  const finalKnown = state === "paid" || state === "failed";

  return (
    <div className="mt-6 rounded-xl border border-border bg-background p-4">
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2" aria-hidden="true">
        <ProgressDot active complete />
        <span className="h-px bg-primary" />
        <ProgressDot active={state === "checking" || state === "pending" || finalKnown} complete={confirmed || finalKnown} pulse={state === "checking"} />
        <span className={`h-px ${confirmed ? "bg-success" : "bg-border"}`} />
        <ProgressDot active={confirmed} complete={confirmed} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-[11px] font-bold leading-4 text-muted">
        <span>{t("checkout", "orderCreated")}</span>
        <span>Paymob</span>
        <span>{t("checkout", "paymentPaidTitle")}</span>
      </div>
    </div>
  );
}

function ProgressDot({ active, complete, pulse = false }: { active: boolean; complete: boolean; pulse?: boolean }) {
  return (
    <span className={`relative grid h-5 w-5 place-items-center rounded-full border-2 ${complete ? "border-success bg-success" : active ? "border-primary bg-surface" : "border-border bg-surface"}`}>
      {complete && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      {pulse && <span className="absolute inset-[-5px] animate-ping rounded-full border border-primary/30" />}
    </span>
  );
}

function toneBackground(tone: "primary" | "success" | "danger" | "warning" | "neutral") {
  if (tone === "success") return "bg-[var(--ds-soft-success)]";
  if (tone === "danger") return "bg-danger/10";
  if (tone === "warning") return "bg-warning/10";
  if (tone === "neutral") return "bg-elevated";
  return "bg-[var(--ds-soft-primary)]";
}

function toneText(tone: "primary" | "success" | "danger" | "warning" | "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "neutral") return "text-muted";
  return "text-primary";
}

function toneMark(tone: "primary" | "success" | "danger" | "warning" | "neutral") {
  if (tone === "success") return "border-success/25 bg-success text-white";
  if (tone === "danger") return "border-danger/25 bg-surface text-danger";
  if (tone === "warning") return "border-warning/25 bg-surface text-warning";
  if (tone === "neutral") return "border-border bg-surface text-muted";
  return "border-primary/25 bg-surface text-primary";
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="animate-spin" fill="none" height="28" viewBox="0 0 24 24" width="28">
      <circle cx="12" cy="12" opacity=".25" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="29" viewBox="0 0 24 24" width="29">
      <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="27" viewBox="0 0 24 24" width="27">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="27" viewBox="0 0 24 24" width="27">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 15.5 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="27" viewBox="0 0 24 24" width="27">
      <path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
