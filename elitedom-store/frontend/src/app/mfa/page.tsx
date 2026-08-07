"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { isStaffRole } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  fetchMfaStatus,
  refreshSession,
  type MfaEnrollment,
  type MfaStatus,
  verifyMfa,
} from "@/lib/auth-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { CustomerSession } from "@/types/store";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

export default function MfaPage() {
  return (
    <Suspense fallback={<MfaLoading />}>
      <MfaFlow />
    </Suspense>
  );
}

function MfaFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);
  const { locale } = usePreferences();
  const { session, setSession } = useStore();
  const [activeSession, setActiveSession] = useState<CustomerSession | null>(session);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ar = locale === "ar";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let current = session;
        if (!current) {
          current = await refreshSession();
          if (active) {
            setSession(current);
            setActiveSession(current);
          }
        }
        if (!isStaffRole(current.role)) {
          router.replace("/account");
          return;
        }
        const currentStatus = await fetchMfaStatus(current);
        if (!active) return;
        setStatus(currentStatus);
        if (!currentStatus.required || currentStatus.verified) {
          router.replace(next);
          return;
        }
      } catch {
        if (active) router.replace(`/signin?next=${encodeURIComponent(next)}`);
        return;
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [next, router, session, setSession]);

  async function startEnrollment() {
    if (!activeSession) return;
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await beginMfaEnrollment(activeSession));
      setCode("");
    } catch (requestError) {
      setError(messageFor(requestError, ar));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession || !status) return;
    setBusy(true);
    setError(null);
    try {
      if (!status.enrolled) {
        const confirmed = await confirmMfaEnrollment(code, activeSession);
        setStatus(confirmed.status);
        setRecoveryCodes(confirmed.recoveryCodes);
        setEnrollment(null);
        setCode("");
        return;
      }
      const verified = await verifyMfa(code, activeSession);
      setStatus(verified);
      router.replace(next);
    } catch (requestError) {
      setError(messageFor(requestError, ar));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !status) return <MfaLoading />;

  return (
    <div className="site-container py-10 sm:py-16">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl">
        <div className="border-b border-border bg-elevated px-6 py-6 sm:px-8">
          <p className="section-kicker">{ar ? "أمان حساب الموظفين" : "Staff account security"}</p>
          <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">
            {ar ? "التحقق بخطوتين مطلوب" : "Two-factor verification required"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {ar
              ? "صلاحيات لوحة الإدارة محمية بكود من تطبيق المصادقة أو بكود استرداد أحادي الاستخدام."
              : "Administrative permissions require an authenticator code or a single-use recovery code for this device session."}
          </p>
        </div>

        <div className="grid gap-6 p-6 sm:p-8">
          {!status.enrolled && !enrollment && recoveryCodes.length === 0 && (
            <div className="rounded-2xl border border-border bg-background p-5">
              <h2 className="font-black text-foreground">
                {ar ? "إعداد تطبيق المصادقة" : "Set up an authenticator app"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {ar
                  ? "ابدأ الإعداد، أضف الحساب إلى Google Authenticator أو Microsoft Authenticator أو أي تطبيق TOTP، ثم أدخل الكود المكون من 6 أرقام."
                  : "Start enrollment, add the account to Google Authenticator, Microsoft Authenticator, or another TOTP app, then enter the six-digit code."}
              </p>
              <button
                className="button-primary mt-5 disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={startEnrollment}
                type="button"
              >
                {busy ? (ar ? "جاري التجهيز…" : "Preparing…") : ar ? "ابدأ الإعداد" : "Start setup"}
              </button>
            </div>
          )}

          {enrollment && !status.enrolled && (
            <div className="grid gap-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {ar ? "المفتاح اليدوي" : "Manual setup key"}
                </p>
                <code className="mt-2 block break-all rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground">
                  {enrollment.secret}
                </code>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {ar ? "رابط TOTP" : "TOTP provisioning URI"}
                </p>
                <code className="mt-2 block max-h-24 overflow-auto break-all rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted">
                  {enrollment.provisioningUri}
                </code>
              </div>
              <CodeForm
                ar={ar}
                busy={busy}
                code={code}
                error={error}
                onChange={setCode}
                onSubmit={submitCode}
                recoveryAllowed={false}
              />
            </div>
          )}

          {status.enrolled && !status.verified && recoveryCodes.length === 0 && (
            <div className="rounded-2xl border border-border bg-background p-5">
              <h2 className="font-black text-foreground">
                {ar ? "أكد هويتك" : "Verify your identity"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {ar
                  ? "أدخل كود تطبيق المصادقة أو أحد أكواد الاسترداد المحفوظة."
                  : "Enter the current authenticator code or one of your saved recovery codes."}
              </p>
              <div className="mt-5">
                <CodeForm
                  ar={ar}
                  busy={busy}
                  code={code}
                  error={error}
                  onChange={setCode}
                  onSubmit={submitCode}
                  recoveryAllowed
                />
              </div>
              <p className="mt-4 text-xs text-muted">
                {ar
                  ? `أكواد الاسترداد المتبقية: ${status.remainingRecoveryCodes}`
                  : `Recovery codes remaining: ${status.remainingRecoveryCodes}`}
              </p>
            </div>
          )}

          {recoveryCodes.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
              <h2 className="font-black text-foreground">
                {ar ? "احفظ أكواد الاسترداد الآن" : "Save your recovery codes now"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {ar
                  ? "لن يتم عرض الأكواد بهذه الصورة مرة أخرى. كل كود يعمل مرة واحدة فقط. خزّنها في مدير كلمات مرور أو مكان آمن منفصل."
                  : "These codes will not be shown like this again. Each code works once. Store them in a password manager or another secure location."}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recoveryCodes.map((recoveryCode) => (
                  <code
                    className="rounded-lg border border-border bg-background px-3 py-2 text-center text-sm font-bold text-foreground"
                    key={recoveryCode}
                  >
                    {recoveryCode}
                  </code>
                ))}
              </div>
              <button className="button-primary mt-5" onClick={() => router.replace(next)} type="button">
                {ar ? "حفظت الأكواد — متابعة" : "I saved the codes — continue"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm">
            <Link className="font-bold text-muted hover:text-primary" href="/">
              {ar ? "العودة للمتجر" : "Return to store"}
            </Link>
            <span className="text-xs text-muted">
              {ar ? "MFA مرتبط بالجلسة الحالية ولا يعتمد على دور داخل JWT." : "MFA is tied to this tracked session, not a JWT role claim."}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function CodeForm({
  ar,
  busy,
  code,
  error,
  onChange,
  onSubmit,
  recoveryAllowed,
}: {
  ar: boolean;
  busy: boolean;
  code: string;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  recoveryAllowed: boolean;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm font-bold text-foreground">
        <span>{ar ? "كود التحقق" : "Verification code"}</span>
        <input
          autoComplete="one-time-code"
          className="form-input font-mono tracking-wider"
          inputMode={recoveryAllowed ? "text" : "numeric"}
          maxLength={32}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder={recoveryAllowed ? (ar ? "123456 أو كود استرداد" : "123456 or recovery code") : "123456"}
          required
          value={code}
        />
      </label>
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
      <button className="button-primary disabled:cursor-wait disabled:opacity-60" disabled={busy || code.length < 6} type="submit">
        {busy ? (ar ? "جاري التحقق…" : "Verifying…") : ar ? "تحقق" : "Verify"}
      </button>
    </form>
  );
}

function MfaLoading() {
  return (
    <div className="site-container grid min-h-[60vh] place-items-center py-10" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-e-transparent" />
        Securing staff session…
      </div>
    </div>
  );
}

function messageFor(error: unknown, ar: boolean) {
  if (error instanceof ApiError) return error.message;
  return ar ? "تعذر إكمال التحقق. حاول مرة أخرى." : "We could not complete verification. Please try again.";
}
