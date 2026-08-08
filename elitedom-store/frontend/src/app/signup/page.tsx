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
      setError(t("auth", "passwordsDoNotMatch"));
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
    <div className="site-container py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden bg-primary p-9 text-primary-contrast lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-lg" href="/">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-sm font-black text-primary">E</span>
              <span className="text-xl font-black tracking-[-0.04em]">ELITEDOM</span>
            </Link>
            <h2 className="mt-12 text-3xl font-black leading-tight tracking-tight">
              {t("auth", "signupTitle")}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 opacity-80">
              {t("auth", "signupDescription")}
            </p>
          </div>

          <div className="grid gap-3 border-t border-primary-contrast/20 pt-6 text-sm">
            <Benefit icon={<OrdersIcon />} title={t("account", "orders")} />
            <Benefit icon={<LocationIcon />} title={t("account", "addresses")} />
            <Benefit icon={<ShieldIcon />} title={t("storefront", "verifiedWarranty")} />
          </div>
        </aside>

        <section className="p-6 sm:p-8 lg:p-10">
          <Link className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-primary hover:brightness-110" href="/">
            <ArrowBack />
            {t("auth", "backToStore")}
          </Link>

          <p className="section-kicker mt-8">{t("auth", "signupEyebrow")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
            {t("auth", "signupTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t("auth", "signupDescription")}</p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  onChange={(event) => update("mobile", event.target.value)}
                  placeholder="+2010…"
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

            <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="flex gap-2 rounded-lg border border-border bg-elevated/55 px-3 py-3 text-xs leading-5 text-muted">
              <InfoIcon />
              <span>{t("auth", "passwordRequirements")}</span>
            </div>

            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <button className="button-primary mt-1 w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting} type="submit">
              {isSubmitting ? t("auth", "creatingAccount") : t("auth", "createAccount")}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {t("auth", "alreadyHaveAccount")} {" "}
            <Link className="focus-ring rounded-md font-bold text-primary hover:brightness-110" href="/signin">
              {t("auth", "signIn")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>;
}

function Benefit({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-contrast/10">{icon}</span><span className="font-bold">{title}</span></div>;
}

function ArrowBack() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function InfoIcon() { return <svg aria-hidden="true" className="mt-0.5 shrink-0 text-primary" fill="none" height="16" viewBox="0 0 24 24" width="16"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 11v5m0-8h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>; }
function OrdersIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
function LocationIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function ShieldIcon() { return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
