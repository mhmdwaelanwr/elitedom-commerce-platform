"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, type ReactNode, useCallback, useState } from "react";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError } from "@/lib/api";
import {
  passwordLogin,
  requestPhoneOtp,
  type OtpChallenge,
  verifyPhoneOtp,
} from "@/lib/auth-api";
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
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "genericSignInError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setChallenge(
        await requestPhoneOtp({
          mobile,
          name: name.trim() || undefined,
        }),
      );
      setCode("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "genericOtpError"),
      );
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
      finishSession(
        await verifyPhoneOtp({
          challengeId: challenge.challengeId,
          mobile,
          code,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "genericSignInError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell description={t("auth", "signInDescription")} title={t("auth", "welcomeBack")}>
      <div className="mt-7 grid grid-cols-2 rounded-xl border border-border bg-elevated p-1">
        <MethodButton
          active={method === "phone"}
          icon={<PhoneIcon />}
          label={t("auth", "phoneTab")}
          onClick={() => {
            setMethod("phone");
            setError(null);
          }}
        />
        <MethodButton
          active={method === "email"}
          icon={<MailIcon />}
          label={t("auth", "emailTab")}
          onClick={() => {
            setMethod("email");
            setError(null);
          }}
        />
      </div>

      {method === "phone" && !challenge && (
        <form className="mt-6 grid gap-5" onSubmit={handleOtpRequest}>
          <Field label={t("auth", "phoneNumber")}>
            <input
              autoComplete="tel"
              className="form-input"
              inputMode="tel"
              onChange={(event) => setMobile(event.target.value)}
              placeholder={t("auth", "phoneHint")}
              required
              type="tel"
              value={mobile}
            />
          </Field>
          <Field label={t("auth", "fullNameOptional")}>
            <input
              autoComplete="name"
              className="form-input"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <AuthError message={error} />
          <button
            className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-65"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("auth", "sendingCode") : t("auth", "sendCode")}
          </button>
        </form>
      )}

      {method === "phone" && challenge && (
        <form className="mt-6 grid gap-5" onSubmit={handleOtpVerify}>
          <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-[var(--ds-soft-success)] px-4 py-3.5 text-sm text-foreground">
            <span className="mt-0.5 shrink-0 text-success"><CheckIcon /></span>
            <span>{t("auth", "codeSent")}</span>
          </div>

          {challenge.debugCode && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-foreground">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-warning">{t("auth", "localDebugCode")}</span>
              <strong className="mt-1 block font-mono text-lg tracking-[0.2em]">{challenge.debugCode}</strong>
            </div>
          )}

          <Field label={t("auth", "enterCode")}>
            <input
              autoComplete="one-time-code"
              className="form-input text-center font-mono text-2xl tracking-[0.38em]"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              pattern="[0-9]{6}"
              required
              value={code}
            />
          </Field>
          <AuthError message={error} />
          <button
            className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-65"
            disabled={isSubmitting || code.length !== 6}
            type="submit"
          >
            {isSubmitting ? t("auth", "verifyingCode") : t("auth", "verifyCode")}
          </button>
          <button
            className="focus-ring justify-self-center rounded-md text-sm font-black text-primary hover:underline"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
            type="button"
          >
            {t("auth", "changePhone")}
          </button>
        </form>
      )}

      {method === "email" && (
        <form className="mt-6 grid gap-5" onSubmit={handleEmailSubmit}>
          <Field label={t("auth", "email")}>
            <input
              autoComplete="email"
              className="form-input"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          <Field label={t("auth", "password")}>
            <input
              autoComplete="current-password"
              className="form-input"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </Field>
          <AuthError message={error} />
          <button
            className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-65"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("auth", "signingIn") : t("auth", "signInSecurely")}
          </button>
        </form>
      )}

      <div className="my-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" />
        <span>{t("auth", "divider")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialAuthButtons
        continueWithApple={t("auth", "continueWithApple")}
        onError={handleSocialError}
        onSession={finishSession}
        providerUnavailable={t("auth", "providerUnavailable")}
      />

      <p className="mt-7 text-center text-sm text-muted">
        {t("auth", "newToElitedom")} {" "}
        <Link className="focus-ring rounded-md font-black text-primary hover:underline" href="/signup">
          {t("auth", "createAccountLink")}
        </Link>
      </p>
    </AuthShell>
  );
}

function MethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`focus-ring flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black transition sm:text-sm ${
        active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AuthShell({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  const { t } = usePreferences();
  return (
    <div className="site-container py-8 sm:py-10 lg:py-14">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-sm lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="relative hidden min-h-[41rem] overflow-hidden border-e border-border bg-elevated p-9 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-black text-primary" href="/">
              <span aria-hidden="true" className="rtl:rotate-180">←</span>
              {t("auth", "backToStore")}
            </Link>
            <span className="mt-12 grid h-12 w-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-contrast">E</span>
            <p className="section-kicker mt-7">{t("auth", "accountAccess")}</p>
            <h1 className="mt-3 max-w-sm text-3xl font-black leading-tight tracking-tight text-foreground">{title}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted">{description}</p>
          </div>
          <div className="grid gap-3">
            <AuthBenefit icon={<OrderIcon />} text={t("account", "allOrdersDescription")} />
            <AuthBenefit icon={<ShieldIcon />} text={t("auth", "securityDescription")} />
            <AuthBenefit icon={<WarrantyIcon />} text={t("account", "openClaim")} />
          </div>
        </aside>

        <section className="p-6 sm:p-8 lg:p-10">
          <Link className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-black text-primary lg:hidden" href="/">
            <span aria-hidden="true" className="rtl:rotate-180">←</span>
            {t("auth", "backToStore")}
          </Link>
          <p className="section-kicker mt-7 lg:mt-0">{t("auth", "accountAccess")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted lg:hidden">{description}</p>
          {children}
        </section>
      </div>
    </div>
  );
}

function AuthBenefit({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span className="text-xs font-bold leading-5 text-foreground">{text}</span>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? (
    <div className="flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      <span className="mt-0.5 shrink-0"><AlertIcon /></span>
      <span>{message}</span>
    </div>
  ) : null;
}

function SignInLoadingFallback() {
  return (
    <div className="site-container py-10 lg:py-14">
      <div className="mx-auto h-[41rem] w-full max-w-5xl animate-pulse rounded-3xl border border-border bg-surface" />
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <rect height="20" rx="3" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="2" />
      <path d="M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M5 4h14v16H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function WarrantyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M6 4h12v16H6V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
