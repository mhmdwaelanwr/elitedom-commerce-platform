"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, register } from "@/lib/api";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function SignUpPage() {
  const router = useRouter();
  const { direction, t } = usePreferences();
  const [form, setForm] = useState({ name: "", email: "", mobile: "+20", password: "", confirmation: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmation) {
      setError(t("auth", "passwordsMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, mobile: form.mobile, password: form.password });
      router.replace(`/signin?email=${encodeURIComponent(form.email)}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "createAccountError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="site-container grid min-h-[calc(100vh-8rem)] place-items-center py-10 sm:py-14">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:p-10">
        <Link className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-primary hover:bg-[var(--ds-primary-soft)]" href="/">
          <span aria-hidden="true">{direction === "rtl" ? "→" : "←"}</span> {t("auth", "backToStore")}
        </Link>

        <div className="mt-8">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-contrast" aria-hidden="true">E</span>
          <p className="mt-6 text-sm font-bold text-primary">{t("auth", "signupEyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl">{t("auth", "signupTitle")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("auth", "signupDescription")}</p>
        </div>

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("auth", "fullName")}>
              <input autoComplete="name" className="form-input" minLength={2} onChange={(event) => update("name", event.target.value)} required value={form.name} />
            </Field>
            <Field label={t("auth", "egyptianMobile")}>
              <input autoComplete="tel" className="form-input" onChange={(event) => update("mobile", event.target.value)} placeholder="+2010…" required type="tel" value={form.mobile} />
            </Field>
          </div>

          <Field label={t("auth", "email")}>
            <input autoComplete="email" className="form-input" onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("auth", "password")}>
              <input autoComplete="new-password" className="form-input" minLength={8} onChange={(event) => update("password", event.target.value)} required type="password" value={form.password} />
            </Field>
            <Field label={t("auth", "confirmPassword")}>
              <input autoComplete="new-password" className="form-input" minLength={8} onChange={(event) => update("confirmation", event.target.value)} required type="password" value={form.confirmation} />
            </Field>
          </div>

          <p className="text-xs leading-5 text-muted">{t("auth", "passwordRequirements")}</p>
          {error ? <p className="rounded-2xl bg-[var(--ds-danger-soft)] px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

          <button className="button-primary mt-1 w-full disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("auth", "creatingAccount") : t("auth", "createAccount")}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          {t("auth", "alreadyHaveAccount")} {" "}
          <Link className="focus-ring rounded-full px-1 font-bold text-primary hover:text-[var(--ds-primary-hover)]" href="/signin">{t("auth", "signIn")}</Link>
        </p>
      </section>
    </main>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-medium text-foreground"><span>{label}</span>{children}</label>;
}