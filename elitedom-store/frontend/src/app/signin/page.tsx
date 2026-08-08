"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, Suspense, useCallback, useState } from "react";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError } from "@/lib/api";
import { passwordLogin, requestPhoneOtp, type OtpChallenge, verifyPhoneOtp } from "@/lib/auth-api";
import { usePreferences } from "@/providers/AppPreferencesProvider";
import type { CustomerSession } from "@/types/store";

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoadingFallback />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = usePreferences();
  const { notify, setSession } = useStore();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [mobile, setMobile] = useState("+20");
  const [name, setName] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const finishSession = useCallback(
    (session: CustomerSession) => {
      setSession(session);
      notify(t("auth", "welcomeNotification"));
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");
    },
    [notify, router, searchParams, setSession, t],
  );

  const handleSocialError = useCallback(
    (message: string) => setError(message || t("auth", "genericSignInError")),
    [t],
  );

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      finishSession(await passwordLogin({ email, password }));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setChallenge(await requestPhoneOtp({ mobile, name: name.trim() || undefined }));
      setCode("");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericOtpError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      finishSession(await verifyPhoneOtp({ challengeId: challenge.challengeId, mobile, code }));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell description={t("auth", "signInDescription")} title={t("auth", "welcomeBack")}>
      <div className="mt-6 grid grid-cols-2 rounded-lg border border-border bg-elevated/60 p-1">
        <MethodButton active={method === "phone"} label={t("auth", "phoneTab")} onClick={() => { setMethod("phone"); setError(null); }} />
        <MethodButton active={method === "email"} label={t("auth", "emailTab")} onClick={() => { setMethod("email"); setError(null); }} />
      </div>

      {method === "phone" && !challenge ? (
        <form className="mt-5 grid gap-4" onSubmit={handleOtpRequest}>
          <Field label={t("auth", "phoneNumber")}>
            <input autoComplete="tel" className="form-input" inputMode="tel" onChange={(event) => setMobile(event.target.value)} placeholder={t("auth", "phoneHint")} required type="tel" value={mobile} />
          </Field>
          <Field label={t("auth", "fullNameOptional")}>
            <input autoComplete="name" className="form-input" minLength={2} onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <AuthError message={error} />
          <button className="button-primary w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("auth", "sendingCode") : t("auth", "sendCode")}
          </button>
        </form>
      ) : null}

      {method === "phone" && challenge ? (
        <form className="mt-5 grid gap-4" onSubmit={handleOtpVerify}>
          <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-sm text-foreground">
            <div className="flex items-center gap-2 font-semibold text-success"><CheckIcon />{t("auth", "codeSent")}</div>
          </div>
          {challenge.debugCode ? (
            <p className="rounded-lg border border-warning/25 bg-warning/5 px-4 py-3 text-center text-sm text-foreground">
              {t("auth", "localDebugCode")}: <strong>{challenge.debugCode}</strong>
            </p>
          ) : null}
          <Field label={t("auth", "enterCode")}>
            <input autoComplete="one-time-code" className="form-input text-center text-2xl font-black tracking-[0.35em]" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} pattern="[0-9]{6}" required value={code} />
          </Field>
          <AuthError message={error} />
          <button className="button-primary w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting || code.length !== 6} type="submit">
            {isSubmitting ? t("auth", "verifyingCode") : t("auth", "verifyCode")}
          </button>
          <button className="focus-ring rounded-md py-1 text-sm font-bold text-primary hover:brightness-110" onClick={() => { setChallenge(null); setCode(""); setError(null); }} type="button">
            {t("auth", "changePhone")}
          </button>
        </form>
      ) : null}

      {method === "email" ? (
        <form className="mt-5 grid gap-4" onSubmit={handleEmailSubmit}>
          <Field label={t("auth", "email")}>
            <input autoComplete="email" className="form-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </Field>
          <Field label={t("auth", "password")}>
            <input autoComplete="current-password" className="form-input" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </Field>
          <AuthError message={error} />
          <button className="button-primary w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("auth", "signingIn") : t("auth", "signInSecurely")}
          </button>
        </form>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted">
        <span className="h-px flex-1 bg-border" /><span>{t("auth", "divider")}</span><span className="h-px flex-1 bg-border" />
      </div>

      <SocialAuthButtons continueWithApple={t("auth", "continueWithApple")} onError={handleSocialError} onSession={finishSession} providerUnavailable={t("auth", "providerUnavailable")} />

      <p className="mt-5 text-center text-sm text-muted">
        {t("auth", "newToElitedom")} <Link className="focus-ring rounded-md font-bold text-primary hover:brightness-110" href="/signup">{t("auth", "createAccountLink")}</Link>
      </p>
    </AuthShell>
  );
}

function MethodButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`focus-ring rounded-md px-3 py-2.5 text-sm font-bold transition ${active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`} onClick={onClick} type="button">{label}</button>;
}

function AuthShell({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  const { t } = usePreferences();
  return (
    <div className="site-container py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden bg-primary p-9 text-primary-contrast lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg" href="/">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-sm font-black text-primary">E</span>
              <span className="text-xl font-black tracking-[-0.04em]">ELITEDOM</span>
            </Link>
            <h2 className="mt-12 text-3xl font-black leading-tight tracking-tight">{t("auth", "accountAccess")}</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 opacity-80">{description}</p>
          </div>
          <div className="grid gap-3 border-t border-primary-contrast/20 pt-6 text-sm">
            <AuthBenefit icon={<ShieldIcon />} title={t("storefront", "securePayments")} text={t("storefront", "securePaymentsDetail")} />
            <AuthBenefit icon={<BoxIcon />} title={t("storefront", "verifiedWarranty")} text={t("storefront", "verifiedWarrantyDetail")} />
          </div>
        </aside>

        <section className="p-6 sm:p-8 lg:p-10">
          <Link className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-primary hover:brightness-110" href="/"><ArrowBack />{t("auth", "backToStore")}</Link>
          <p className="section-kicker mt-8">{t("auth", "accountAccess")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          {children}
        </section>
      </div>
    </div>
  );
}

function AuthBenefit({ icon, text, title }: { icon: ReactNode; text: string; title: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-contrast/10">{icon}</span><div><p className="font-bold">{title}</p><p className="mt-0.5 text-xs leading-5 opacity-75">{text}</p></div></div>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>;
}

function AuthError({ message }: { message: string | null }) {
  return message ? <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{message}</p> : null;
}

function SignInLoadingFallback() {
  return <div className="site-container py-12"><div className="mx-auto h-[34rem] w-full max-w-5xl animate-pulse rounded-2xl border border-border bg-surface" /></div>;
}

function ArrowBack() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function CheckIcon() { return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="m6 12 4 4 8-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>; }
function ShieldIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function BoxIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
