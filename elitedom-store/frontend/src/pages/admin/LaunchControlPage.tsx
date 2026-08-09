import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { fetchAdminAccess } from "@/lib/admin-api";
import { fetchMfaStatus } from "@/lib/auth-api";
import { restoreSession } from "@/lib/auth-session";
import "@/styles/admin-console.css";

const launchControlContract = {
  requiredPermission: "config.manage",
  releaseRef: "required",
  evidenceRef: "required",
  runtimeAssertion: "not inferred by the browser",
} as const;

type PageState = "loading" | "ready" | "denied" | "error";

export function LaunchControlPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (session) => {
      if (!active) return;
      if (!session) {
        navigate(`/auth?next=${encodeURIComponent("/admin/launch")}`, { replace: true });
        return;
      }
      try {
        const [access, mfa] = await Promise.all([
          fetchAdminAccess(session),
          fetchMfaStatus(session),
        ]);
        if (!active) return;
        if (!access.permissions.includes("config.manage") || (mfa.required && !mfa.verified)) {
          setState("denied");
          return;
        }
        setState("ready");
      } catch (reason) {
        if (!active) return;
        const status = typeof reason === "object" && reason && "status" in reason
          ? Number((reason as { status?: number }).status)
          : 0;
        if (status === 401 || status === 403) setState("denied");
        else {
          setError(reason instanceof Error ? reason.message : "Launch control could not be loaded.");
          setState("error");
        }
      }
    });
    return () => { active = false; };
  }, [navigate]);

  if (state !== "ready") {
    return (
      <main className="el-admin-gate">
        <ElitedomBrand />
        <StoreIcon name={state === "denied" ? "lock" : "shield"} size={34} />
        <h1>{state === "loading" ? "Verifying launch-control access…" : state === "denied" ? "Launch control requires config.manage and a verified MFA session." : error}</h1>
        {state !== "loading" ? <Link to="/admin">Back to operations</Link> : null}
      </main>
    );
  }

  return (
    <main className="el-launch-control-page">
      <header>
        <div><ElitedomBrand compact /><p className="el-eyebrow">ELITEDOM OPS / RELEASE CONTROL</p></div>
        <Link to="/admin">Back to operations</Link>
      </header>
      <section>
        <StoreIcon name="shield" size={34} />
        <h1>Launch control</h1>
        <p>
          This browser surface intentionally does not claim that a deployment, provider, or environment is healthy without release evidence. Promotion remains governed by the repository release workflow and its recorded evidence.
        </p>
        <dl>
          <div><dt>Write permission</dt><dd>{launchControlContract.requiredPermission}</dd></div>
          <div><dt>Release reference</dt><dd>{launchControlContract.releaseRef}</dd></div>
          <div><dt>Evidence reference</dt><dd>{launchControlContract.evidenceRef}</dd></div>
          <div><dt>Runtime status</dt><dd>{launchControlContract.runtimeAssertion}</dd></div>
        </dl>
      </section>
    </main>
  );
}