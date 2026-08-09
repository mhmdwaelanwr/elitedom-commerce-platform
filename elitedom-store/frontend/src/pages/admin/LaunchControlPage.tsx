import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { fetchAdminAccess } from "@/lib/admin-api";
import {
  fetchLaunchReadiness,
  updateLaunchGate,
  type AdminLaunchGate,
  type AdminLaunchReadinessResponse,
  type LaunchAcceptanceStatus,
} from "@/lib/admin-control-api";
import { fetchMfaStatus } from "@/lib/auth-api";
import { restoreSession } from "@/lib/auth-session";
import type { CustomerSession } from "@/types/store";
import "@/styles/admin-console.css";
import "@/styles/launch-control.css";

const launchControlContract = {
  requiredPermission: "config.manage",
  releaseRef: "required",
  evidence_ref: "required",
  runtimeAssertion: "not inferred by the browser",
} as const;

type PageState = "loading" | "ready" | "denied" | "error";

export function LaunchControlPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [releaseRef, setReleaseRef] = useState("");
  const [readiness, setReadiness] = useState<AdminLaunchReadinessResponse | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [error, setError] = useState("");
  const [editingGate, setEditingGate] = useState<AdminLaunchGate | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then(async (current) => {
        if (!active) return;
        if (!current) {
          navigate(`/auth?next=${encodeURIComponent("/admin/launch")}`, { replace: true });
          return;
        }
        const [access, mfa] = await Promise.all([
          fetchAdminAccess(current),
          fetchMfaStatus(current),
        ]);
        if (!active) return;
        if (!access.permissions.includes("config.manage") || (mfa.required && !mfa.verified)) {
          setState("denied");
          return;
        }
        setSession(current);
        setState("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const status = typeof reason === "object" && reason && "status" in reason
          ? Number((reason as { status?: number }).status)
          : 0;
        if (status === 401 || status === 403) setState("denied");
        else {
          setError(reason instanceof Error ? reason.message : "Launch control could not be loaded.");
          setState("error");
        }
      });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!editingGate) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setEditingGate(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [editingGate]);

  async function loadRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !releaseRef.trim()) return;
    setLoadingReadiness(true);
    setError("");
    try {
      const current = await restoreSession() ?? session;
      setSession(current);
      setReadiness(await fetchLaunchReadiness(releaseRef.trim(), current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Release readiness could not be loaded.");
    } finally {
      setLoadingReadiness(false);
    }
  }

  async function saveGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !readiness || !editingGate) return;
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") || "pending") as LaunchAcceptanceStatus;
    const evidence_ref = String(form.get("evidence_ref") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    setLoadingReadiness(true);
    setError("");
    try {
      const current = await restoreSession() ?? session;
      setSession(current);
      const next = await updateLaunchGate(
        editingGate.key,
        readiness.release_ref,
        {
          status,
          evidence_ref: evidence_ref || null,
          notes: notes || null,
        },
        current,
      );
      setReadiness(next);
      setEditingGate(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Launch evidence could not be saved.");
    } finally {
      setLoadingReadiness(false);
    }
  }

  function keepDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? []).filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (state !== "ready" || !session) {
    return (
      <main className="el-admin-gate">
        <ElitedomBrand />
        <StoreIcon name={state === "denied" ? "lock" : "shield"} size={34} />
        <h1>
          {state === "loading"
            ? "Verifying launch-control access…"
            : state === "denied"
              ? "Launch control requires config.manage and a verified MFA session."
              : error || "Launch control could not be loaded."}
        </h1>
        {state !== "loading" ? <Link to="/admin">Back to operations</Link> : null}
      </main>
    );
  }

  return (
    <main className="el-launch-control-page">
      <header>
        <div>
          <ElitedomBrand compact />
          <span>
            <p className="el-eyebrow">ELITEDOM OPS / RELEASE CONTROL</p>
            <b>Evidence-backed launch readiness</b>
          </span>
        </div>
        <Link to="/admin">Back to operations</Link>
      </header>

      <section className="el-launch-control-intro">
        <StoreIcon name="shield" size={34} />
        <h1>Launch control</h1>
        <p>
          Release gates are scoped to an explicit release reference. The browser shows persisted
          configuration and operator evidence; it never invents provider health or carries evidence
          from one release into another.
        </p>
        <dl aria-label="Launch control contract">
          <div><dt>Write permission</dt><dd>{launchControlContract.requiredPermission}</dd></div>
          <div><dt>Release reference</dt><dd>{launchControlContract.releaseRef}</dd></div>
          <div><dt>Evidence reference</dt><dd>{launchControlContract.evidence_ref}</dd></div>
          <div><dt>Runtime status</dt><dd>{launchControlContract.runtimeAssertion}</dd></div>
        </dl>
      </section>

      <form className="el-launch-release-form" onSubmit={loadRelease}>
        <label>
          <span>Release reference</span>
          <input
            autoComplete="off"
            name="releaseRef"
            onChange={(event) => setReleaseRef(event.target.value)}
            placeholder="release-2026.08.09"
            required
            value={releaseRef}
          />
        </label>
        <button disabled={loadingReadiness} type="submit">
          {loadingReadiness ? "Loading…" : "Load readiness"}
        </button>
      </form>

      {error ? <p className="el-admin-error" role="alert">{error}</p> : null}

      {readiness ? (
        <section className="el-launch-readiness">
          <header>
            <div>
              <p className="el-eyebrow">{readiness.environment} / {readiness.release_ref}</p>
              <h2>Release readiness</h2>
            </div>
            <span className={`el-launch-overall is-${readiness.overall_status}`}>
              {readiness.overall_status}
            </span>
          </header>

          <div className="el-launch-summary">
            <article><span>Blockers</span><strong>{readiness.blocker_count}</strong></article>
            <article><span>Warnings</span><strong>{readiness.warning_count}</strong></article>
            <article><span>Generated</span><strong>{formatTime(readiness.generated_at)}</strong></article>
          </div>

          <div className="el-launch-gates">
            {readiness.gates.map((gate) => (
              <article key={gate.key}>
                <div className="el-launch-gate-main">
                  <span className={`el-launch-result is-${gate.result}`}>{gate.result}</span>
                  <div>
                    <b>{gate.label}</b>
                    <small>{gate.category} · {gate.source}{gate.required ? " · required" : ""}</small>
                    <p>{gate.detail}</p>
                  </div>
                </div>
                <dl>
                  <div><dt>Status</dt><dd>{gate.status}</dd></div>
                  <div><dt>Evidence</dt><dd>{gate.evidence_ref || "—"}</dd></div>
                  <div><dt>Notes</dt><dd>{gate.notes || "—"}</dd></div>
                </dl>
                {gate.source === "operator" ? (
                  <button onClick={() => setEditingGate(gate)} type="button">Record evidence</button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editingGate ? (
        <div className="el-admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setEditingGate(null);
        }}>
          <section aria-labelledby="el-launch-gate-dialog-title" aria-modal="true" className="el-admin-dialog" onKeyDown={keepDialogFocus} ref={dialogRef} role="dialog" tabIndex={-1}>
            <header>
              <h2 id="el-launch-gate-dialog-title">{editingGate.label}</h2>
              <button aria-label="Close" onClick={() => setEditingGate(null)} type="button">×</button>
            </header>
            <form className="el-admin-action-form" onSubmit={saveGate}>
              <label>
                <span>Status</span>
                <select defaultValue={editingGate.status === "automatic" ? "pending" : editingGate.status} name="status">
                  <option value="pending">Pending</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="waived">Waived</option>
                </select>
              </label>
              <label>
                <span>Evidence reference</span>
                <input defaultValue={editingGate.evidence_ref || ""} name="evidence_ref" placeholder="ticket / run / provider reference" />
              </label>
              <label>
                <span>Notes</span>
                <textarea defaultValue={editingGate.notes || ""} name="notes" rows={4} />
              </label>
              <button disabled={loadingReadiness} type="submit">Save evidence</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
