import { Link } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import "@/styles/not-found.css";

export function NotFoundPage() {
  const [locale, setLocale] = useStoreLocale();
  const ar = locale === "ar";

  return (
    <div className="el-not-found-page" data-figma-node="246:592">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main className="el-not-found">
          <section className="el-not-found__panel">
            <p className="el-eyebrow">ELITEDOM / ROUTE CONTROL</p>
            <strong className="el-not-found__code">404</strong>
            <h1>{ar ? "المسار ده خارج خريطة النظام الحالية." : "This route is outside the current system map."}</h1>
            <p>{ar ? "المتجر والحساب ولوحات التشغيل ما زالت متاحة. ارجع لمسار فعلي بدل نهاية مقفولة." : "The store, account and operations surfaces are still available. Return to a verified route instead of landing on a dead end."}</p>
            <div className="el-not-found__actions">
              <Link className="el-primary-button" to="/"><StoreIcon name="home" size={17} />{ar ? "العودة للمتجر" : "Back to storefront"}</Link>
              <Link className="el-outline-button" to="/catalog"><StoreIcon name="search" size={17} />{ar ? "تصفح الهاردوير" : "Browse hardware"}</Link>
            </div>
            <small>AR + EN · RTL + LTR · LIGHT + DARK · NO DEAD ROUTES</small>
          </section>
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}
