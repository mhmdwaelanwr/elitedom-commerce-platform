"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError, fetchCustomerProfile, updateCustomerProfile } from "@/lib/api";
import { GOVERNORATES } from "@/lib/checkout";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type ProfileForm = { name: string; email: string; phone: string; governorate: string; streetAddress: string };
const EMPTY_FORM: ProfileForm = { name: "", email: "", phone: "+20", governorate: "", streetAddress: "" };
function publicEmail(email: string) { return email.endsWith("@phone.elitedom.local") ? "" : email; }

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
        setForm({ name: profile.name, email: publicEmail(profile.email), phone: profile.phone, governorate: profile.governorate ?? "", streetAddress: profile.street_address ?? "" });
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof ApiError ? requestError.message : t("account", "profileLoadError"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, t]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const normalizedEmail = form.email.trim();
      const updated = await updateCustomerProfile({ name: form.name, ...(normalizedEmail ? { email: normalizedEmail } : {}), phone: form.phone, ...(form.governorate.trim() ? { governorate: form.governorate.trim() } : {}), ...(form.streetAddress.trim() ? { street_address: form.streetAddress.trim() } : {}) }, session);
      setForm((current) => ({ ...current, email: publicEmail(updated.email) }));
      setSession({ ...session, email: publicEmail(updated.email) || undefined, name: updated.name, role: updated.role });
      notify(t("account", "profileUpdated"));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("account", "profileUpdateError"));
    } finally { setSaving(false); }
  }

  if (!session) return <SignInPrompt />;

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
      <Breadcrumb current={t("account", "personalDetails")} />
      <div className="mt-6 grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-10">
        <AccountSettingsNav active="profile" />
        <div className="min-w-0">
          <header className="border-b border-border pb-6">
            <p className="section-kicker">{t("account", "settings")}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("account", "personalDetails")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("account", "personalDetailsDescription")}</p>
          </header>

          <form className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface" onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary"><UserIcon /></span>
              <h2 className="font-black text-foreground">{t("account", "personalDetails")}</h2>
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("account", "fullName")}><input autoComplete="name" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("name", event.target.value)} required value={form.name} /></Field>
                <Field label={t("account", "email")}><input autoComplete="email" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("email", event.target.value)} type="email" value={form.email} /></Field>
                <Field label={t("account", "mobileNumber")}><input autoComplete="tel" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("phone", event.target.value)} required type="tel" value={form.phone} /></Field>
                <Field label={t("account", "preferredGovernorate")}><select className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("governorate", event.target.value)} value={form.governorate}><option value="">{t("account", "governoratePlaceholder")}</option>{GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}</select></Field>
              </div>

              <Field label={t("account", "defaultStreetAddress")}><textarea autoComplete="street-address" className="form-input min-h-28 resize-y" disabled={isLoading || isSaving} onChange={(event) => update("streetAddress", event.target.value)} placeholder={t("account", "addressPlaceholder")} value={form.streetAddress} /></Field>

              {error && <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><AlertIcon /><span>{error}</span></div>}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-elevated px-5 py-4 sm:px-6">
              <button className="button-primary disabled:cursor-wait disabled:opacity-65" disabled={isLoading || isSaving} type="submit">{isSaving ? t("account", "saving") : isLoading ? t("account", "loading") : t("account", "saveDetails")}</button>
              <Link className="button-secondary" href="/account/addresses">{t("account", "manageAddresses")}</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AccountSettingsNav({ active }: { active: "profile" | "addresses" | "security" }) {
  const { t } = usePreferences();
  const links = [
    { key: "profile" as const, href: "/account/profile", label: t("account", "personalDetails"), icon: <UserIcon /> },
    { key: "addresses" as const, href: "/account/addresses", label: t("account", "savedAddresses"), icon: <LocationIcon /> },
    { key: "security" as const, href: "/account/security", label: t("auth", "securityTitle"), icon: <ShieldIcon /> },
  ];
  return <aside className="h-fit rounded-2xl border border-border bg-surface p-2 lg:sticky lg:top-28">{links.map((link) => <Link className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition ${active === link.key ? "bg-[var(--ds-soft-primary)] text-primary" : "text-muted hover:bg-elevated hover:text-foreground"}`} href={link.href} key={link.key}><span className="shrink-0">{link.icon}</span>{link.label}</Link>)}</aside>;
}
function Breadcrumb({ current }: { current: string }) { const { t } = usePreferences(); return <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted"><Link className="focus-ring rounded-md hover:text-foreground" href="/account">{t("account", "title")}</Link><span aria-hidden="true">/</span><span className="text-foreground">{current}</span></nav>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="mt-5 grid gap-2 text-sm font-bold text-foreground"><span>{label}</span>{children}</label>; }
function SignInPrompt() { const { t } = usePreferences(); return <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center"><section className="w-full max-w-lg"><span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary"><UserIcon large /></span><h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("account", "signInManageDetails")}</h1><p className="mt-3 text-sm text-muted">{t("account", "profileSecureText")}</p><Link className="button-primary mt-6" href="/signin?next=/account/profile">{t("account", "signIn")}</Link></section></div>; }
function UserIcon({ large = false }: { large?: boolean }) { const s = large ? 32 : 18; return <svg aria-hidden="true" fill="none" height={s} viewBox="0 0 24 24" width={s}><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 20c.8-3.2 3.3-5.2 7-5.2s6.2 2 7 5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>; }
function LocationIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>; }
function ShieldIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>; }
function AlertIcon() { return <svg aria-hidden="true" className="mt-0.5 shrink-0" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>; }
