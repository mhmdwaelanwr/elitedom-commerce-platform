import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { fetchAdminAccess, type AdminPermission } from "@/lib/admin-api";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  fetchMfaStatus,
  verifyMfa,
  type MfaEnrollment,
  type MfaStatus,
} from "@/lib/auth-api";
import { restoreSession } from "@/lib/auth-session";
import type { CustomerSession } from "@/types/store";
import "@/styles/p20-completeness.css";

type GateState = "loading" | "mfa" | "ready" | "denied" | "error";

export function AdminSecureRoute({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const [locale] = useStoreLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<GateState>("loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [error, setError] = useState("");

  const resolvePermission = useCallback(async (current: CustomerSession) => {
    try {
      const access = await fetchAdminAccess(current);
      setState(access.permissions.includes(permission) ? "ready" : "denied");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Staff access could not be verified.");
      setState("error");
    }
  }, [permission]);

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active) return;
      if (!current) {
        navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
        return;
      }
      setSession(current);
      try {
        // The MFA status endpoint is deliberately available before the privileged
        // permission endpoint. Production permission checks require a verified
        // staff session, so resolve MFA first and only then query RBAC.
        const status = await fetchMfaStatus(current);
        if (!active) return;
        setMfa(status);
        if (status.required && !status.verified) {
          setState("mfa");
          return;
        }
        const access = await fetchAdminAccess(current);
        if (!active) return;
        setState(access.permissions.includes(permission) ? "ready" : "denied");
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Staff access could not be verified.");
        setState("error");
      }
    });
    return () => { active = false; };
  }, [location.pathname, location.search, navigate, permission]);

  if (state === "ready") return <>{children}</>;
  if (state === "mfa" && session && mfa) {
    return <AdminMfaBoundary locale={locale} mfa={mfa} onVerified={() => void resolvePermission(session)} session={session} />;
  }

  const ar = locale === "ar";
  return (
    <main className="el-p20-gate" dir={ar ? "rtl" : "ltr"} lang={locale}>
      <div className="el-p20-gate__card">
        <ElitedomBrand />
        <StoreIcon name={state === "denied" ? "lock" : "shield"} size={34} />
        <h1>{state === "loading" ? (ar ? "جارٍ التحقق من صلاحيات الإدارة…" : "Checking staff access…") : state === "denied" ? (ar ? "ليس لديك صلاحية لهذه الواجهة" : "You do not have access to this surface") : (ar ? "تعذر التحقق من الوصول" : "Staff access could not be verified")}</h1>
        {error ? <p role="alert">{error}</p> : null}
        {state !== "loading" ? <Link to="/admin">{ar ? "العودة للوحة الإدارة" : "Back to operations"}</Link> : null}
        <ThemeToggle locale={locale} />
      </div>
    </main>
  );
}

function AdminMfaBoundary({ locale, mfa, session, onVerified }: {
  locale: "en" | "ar";
  mfa: MfaStatus;
  session: CustomerSession;
  onVerified: () => void;
}) {
  const ar = locale === "ar";
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setPending(true);
    setError("");
    try { setEnrollment(await beginMfaEnrollment(session)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "MFA setup failed."); }
    finally { setPending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    if (!code) return;
    setPending(true);
    setError("");
    try {
      if (!mfa.enrolled) {
        const result = await confirmMfaEnrollment(code, session);
        setRecoveryCodes(result.recoveryCodes);
        if (!result.recoveryCodes.length) onVerified();
      } else {
        const result = await verifyMfa(code, session);
        if (result.verified) onVerified();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="el-p20-gate" dir={ar ? "rtl" : "ltr"} lang={locale}>
      <section className="el-p20-gate__card">
        <ElitedomBrand />
        <StoreIcon name="shield" size={36} />
        <p className="el-p20-eyebrow">ADMIN / MFA</p>
        <h1>{recoveryCodes.length ? (ar ? "احفظ أكواد الاسترداد" : "Save your recovery codes") : (ar ? "التحقق بخطوتين مطلوب" : "Multi-factor verification required")}</h1>
        {recoveryCodes.length ? (
          <>
            <div className="el-p20-recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
            <button className="el-p20-primary" onClick={onVerified} type="button">{ar ? "تم الحفظ — متابعة" : "Saved — continue"}</button>
          </>
        ) : (
          <>
            {!mfa.enrolled && !enrollment ? <button className="el-p20-primary" disabled={pending} onClick={() => void begin()} type="button">{ar ? "بدء إعداد MFA" : "Begin MFA setup"}</button> : null}
            {enrollment ? <div className="el-p20-secret"><span>{ar ? "أضف المفتاح إلى تطبيق Authenticator" : "Add this key to your authenticator"}</span><code>{enrollment.secret}</code></div> : null}
            {mfa.enrolled || enrollment ? <form className="el-p20-form" onSubmit={submit}><label><span>{ar ? "كود التحقق" : "Verification code"}</span><input autoComplete="one-time-code" inputMode="numeric" name="code" required /></label>{error ? <p className="el-p20-error" role="alert">{error}</p> : null}<button className="el-p20-primary" disabled={pending} type="submit">{pending ? "…" : ar ? "تحقق" : "Verify"}</button></form> : null}
          </>
        )}
        <ThemeToggle locale={locale} />
      </section>
    </main>
  );
}
