"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, register } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", mobile: "+20", password: "", confirmation: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmation) { setError("The passwords do not match."); return; }
    setSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, mobile: form.mobile, password: form.password });
      router.replace(`/signin?email=${encodeURIComponent(form.email)}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not create your account. Please try again.");
    } finally { setSubmitting(false); }
  }

  return <div className="site-container grid min-h-[calc(100vh-14rem)] place-items-center py-10"><section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8"><Link className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/">← Back to store</Link><p className="section-kicker mt-8">Create your Elitedom account</p><h1 className="mt-2 text-3xl font-black text-white">Purchase with confidence</h1><p className="mt-3 text-sm leading-6 text-slate-400">Track orders, save addresses, collect loyalty points, and manage digital warranty requests.</p><form className="mt-7 grid gap-5" onSubmit={handleSubmit}><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name"><input autoComplete="name" className="form-input" minLength={2} onChange={(event) => update("name", event.target.value)} required value={form.name} /></Field><Field label="Egyptian mobile"><input autoComplete="tel" className="form-input" onChange={(event) => update("mobile", event.target.value)} placeholder="+2010…" required type="tel" value={form.mobile} /></Field></div><Field label="Email address"><input autoComplete="email" className="form-input" onChange={(event) => update("email", event.target.value)} required type="email" value={form.email} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Password"><input autoComplete="new-password" className="form-input" minLength={8} onChange={(event) => update("password", event.target.value)} required type="password" value={form.password} /></Field><Field label="Confirm password"><input autoComplete="new-password" className="form-input" minLength={8} onChange={(event) => update("confirmation", event.target.value)} required type="password" value={form.confirmation} /></Field></div><p className="text-xs leading-5 text-slate-500">Use 8+ characters with uppercase, lowercase, a number, and a special character.</p>{error && <p className="rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}<button className="button-primary mt-1 w-full disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account…" : "Create account"}</button></form><p className="mt-6 text-center text-sm text-slate-400">Already have an account? <Link className="font-bold text-sky-300 hover:text-white focus-ring" href="/signin">Sign in</Link></p></section></div>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="grid gap-2 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>; }
