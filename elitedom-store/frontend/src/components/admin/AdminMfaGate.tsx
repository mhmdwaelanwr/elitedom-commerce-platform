"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { isStaffRole } from "@/lib/admin-api";
import { fetchMfaStatus, refreshSession } from "@/lib/auth-api";

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession } = useStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      let currentSession = session;
      if (!currentSession) {
        try {
          currentSession = await refreshSession();
          if (active) setSession(currentSession);
        } catch {
          if (active) setChecked(true);
          return;
        }
      }

      if (!isStaffRole(currentSession.role)) {
        if (active) setChecked(true);
        return;
      }

      try {
        const status = await fetchMfaStatus(currentSession);
        if (status.required && !status.verified) {
          const next = pathname.startsWith("/admin") ? pathname : "/admin";
          router.replace(`/mfa?next=${encodeURIComponent(next)}`);
          return;
        }
      } catch {
        // AdminShell remains the authoritative permission/error boundary.
      }
      if (active) setChecked(true);
    }

    void check();
    return () => {
      active = false;
    };
  }, [pathname, router, session, setSession]);

  if (!checked) {
    return (
      <div className="site-container grid min-h-[60vh] place-items-center py-10" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-e-transparent" />
          Securing staff session…
        </div>
      </div>
    );
  }

  return children;
}
