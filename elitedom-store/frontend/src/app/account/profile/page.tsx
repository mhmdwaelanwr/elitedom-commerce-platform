"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, fetchCustomerProfile, updateCustomerProfile } from "@/lib/api";
import { useStore } from "@/components/store/StoreProvider";

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

export default function ProfilePage() {
  const { notify, session, setSession } = useStore();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchCustomerProfile(session)
      .then((profile) => {
        if (!active) return;
        setForm({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          governorate: profile.governorate ?? "",
          streetAddress: profile.street_address ?? "",
        });
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof ApiError ? requestError.message : "We could not load your profile.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateCustomerProfile(
        {
          name: form.name,
          email: form.email,
          phone: form.phone,
          ...(form.governorate.trim() ? { governorate: form.governorate.trim() } : {}),
          ...(form.streetAddress.trim() ? { street_address: form.streetAddress.trim() } : {}),
        },
        session,
      );
      setSession({ ...session, email: updated.email, name: updated.name, role: updated.role });
      notify("Your account details were updated.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return <SignInPrompt />;
  }

  return (
    <div className="site-container py-10 sm:py-14">
      <Breadcrumb current="Personal details" />
      <div className="mt-6 max-w-2xl">
        <p className="section-kicker">Account settings</p>
        <h1 className="mt-2 text-3xl font-black text-white">Personal details</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Keep the contact details used for support, order updates, and saved delivery preferences accurate.</p>
      </div>
      <form className="mt-8 max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-7" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name"><input autoComplete="name" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("name", event.target.value)} required value={form.name} /></Field>
          <Field label="Email"><input autoComplete="email" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} /></Field>
          <Field label="Mobile number"><input autoComplete="tel" className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("phone", event.target.value)} required type="tel" value={form.phone} /></Field>
          <Field label="Preferred governorate"><input className="form-input" disabled={isLoading || isSaving} onChange={(event) => update("governorate", event.target.value)} placeholder="Cairo" value={form.governorate} /></Field>
        </div>
        <Field label="Default street address"><textarea autoComplete="street-address" className="form-input min-h-28 resize-y" disabled={isLoading || isSaving} onChange={(event) => update("streetAddress", event.target.value)} placeholder="Building, street, area, city" value={form.streetAddress} /></Field>
        {error && <p className="mt-5 rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3"><button className="button-primary disabled:cursor-wait disabled:opacity-70" disabled={isLoading || isSaving} type="submit">{isSaving ? "Saving…" : isLoading ? "Loading…" : "Save details"}</button><Link className="button-secondary" href="/account/addresses">Manage addresses</Link></div>
      </form>
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/account">Account</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">{current}</span></nav>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>;
}

function SignInPrompt() {
  return <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center"><div><p className="text-4xl">◌</p><h1 className="mt-4 text-3xl font-black text-white">Sign in to manage your details</h1><p className="mt-3 text-sm text-slate-400">Your profile is available securely from your Elitedom account.</p><Link className="button-primary mt-6" href="/signin?next=/account/profile">Sign in</Link></div></div>;
}
