"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { ApiError, register } from "@/lib/api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function SignUpPage() {
  const router = useRouter();
  const { t } = usePreferences();
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "+20",
    password: "",
    confirmation: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmation) {
      setError(t("auth", "passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        password: form.password,
      });
      router.replace(`/signin?email=${encodeURIComponent(form.email)}`);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "createAccountError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site-container py-8 sm:py-10 lg:py-14">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-sm lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="relative hidden min-h-[42rem] overflow-hidden border-e border-border bg-elevated p-9 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-black text-primary" href="/">
              <span aria-hidden="true" className="rtl:rotate-180">←</span>
              {t("auth", "backToStore")}
            </Link>
            <span className="mt-12 grid h-12 w-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-contrast">
              E
            </span>
            <p className="section-kicker mt-7">{t("auth", "signupEyebrow")}</p>
            <h1 className="mt-3 max-w-md text-3xl font-black leading-tight tracking-tight text-foreground">
              {t("auth", "signupTitle")}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted">
              {t("auth", "signupDescription")}
            </p>
          </div>

          <div className="grid gap-3">
            <TrustRow icon={<OrderIcon />} text={t("account", "allOrdersDescription")} />
            <TrustRow icon={<ShieldIcon />} text={t("auth", "securityDescription")} />
            <TrustRow icon={<LocationIcon />} text={t("account", "manageDelivery")} />
          </div>
        </aside>

        <section className="p-6 sm:p-8 lg:p-10">
          <Link className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-black text-primary lg:hidden" href="/">
            <span aria-hidden="true" className="rtl:rotate-180">←</span>
            {t("auth", "backToStore")}
          </Link>

          <div className="mt-7 lg:mt-0">
            <p className="section-kicker">{t("auth", "signupEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground">
              {t("auth", "createAccount")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted lg:hidden">
              {t("auth", "signupDescription")}
            </p>
          </div>

          <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("auth", "fullName")}>
                <input
                  autoComplete="name"
                  className="form-input"
                  minLength={2}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  value={form.name}
                />
              </Field>
              <Field label={t("auth", "egyptianMobile")}>
                <input
                  autoComplete="tel"
                  className="form-input"
                  inputMode="tel"
                  onChange={(event) => update("mobile", event.target.value)}
                  placeholder={t("auth", "phoneHint")}
                  required
                  type="tel"
                  value={form.mobile}
                />
              </Field>
            </div>

            <Field label={t("auth", "email")}>
              <input
                autoComplete="email"
                className="form-input"
                onChange={(event) => update("email", event.target.value)}
                required
                type="email"
                value={form.email}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("auth", "password")}>
                <input
                  autoComplete="new-password"
                  className="form-input"
                  minLength={8}
                  onChange={(event) => update("password", event.target.value)}
                  required
                  type="password"
                  value={form.password}
                />
              </Field>
              <Field label={t("auth", "confirmPassword")}>
                <input
                  autoComplete="new-password"
                  className="form-input"
                  minLength={8}
                  onChange={(event) => update("confirmation", event.target.value)}
                  required
                  type="password"
                  value={form.confirmation}
                />
              </Field>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-elevated px-4 py-3 text-xs leading-5 text-muted">
              <span className="mt-0.5 shrink-0 text-primary"><InfoIcon /></span>
              <span>{t("auth", "passwordRules")}</span>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
                <span className="mt-0.5 shrink-0"><AlertIcon /></span>
                <span>{error}</span>
              </div>
            )}

            <button
              className="button-primary mt-1 w-full justify-center disabled:cursor-wait disabled:opacity-65"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? t("auth", "creatingAccount") : t("auth", "createAccount")}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-muted">
            {t("auth", "alreadyHaveAccount")} {" "}
            <Link className="focus-ring rounded-md font-black text-primary hover:underline" href="/signin">
              {t("auth", "signIn")}
            </Link>
          </p>
        </section>
      </div>
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

function TrustRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span className="text-xs font-bold leading-5 text-foreground">{text}</span>
    </div>
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

function OrderIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M5 4h14v16H5V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5M12 8v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
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
