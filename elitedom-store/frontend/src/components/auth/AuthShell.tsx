import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";

const statusRows = [
  ["account.identity", "READY", "success"],
  ["orders.sync", "ONLINE", "success"],
  ["saved.hardware", "AVAILABLE", "accent"],
  ["session.security", "ENCRYPTED", "accent"],
] as const;

type AuthShellProps = {
  children: ReactNode;
  locale: "en" | "ar";
};

export function AuthShell({ children, locale }: AuthShellProps) {
  const ar = locale === "ar";
  return (
    <div className="el-auth-page" dir={ar ? "rtl" : "ltr"}>
      <header className="el-auth-topbar">
        <Link aria-label="Elitedom home" to="/"><ElitedomBrand /></Link>
        <div className="el-auth-secure-pill"><span />{ar ? "وصول آمن للحساب" : "SECURE ACCOUNT ACCESS"}</div>
      </header>

      <main className="el-auth-layout">
        <section className="el-auth-control-panel" aria-label={ar ? "حماية الحساب" : "Account control"}>
          <p className="el-auth-eyebrow">ELITEDOM // ACCOUNT CONTROL</p>
          <h1>{ar ? <>إعداداتك،<br />جاهزة وقت ما تحتاجها.</> : <>Your setup,<br />ready when you are.</>}</h1>
          <p className="el-auth-control-copy">
            {ar
              ? "طلباتك، الهاردوير المحفوظ وتفضيلات الحساب في مكان واحد آمن."
              : "Orders, saved hardware and account preferences stay in one secure place."}
          </p>
          <div className="el-auth-divider" />
          <div className="el-auth-status-list">
            {statusRows.map(([label, status, tone]) => (
              <div className="el-auth-status-row" key={label}>
                <span><StoreIcon name="chevron" size={14} />{label}</span>
                <strong className={`is-${tone}`}>{status}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="el-auth-card">{children}</section>
      </main>
    </div>
  );
}
