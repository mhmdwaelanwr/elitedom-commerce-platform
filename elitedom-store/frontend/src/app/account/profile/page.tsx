"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError, fetchCustomerProfile, updateCustomerProfile } from "@/lib/api";
import { GOVERNORATES } from "@/lib/checkout";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  governorate: string;
  streetAddress: string;
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  email: "",
  phone: "+20",
  governorate: "",
  streetAddress: "",
};

function publicEmail(email: string) {
  return email.endsWith("@phone.elitedom.local") ? "" : email;
}

export default function ProfilePage() {
  const { t } = usePreferences();
  const { notify, session, setSession } = useStore();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchCustomerProfile(session)
      .then((profile) => {
        if (!active) return;
        setForm({
          name: profile.name,
          email: publicEmail(profile.email),
          phone: profile.phone,
          governorate: profile.governorate ?? "",
          streetAddress: profile.street_address ?? "",
        });
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof ApiError ? requestError.message : t("account", "profileLoadError"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, t]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const normalizedEmail = form.email.trim();
      const updated = await updateCustomerProfile(
        {
          name: form.name,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          phone: form.phone,
          ...(form.governorate.trim() ? { governorate: form.governorate.trim() } : {}),
          ...(form.streetAddress.trim() ? { street_address: form.streetAddress.trim() } : {}),
        },
        session,
      );
      setForm((current) => ({ ...current, email: publicEmail(updated.email) }));
      setSession({
        ...session,
        email: publicEmail(updated.email) || undefined,
        name: updated.name,
        role: updated.role,
      });
      notify(t("account", "profileUpdated"));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("account", "profileUpdateError"));
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <SignInPrompt />;

  return (
    <div className="site-container py-8 sm:py-12">
      <Breadcrumb current={t("account", "personalDetails")} />
      <div className="mt-6 max-w-2xl">
        <p className="section-kicker">{t("account", "settings")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{t("account", "personalDetails")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{t("account", "personalDetailsDescription")}</p>
      </div>

      <form className="mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-5 sm:p-7" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("account", "fullName")}>
            <input
              autoComplete="name"
              className="form-input"
              disabled={isLoading || isSaving}
              onChange={(event) => update("name", event.target.value)}
              required
              value={form.name}
            />
          </Field>
          <Field label={t("account", "email")}>
            <input
              autoComplete="email"
              className="form-input"
              disabled={isLoading || isSaving}
              onChange={(event) => update("email", event.target.value)}
              type="email"
              value={form.email}
            />
          </Field>
          <Field label={t("account", "mobileNumber")}>
            <input
              autoComplete="tel"
              className="form-input"
              disabled={isLoading || isSaving}
              onChange={(event) => update("phone", event.target.value)}
              required
              type="tel"
              value={form.phone}
            />
          </Field>
          <Field label={t("account", "preferredGovernorate")}>
            <select
              className="form-input"
              disabled={isLoading || isSaving}
              onChange={(event) => update("governorate", event.target.value)}
              value={form.governorate}
            >
              <option value="">{t("account", "governoratePlaceholder")}</option>
              {GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t("account", "defaultStreetAddress")}>
          <textarea
            autoComplete="street-address"
            className="form-input min-h-28 resize-y"
            disabled={isLoading || isSaving}
            onChange={(event) => update("streetAddress", event.target.value)}
            placeholder={t("account", "addressPlaceholder")}
            value={form.streetAddress}
          />
        </Field>

        {error && (
          <p className="mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="button-primary disabled:cursor-wait disabled:opacity-70" disabled={isLoading || isSaving} type="submit">
            {isSaving ? t("account", "saving") : isLoading ? t("account", "loading") : t("account", "saveDetails")}
          </button>
          <Link className="button-secondary" href="/account/addresses">
            {t("account", "manageAddresses")}
          </Link>
        </div>
      </form>
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  const { t } = usePreferences();
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
      <Link className="focus-ring rounded-md hover:text-foreground" href="/account">
        {t("account", "title")}
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SignInPrompt() {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-3xl text-primary">◌</div>
        <h1 className="mt-4 text-3xl font-black text-foreground">{t("account", "signInManageDetails")}</h1>
        <p className="mt-3 text-sm text-muted">{t("account", "profileSecureText")}</p>
        <Link className="button-primary mt-6" href="/signin?next=/account/profile">
          {t("account", "signIn")}
        </Link>
      </div>
    </div>
  );
}
