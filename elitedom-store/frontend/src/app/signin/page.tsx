"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ApiError, login } from "@/lib/api";
import { useStore } from "@/components/store/StoreProvider";

export default function SignInPage() {
  return <Suspense fallback={<SignInLoadingFallback />}><SignInForm /></Suspense>;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify, setSession } = useStore();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login({ email, password });
      setSession(session);
      notify("Welcome back to Elitedom.");
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthShell title="Welcome back" description="Sign in to see your orders, saved addresses, loyalty balance, and warranty history."><form className="mt-7 grid gap-5" onSubmit={handleSubmit}><Field label="Email address"><input autoComplete="email" className="form-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></Field><Field label="Password"><input autoComplete="current-password" className="form-input" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></Field>{error && <p className="rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}<button className="button-primary mt-1 w-full disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in securely"}</button></form><p className="mt-6 text-center text-sm text-slate-400">New to Elitedom? <Link className="font-bold text-sky-300 hover:text-white focus-ring" href="/signup">Create an account</Link></p><div className="mt-7 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-5 text-slate-400">Google and Apple sign-in are supported by the API when the relevant OAuth provider is configured. Use email sign-in during local setup.</div></AuthShell>;
}

function AuthShell({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <div className="site-container grid min-h-[calc(100vh-14rem)] place-items-center py-10"><section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8"><Link className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/">← Back to store</Link><p className="section-kicker mt-8">Account access</p><h1 className="mt-2 text-3xl font-black text-white">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>{children}</section></div>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>;
}

function SignInLoadingFallback() {
  return <div className="site-container grid min-h-[calc(100vh-14rem)] place-items-center py-10"><div className="h-96 w-full max-w-md animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" /></div>;
}
