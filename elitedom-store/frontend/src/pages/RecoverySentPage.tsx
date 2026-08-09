import { Link, useLocation } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import "@/styles/auth.css";

export function RecoverySentPage() {
  const [locale, setLocale] = useStoreLocale();
  const location = useLocation();
  const ar = locale === "ar";
  const state = location.state as { destination?: string } | null;
  const destination = state?.destination ?? (ar ? "وجهة الاسترجاع المؤكدة" : "Verified recovery destination");

  return (
    <AuthShell locale={locale} onLocaleChange={setLocale}>
      <ElitedomBrand compact />
      <div className="el-auth-recovery-panel el-auth-recovery-panel--sent">
        <div className="el-auth-recovery-icon is-success"><StoreIcon name="check" size={24} /></div>
        <h2>{ar ? "تم إرسال رابط الاسترجاع" : "Recovery link sent"}</h2>
        <p className="el-auth-card__intro">{ar ? "راجع بريدك أو موبايلك. رابط الاسترجاع صالح لمدة 15 دقيقة." : "Check your inbox or phone. The recovery link expires in 15 minutes."}</p>
        <p className="el-auth-recovery-label">{ar ? "وجهة الاسترجاع" : "RECOVERY DESTINATION"}</p>
        <div className="el-auth-recovery-destination" dir="auto">{destination}</div>
        <Link className="el-auth-primary el-auth-primary--link el-auth-primary--fit" to="/auth">{ar ? "رجوع لتسجيل الدخول" : "Back to sign in"}</Link>
      </div>
    </AuthShell>
  );
}
