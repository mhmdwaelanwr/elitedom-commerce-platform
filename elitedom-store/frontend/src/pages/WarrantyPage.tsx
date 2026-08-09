import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { restoreSession } from "@/lib/auth-session";
import {
  checkWarranty,
  fetchWarrantyClaims,
  submitWarrantyClaim,
  type WarrantyCheck,
  type WarrantyClaim,
} from "@/lib/platform-api";
import type { CustomerSession } from "@/types/store";
import "@/styles/warranty.css";

export function WarrantyPage() {
  const [locale, setLocale] = useStoreLocale();
  const navigate = useNavigate();
  const ar = locale === "ar";
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [check, setCheck] = useState<WarrantyCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active) return;
      if (!current) {
        navigate(`/auth?next=${encodeURIComponent("/account/warranty")}`, { replace: true });
        return;
      }
      setSession(current);
      try {
        const result = await fetchWarrantyClaims(current);
        if (active) setClaims(result.claims);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Warranty claims could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [navigate]);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const serial = String(new FormData(event.currentTarget).get("serial") || "").trim();
    if (!serial) return;
    setPending(true); setError(""); setNotice("");
    try { setCheck(await checkWarranty(serial, session)); }
    catch (reason) { setCheck(null); setError(reason instanceof Error ? reason.message : "Warranty lookup failed."); }
    finally { setPending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const orderId = Number(form.get("order_id"));
    const productId = Number(form.get("product_id"));
    const serial = String(form.get("serial_number") || "").trim();
    const reason = String(form.get("reason") || "").trim();
    const evidence = String(form.get("evidence_media_url") || "").trim();
    setPending(true); setError(""); setNotice("");
    try {
      const claim = await submitWarrantyClaim({ order_id: orderId, product_id: productId, serial_number: serial || undefined, reason, evidence_media_url: evidence }, session);
      setClaims((current) => [claim, ...current]);
      setNotice(ar ? `تم تسجيل المطالبة ${claim.ticket_number}.` : `Claim ${claim.ticket_number} was submitted.`);
      event.currentTarget.reset();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "The claim could not be submitted.");
    } finally { setPending(false); }
  }

  return (
    <div className="el-warranty-page" data-figma-node="244:2682">
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main>
          <header className="el-warranty-intro">
            <p className="el-eyebrow">ACCOUNT / WARRANTY</p>
            <h1>{ar ? "الضمان والمرتجعات" : "Warranty & returns"}</h1>
            <p>{ar ? "افحص السيريال، قدم مطالبة موثقة، وتابع حالة كل RMA من حسابك." : "Check a serial, submit an evidence-backed claim and follow every RMA state from your account."}</p>
          </header>

          <div className="el-warranty-layout">
            <aside className="el-warranty-nav">
              <Link to="/account"><StoreIcon name="home" size={18} />{ar ? "نظرة عامة" : "Overview"}</Link>
              <Link to="/account?section=orders"><StoreIcon name="clipboard" size={18} />{ar ? "الطلبات" : "Orders"}</Link>
              <Link to="/account?section=loyalty"><StoreIcon name="star" size={18} />{ar ? "النقاط" : "Loyalty"}</Link>
              <Link className="is-active" to="/account/warranty"><StoreIcon name="warranty" size={18} />{ar ? "الضمان وRMA" : "Warranty & RMA"}</Link>
              <Link to="/account?section=security"><StoreIcon name="shield" size={18} />{ar ? "الأمان" : "Security"}</Link>
            </aside>

            <section className="el-warranty-content">
              {error ? <p className="el-warranty-error" role="alert">{error}</p> : null}
              {notice ? <p className="el-warranty-notice" role="status">{notice}</p> : null}

              <section className="el-warranty-kpis">
                <article><small>{ar ? "مطالبات" : "CLAIMS"}</small><strong>{claims.length}</strong><span>{ar ? "مسجلة بحسابك" : "owned by your account"}</span></article>
                <article><small>{ar ? "قيد المراجعة" : "IN REVIEW"}</small><strong>{claims.filter((claim) => claim.status === "pending_review").length}</strong><span>{ar ? "تحتاج قرار دعم" : "support review"}</span></article>
                <article><small>{ar ? "مكتملة" : "COMPLETED"}</small><strong>{claims.filter((claim) => claim.status === "completed").length}</strong><span>{ar ? "مغلقة" : "closed claims"}</span></article>
              </section>

              <div className="el-warranty-grid">
                <section className="el-warranty-card">
                  <h2>{ar ? "فحص الضمان" : "Warranty lookup"}</h2>
                  <p>{ar ? "اكتب الرقم التسلسلي لمنتج مرتبط بحسابك." : "Enter the serial number for an item associated with your account."}</p>
                  <form onSubmit={lookup}>
                    <label><span>{ar ? "الرقم التسلسلي" : "Serial number"}</span><input name="serial" placeholder="SN-..." required /></label>
                    <button disabled={pending} type="submit">{pending ? "…" : ar ? "فحص" : "Check warranty"}</button>
                  </form>
                  {check ? <div className="el-warranty-result"><StoreIcon name={check.is_valid ? "check" : "clock"} size={20} /><span><strong>{check.is_valid ? (ar ? "الضمان ساري" : "Warranty active") : (ar ? "غير ساري" : "Not active")}</strong><small>{check.warranty_expiration_date ? `${ar ? "حتى" : "Until"} ${check.warranty_expiration_date}` : ar ? "لا يوجد تاريخ انتهاء مؤكد" : "No confirmed expiry date"}</small></span></div> : null}
                </section>

                <section className="el-warranty-card">
                  <h2>{ar ? "مطالبة جديدة" : "New RMA claim"}</h2>
                  <p>{ar ? "الـbackend يتحقق من ملكية الطلب والمنتج والسيريال وفترة الضمان قبل القبول." : "The backend verifies order ownership, product, serial and warranty eligibility before accepting a claim."}</p>
                  <form className="el-warranty-claim-form" onSubmit={submit}>
                    <div><label><span>{ar ? "رقم الطلب الداخلي" : "Order ID"}</span><input min="1" name="order_id" required type="number" /></label><label><span>{ar ? "رقم المنتج" : "Product ID"}</span><input min="1" name="product_id" required type="number" /></label></div>
                    <label><span>{ar ? "السيريال (لو مطلوب)" : "Serial (when required)"}</span><input name="serial_number" /></label>
                    <label><span>{ar ? "سبب المطالبة" : "Reason"}</span><textarea minLength={10} name="reason" required rows={3} /></label>
                    <label><span>{ar ? "رابط صورة/فيديو الإثبات" : "Evidence image/video URL"}</span><input name="evidence_media_url" placeholder="https://…" required type="url" /></label>
                    <button disabled={pending} type="submit">{pending ? "…" : ar ? "إرسال المطالبة" : "Submit claim"}</button>
                  </form>
                </section>
              </div>

              <section className="el-warranty-card el-warranty-history">
                <div><h2>{ar ? "مطالباتك" : "Your claims"}</h2><span>{loading ? "…" : claims.length}</span></div>
                {claims.length ? <div className="el-warranty-table-wrap"><table><thead><tr><th>{ar ? "التذكرة" : "Ticket"}</th><th>{ar ? "الطلب" : "Order"}</th><th>{ar ? "المنتج" : "Product"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "تحديث" : "Updated"}</th></tr></thead><tbody>{claims.map((claim) => <tr key={claim.id}><td><code>{claim.ticket_number}</code></td><td>#{claim.order_id}</td><td>#{claim.product_id}</td><td><span className={`el-warranty-status is-${claim.status}`}>{claim.status.replaceAll("_", " ")}</span></td><td>{new Date(claim.updated_at || claim.created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</td></tr>)}</tbody></table></div> : <p className="el-warranty-empty">{loading ? (ar ? "بنحمّل المطالبات…" : "Loading claims…") : ar ? "مفيش مطالبات لسه." : "No warranty claims yet."}</p>}
              </section>
            </section>
          </div>
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}
