"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError } from "@/lib/api";
import {
  fetchAuthSessions,
  logoutAllSessions,
  revokeAuthSession,
  type AuthDeviceSession,
} from "@/lib/auth-api";
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
        .then((result) => {
          if (!cancelled) setSessions(result);
        })
        .catch((requestError: unknown) => {
          if (!cancelled) {
            setError(
              requestError instanceof ApiError
                ? requestError.message
                : t("auth", "genericSignInError"),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session, t]);

  if (!session) {
    return (
      <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
        <div>
          <h1 className="text-3xl font-black text-foreground">
            {t("auth", "securityTitle")}
          </h1>
          <p className="mt-3 text-sm text-muted">{t("account", "signInText")}</p>
          <Link className="button-primary mt-6" href="/signin?next=/account/security">
            {t("auth", "signIn")}
          </Link>
        </div>
      </div>
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
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "genericSignInError"),
      );
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
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : t("auth", "genericSignInError"),
      );
    } finally {
      setLoggingOutAll(false);
    }
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="section-kicker">{t("auth", "accountAccess")}</p>
          <h1 className="mt-2 text-3xl font-black text-foreground">
            {t("auth", "securityTitle")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {t("auth", "securityDescription")}
          </p>
        </div>
        <button
          className="button-secondary text-sm disabled:cursor-wait disabled:opacity-60"
          disabled={isLoggingOutAll}
          onClick={handleLogoutAll}
          type="button"
        >
          {isLoggingOutAll ? t("auth", "signingOut") : t("auth", "logoutAllDevices")}
        </button>
      </div>

      {error && (
        <p
          className="mt-6 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border bg-elevated px-5 py-4">
          <h2 className="font-black text-foreground">{t("auth", "activeSessions")}</h2>
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted">
            {t("auth", "loadingSessions")}
          </p>
        ) : sessions.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{t("auth", "noSessions")}</p>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((item) => (
              <article
                className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-foreground">
                      {item.user_agent || t("auth", "unknownDevice")}
                    </p>
                    {item.current && (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                        {t("auth", "currentSession")}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {item.auth_method.replaceAll("_", " ")} · {item.ip_address || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("auth", "createdAt")}: {formatDate(item.created_at, locale)} · {" "}
                    {t("auth", "lastUsedAt")}: {item.last_used_at
                      ? formatDate(item.last_used_at, locale)
                      : "—"}
                  </p>
                </div>
                <button
                  className="button-secondary text-sm disabled:cursor-wait disabled:opacity-60"
                  disabled={busySessionId === item.id}
                  onClick={() => handleRevoke(item)}
                  type="button"
                >
                  {busySessionId === item.id
                    ? t("auth", "revokingSession")
                    : t("auth", "revokeSession")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
