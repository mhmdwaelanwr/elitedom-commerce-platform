"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
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
        .then((result) => { if (!cancelled) setSessions(result); })
        .catch((requestError: unknown) => {
          if (!cancelled) setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [session, t]);

  if (!session) return <SignInPrompt />;

  async function handleRevoke(target: AuthDeviceSession) {
    const activeSession = session;
    if (!activeSession) return;
    setBusySessionId(target.id); setError(null);
    try {
      await revokeAuthSession(target.id, activeSession);
      notify(t("auth", "sessionRevoked"), "info");
      if (target.current) { setSession(null); router.replace("/signin"); return; }
      setSessions((current) => current.filter((item) => item.id !== target.id));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally { setBusySessionId(null); }
  }

  async function handleLogoutAll() {
    const activeSession = session;
    if (!activeSession) return;
    setLoggingOutAll(true); setError(null);
    try {
      await logoutAllSessions(activeSession);
      notify(t("auth", "allSessionsRevoked"), "info");
      setSession(null); router.replace("/signin");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("auth", "genericSignInError"));
    } finally { setLoggingOutAll(false); }
  }

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted"><Link className="focus-ring rounded-md hover:text-foreground" href="/account">{t("account", "title")}</Link><span aria-hidden="true">/</span><span className="text-foreground">{t("auth", "securityTitle")}</span></nav>

      <div className="mt-6 grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-10">
        <SettingsNav />
        <div className="min-w-0">
          <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="section-kicker">{t("auth", "accountAccess")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("auth", "securityTitle")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("auth", "securityDescription")}</p></div>
            <button className="button-secondary w-fit border-danger/30 text-sm text-danger disabled:cursor-wait disabled:opacity-60" disabled={isLoggingOutAll} onClick={handleLogoutAll} type="button"><LogoutIcon/>{isLoggingOutAll ? t("auth", "signingOut") : t("auth", "logoutAllDevices")}</button>
          </header>

          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <SecurityFact icon={<ShieldIcon/>} label={t("auth", "activeSessions")} value={isLoading ? "…" : String(sessions.length)} />
            <SecurityFact icon={<CurrentDeviceIcon/>} label={t("auth", "currentSession")} value={sessions.some((item) => item.current) ? "✓" : "—"} />
            <SecurityFact icon={<LockIcon/>} label={t("auth", "accountAccess")} value="Protected" />
          </section>

          {error && <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><AlertIcon/><span>{error}</span></div>}

          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6"><span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary"><DevicesIcon/></span><h2 className="font-black text-foreground">{t("auth", "activeSessions")}</h2></div>
            {isLoading ? (
              <div className="grid gap-0">{[1,2].map((item)=><div className="h-28 animate-pulse border-b border-border bg-surface last:border-0" key={item}/>)}</div>
            ) : sessions.length === 0 ? (
              <div className="px-6 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-elevated text-muted"><DevicesIcon/></span><p className="mt-4 text-sm text-muted">{t("auth", "noSessions")}</p></div>
            ) : (
              <div>
                {sessions.map((item) => <SessionRow busy={busySessionId === item.id} item={item} key={item.id} locale={locale} onRevoke={handleRevoke} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ busy, item, locale, onRevoke }: { busy: boolean; item: AuthDeviceSession; locale: "en" | "ar"; onRevoke: (target: AuthDeviceSession) => void }) {
  const { t } = usePreferences();
  return <article className={`grid gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${item.current ? "bg-[var(--ds-soft-primary)]/40" : ""}`}>
    <span className={`grid h-11 w-11 place-items-center rounded-xl ${item.current ? "bg-primary text-primary-contrast" : "bg-elevated text-muted"}`}><DeviceIcon userAgent={item.user_agent}/></span>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-foreground">{friendlyDevice(item.user_agent, t("auth", "unknownDevice"))}</p>{item.current && <span className="rounded-full bg-[var(--ds-soft-success)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-success">{t("auth", "currentSession")}</span>}</div>
      <p className="mt-1 truncate text-xs text-muted">{item.user_agent || t("auth", "unknownDevice")}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted"><span>{item.auth_method.replaceAll("_", " ")}</span><span>{item.ip_address || "—"}</span><span>{t("auth", "createdAt")}: {formatDate(item.created_at, locale)}</span><span>{t("auth", "lastUsedAt")}: {item.last_used_at ? formatDate(item.last_used_at, locale) : "—"}</span></div>
    </div>
    <button className={`focus-ring w-fit rounded-lg border px-3 py-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-50 ${item.current ? "border-danger/30 text-danger hover:bg-danger/10" : "border-border text-muted hover:border-danger/35 hover:text-danger"}`} disabled={busy} onClick={() => onRevoke(item)} type="button">{busy ? t("auth", "revokingSession") : t("auth", "revokeSession")}</button>
  </article>;
}
function friendlyDevice(userAgent: string | null | undefined, fallback: string) { if (!userAgent) return fallback; const ua=userAgent.toLowerCase(); const browser=ua.includes("edg")?"Edge":ua.includes("chrome")?"Chrome":ua.includes("firefox")?"Firefox":ua.includes("safari")?"Safari":"Browser"; const os=ua.includes("windows")?"Windows":ua.includes("android")?"Android":ua.includes("iphone")||ua.includes("ipad")?"iOS":ua.includes("mac os")?"macOS":ua.includes("linux")?"Linux":"Device"; return `${browser} · ${os}`; }
function DeviceIcon({ userAgent }: { userAgent?: string | null }) { const mobile=Boolean(userAgent && /(iphone|android|mobile|ipad)/i.test(userAgent)); return mobile ? <PhoneIcon/> : <DesktopIcon/>; }
function SecurityFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <article className="rounded-xl border border-border bg-surface p-4"><span className="text-primary">{icon}</span><p className="mt-3 text-xs font-bold text-muted">{label}</p><p className="mt-1 text-lg font-black text-foreground">{value}</p></article>; }
function SettingsNav() { const { t }=usePreferences(); const links=[{href:"/account/profile",label:t("account","personalDetails"),icon:<UserIcon/>},{href:"/account/addresses",label:t("account","savedAddresses"),icon:<LocationIcon/>},{href:"/account/security",label:t("auth","securityTitle"),icon:<ShieldIcon/>,active:true}]; return <aside className="h-fit rounded-2xl border border-border bg-surface p-2 lg:sticky lg:top-28">{links.map((link)=><Link className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition ${link.active?"bg-[var(--ds-soft-primary)] text-primary":"text-muted hover:bg-elevated hover:text-foreground"}`} href={link.href} key={link.href}>{link.icon}{link.label}</Link>)}</aside>; }
function SignInPrompt(){const {t}=usePreferences();return <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center"><section className="w-full max-w-lg"><span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary"><ShieldIcon large/></span><h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("auth","securityTitle")}</h1><p className="mt-3 text-sm text-muted">{t("account","signInText")}</p><Link className="button-primary mt-6" href="/signin?next=/account/security">{t("auth","signIn")}</Link></section></div>;}
function ShieldIcon({large=false}:{large?:boolean}){const s=large?32:18;return <svg aria-hidden="true" fill="none" height={s} viewBox="0 0 24 24" width={s}><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>;} function UserIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 20c.8-3.2 3.3-5.2 7-5.2s6.2 2 7 5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;} function LocationIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>;} function DevicesIcon(){return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19"><rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="17" x="2" y="4"/><path d="M7 20h10M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/><rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="6" x="16" y="10"/></svg>;} function CurrentDeviceIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="4"/><path d="m8 11 2.5 2.5L16 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>;} function LockIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="10"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;} function LogoutIcon(){return <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>;} function DesktopIcon(){return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><rect height="13" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="3"/><path d="M8 21h8M12 16v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;} function PhoneIcon(){return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><rect height="20" rx="3" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="2"/><path d="M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;} function AlertIcon(){return <svg aria-hidden="true" className="mt-0.5 shrink-0" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>;}
