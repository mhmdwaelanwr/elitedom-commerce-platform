"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError } from "@/lib/api";
import { fetchAuthSessions, logoutAllSessions, revokeAuthSession, type AuthDeviceSession } from "@/lib/auth-api";
import { formatDate } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

export default function AccountSecurityPage() {
  const router = useRouter();
  const { locale, t } = usePreferences();
  const { notify, session, setSession } = useStore();
  const [sessions, setSessions] = useState<AuthDeviceSession[]>([]);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [isLoggingOutAll, setLoggingOutAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchAuthSessions(session)
        .then((result) => { if (!cancelled) setSessions(result); })
        .catch((requestError: unknown) => {
          if (!cancelled) setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [session, t]);

  if (!session) {
    return (
      <main className="site-container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-primary" aria-hidden="true"><ShieldIcon /></span>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-foreground">{t("auth", "securityTitle")}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{t("account", "signInText")}</p>
          <Link className="button-primary mt-6" href="/signin?next=/account/security">{t("auth", "signIn")}</Link>
        </div>
      </main>
    );
  }

  async function handleRevoke(target: AuthDeviceSession) {
    const activeSession = session;
    if (!activeSession) return;
    setBusySessionId(target.id);
    setError(null);
    try {
      await revokeAuthSession(target.id, activeSession);
      notify(t("auth", "sessionRevoked"), "info");
      if (target.current) {
        setSession(null);
        router.replace("/signin");
        return;
      }
      setSessions((current) => current.filter((item) => item.id !== target.id));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally {
      setBusySessionId(null);
    }
  }

  async function handleLogoutAll() {
    const activeSession = session;
    if (!activeSession) return;
    setLoggingOutAll(true);
    setError(null);
    try {
      await logoutAllSessions(activeSession);
      notify(t("auth", "allSessionsRevoked"), "info");
      setSession(null);
      router.replace("/signin");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally {
      setLoggingOutAll(false);
    }
  }

  return (
    <main className="site-container py-8 sm:py-12 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-8">
        <div>
          <p className="text-sm font-bold text-primary">{t("auth", "accountAccess")}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("auth", "securityTitle")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{t("auth", "securityDescription")}</p>
        </div>
        <button className="button-secondary disabled:cursor-wait disabled:opacity-60" disabled={isLoggingOutAll} onClick={handleLogoutAll} type="button">{isLoggingOutAll ? t("auth", "signingOut") : t("auth", "logoutAllDevices")}</button>
      </div>

      {error ? <p className="mt-6 rounded-2xl bg-[var(--ds-danger-soft)] px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

      <section className="mt-9">
        <h2 className="text-2xl font-bold tracking-[-0.025em] text-foreground">{t("auth", "activeSessions")}</h2>

        {isLoading ? (
          <p className="mt-5 rounded-2xl bg-elevated p-8 text-center text-sm text-muted">{t("auth", "loadingSessions")}</p>
        ) : sessions.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-elevated p-8 text-center text-sm text-muted">{t("auth", "noSessions")}</p>
        ) : (
          <div className="mt-5 divide-y divide-border border-y border-border">
            {sessions.map((item) => (
              <article className="grid gap-5 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" key={item.id}>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-elevated text-primary" aria-hidden="true"><DeviceIcon /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-foreground">{item.user_agent || t("auth", "unknownDevice")}</p>
                    {item.current ? <span className="rounded-full bg-[var(--ds-success-soft)] px-2.5 py-1 text-xs font-bold text-success">{t("auth", "currentSession")}</span> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted">{item.auth_method.replaceAll("_", " ")} · {item.ip_address || "—"}</p>
                  <p className="mt-1 text-xs text-muted">{t("auth", "createdAt")}: {formatDate(item.created_at, locale)} · {t("auth", "lastUsedAt")}: {item.last_used_at ? formatDate(item.last_used_at, locale) : "—"}</p>
                </div>
                <button className="button-secondary min-h-10 px-4 py-2 text-xs disabled:cursor-wait disabled:opacity-60" disabled={busySessionId === item.id} onClick={() => handleRevoke(item)} type="button">
                  {busySessionId === item.id ? t("auth", "revokingSession") : t("auth", "revokeSession")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ShieldIcon() {
  return <svg fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}
function DeviceIcon() {
  return <svg fill="none" height="20" viewBox="0 0 24 24" width="20"><rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="4" /><path d="M9 20h6M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}