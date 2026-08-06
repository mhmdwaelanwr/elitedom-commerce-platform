"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useState } from "react";
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
    <AuthShell
      description={t("auth", "signInDescription")}
      title={t("auth", "welcomeBack")}
    >
      <div className="mt-7 grid grid-cols-2 rounded-xl border border-border bg-elevated p-1">
        <MethodButton
          active={method === "phone"}
          label={t("auth", "phoneTab")}
          onClick={() => {
            setMethod("phone");
            setError(null);
          }}
        />
        <MethodButton
          active={method === "email"}
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
            className="button-primary w-full disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("auth", "sendingCode") : t("auth", "sendCode")}
          </button>
        </form>
      )}

      {method === "phone" && challenge && (
        <form className="mt-6 grid gap-5" onSubmit={handleOtpVerify}>
          <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
            {t("auth", "codeSent")}
          </p>
          {challenge.debugCode && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-foreground">
              {t("auth", "localDebugCode")}: <strong>{challenge.debugCode}</strong>
            </p>
          )}
          <Field label={t("auth", "enterCode")}>
            <input
              autoComplete="one-time-code"
              className="form-input text-center text-2xl tracking-[0.35em]"
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
            className="button-primary w-full disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting || code.length !== 6}
            type="submit"
          >
            {isSubmitting ? t("auth", "verifyingCode") : t("auth", "verifyCode")}
          </button>
          <button
            className="focus-ring rounded-lg text-sm font-bold text-primary hover:brightness-110"
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
            className="button-primary w-full disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("auth", "signingIn") : t("auth", "signInSecurely")}
          </button>
        </form>
      )}

      <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
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

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth", "newToElitedom")} {" "}
        <Link
          className="focus-ring rounded-md font-bold text-primary hover:brightness-110"
          href="/signup"
        >
          {t("auth", "createAccountLink")}
        </Link>
      </p>
    </AuthShell>
  );
}

function MethodButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`focus-ring rounded-lg px-3 py-2.5 text-sm font-bold transition ${
        active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AuthShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[calc(100vh-14rem)] place-items-center py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl shadow-black/10 sm:p-8">
        <Link
          className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-primary hover:brightness-110"
          href="/"
        >
          ← {t("auth", "backToStore")}
        </Link>
        <p className="section-kicker mt-8">{t("auth", "accountAccess")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        {children}
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? (
    <p
      className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-foreground"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

function SignInLoadingFallback() {
  return (
    <div className="site-container grid min-h-[calc(100vh-14rem)] place-items-center py-10">
      <div className="h-96 w-full max-w-md animate-pulse rounded-3xl border border-border bg-surface" />
    </div>
  );
}
