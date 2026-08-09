import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  convertRfq,
  fetchRfq,
  fetchRfqs,
  submitRfq,
  type B2BConversion,
  type B2BRfq,
  type RfqStatus,
} from "@/lib/b2b-api";
import { restoreSession } from "@/lib/auth-session";
import { fetchRichCatalog } from "@/lib/catalog-api";
import type { CustomerSession, Product } from "@/types/store";
import "@/styles/b2b.css";

const landingCopy = {
  en: {
    eyebrow: "ELITEDOM B2B / PROCUREMENT",
    title: "Hardware procurement that respects your time.",
    intro:
      "Bulk PCs, workstations, monitors, networking and peripherals with quote tracking, commercial pricing and a clear fulfilment path.",
    start: "Start an RFQ",
    sales: "Talk to business sales",
    example: "Example procurement basket",
    exampleCompany: "New Cairo design studio",
    estimate: "Illustrative list-price estimate",
    builtFor: "Built for real procurement jobs",
    builtIntro: "Structured requests first. Commercial detail appears when it becomes useful.",
    featureCards: [
      ["Office rollouts", "Repeatable employee hardware with one commercial request.", "clipboard"],
      ["Creator workstations", "High-performance configurations with quantity-based pricing.", "package"],
      ["Network refresh", "Switching, Wi-Fi and supporting hardware for site upgrades.", "delivery"],
      ["Education & labs", "Lab and classroom hardware with a traceable quote lifecycle.", "account"],
    ] as Array<[string, string, StoreIconName]>,
  },
  ar: {
    eyebrow: "ELITEDOM B2B / المشتريات",
    title: "مشتريات هاردوير منظمة من غير تضييع وقت.",
    intro:
      "أجهزة وتجميعات وشاشات وشبكات وكماليات بكميات كبيرة، مع متابعة طلب السعر وتسعير تجاري ومسار توريد واضح.",
    start: "ابدأ طلب سعر",
    sales: "تواصل مع مبيعات الشركات",
    example: "مثال لطلب مشتريات",
    exampleCompany: "استوديو تصميم — القاهرة الجديدة",
    estimate: "تقدير توضيحي بسعر القائمة",
    builtFor: "مصمم لشغل المشتريات الحقيقي",
    builtIntro: "ابدأ بالطلب المنظم، والتفاصيل التجارية تظهر وقت ما تحتاجها.",
    featureCards: [
      ["تجهيز المكاتب", "أجهزة موظفين متكررة داخل طلب تجاري واحد.", "clipboard"],
      ["محطات عمل للمبدعين", "تجميعات قوية مع تسعير مناسب للكميات.", "package"],
      ["تحديث الشبكات", "سويتشات وWi-Fi وهاردوير داعم لتطوير المواقع.", "delivery"],
      ["التعليم والمعامل", "أجهزة للمعامل والفصول بمسار عرض سعر قابل للتتبع.", "account"],
    ] as Array<[string, string, StoreIconName]>,
  },
} as const;

const workspaceCopy = {
  en: {
    loading: "Loading your business workspace…",
    deniedTitle: "A verified business account is required.",
    deniedBody:
      "RFQs are isolated to verified institutional accounts. Consumer accounts are never silently promoted to B2B access.",
    contact: "Contact business sales",
    back: "Back to business",
    createTitle: "Create a procurement RFQ",
    createIntro: "Choose live catalogue products, quantities and the commercial context your buyer needs.",
    requested: "Requested hardware",
    search: "Search live catalogue by SKU or product",
    selectedEmpty: "Add at least one live catalogue product to the request.",
    results: "Catalogue matches",
    add: "Add",
    qty: "Qty",
    remove: "Remove",
    details: "Procurement details",
    title: "RFQ title",
    titlePlaceholder: "Office workstation rollout",
    neededBy: "Needed by",
    delivery: "Delivery location",
    deliveryPlaceholder: "New Cairo, Egypt",
    budget: "Budget target (EGP)",
    terms: "Payment terms",
    termsPlaceholder: "Quote / bank transfer",
    notes: "Notes",
    notesPlaceholder: "Deployment stages, constraints or commercial notes",
    submit: "Submit RFQ",
    submitting: "Submitting…",
    recent: "Your recent RFQs",
    noRecent: "No submitted RFQs yet.",
    open: "Open workspace",
    refresh: "Retry",
    liveOnly: "Business RFQs require products from the live catalogue API.",
    quote: "Commercial quote",
    quoteValid: "Valid until",
    accept: "Accept quote & create order",
    accepting: "Creating order…",
    shippingAddress: "Shipping address",
    governorate: "Governorate",
    paymentMethod: "Payment method",
    cod: "Cash on delivery / account terms",
    card: "Credit card",
    wallet: "Mobile wallet",
    accepted: "Quote accepted — order created",
    acceptedExisting: "This RFQ has already been accepted and converted to an order.",
    declined: "This RFQ was declined.",
    total: "Quoted total",
    listEstimate: "Current estimate",
    company: "Company",
    contactLabel: "Contact",
    budgetLabel: "Budget",
    paymentTerms: "Payment terms",
    rfq: "RFQ",
    order: "Order",
    status: "Status",
  },
  ar: {
    loading: "بنحمّل مساحة مشتريات الشركات…",
    deniedTitle: "لازم الحساب يكون حساب شركة موثّق.",
    deniedBody:
      "طلبات الأسعار معزولة لكل حساب مؤسسي موثّق. حساب العميل العادي مش بيتحوّل لحساب B2B تلقائيًا.",
    contact: "تواصل مع مبيعات الشركات",
    back: "رجوع لصفحة الشركات",
    createTitle: "إنشاء طلب سعر للمشتريات",
    createIntro: "اختار منتجات فعلية من الكتالوج والكميات والتفاصيل التجارية المطلوبة.",
    requested: "الهاردوير المطلوب",
    search: "ابحث بالمنتج أو SKU في الكتالوج الفعلي",
    selectedEmpty: "ضيف منتج واحد على الأقل من الكتالوج الفعلي.",
    results: "نتائج الكتالوج",
    add: "إضافة",
    qty: "الكمية",
    remove: "حذف",
    details: "تفاصيل المشتريات",
    title: "عنوان طلب السعر",
    titlePlaceholder: "تجهيز محطات عمل للمكتب",
    neededBy: "مطلوب قبل",
    delivery: "مكان التوصيل",
    deliveryPlaceholder: "القاهرة الجديدة، مصر",
    budget: "الميزانية المستهدفة (جنيه)",
    terms: "شروط الدفع",
    termsPlaceholder: "عرض سعر / تحويل بنكي",
    notes: "ملاحظات",
    notesPlaceholder: "مراحل التنفيذ أو القيود أو الملاحظات التجارية",
    submit: "إرسال طلب السعر",
    submitting: "جارٍ الإرسال…",
    recent: "آخر طلبات الأسعار",
    noRecent: "مفيش طلبات أسعار مرسلة لسه.",
    open: "فتح الطلب",
    refresh: "حاول تاني",
    liveOnly: "طلبات الشركات بتقبل منتجات موجودة في الكتالوج الفعلي فقط.",
    quote: "العرض التجاري",
    quoteValid: "صالح لحد",
    accept: "قبول العرض وإنشاء الطلب",
    accepting: "جارٍ إنشاء الطلب…",
    shippingAddress: "عنوان الشحن",
    governorate: "المحافظة",
    paymentMethod: "طريقة الدفع",
    cod: "الدفع عند الاستلام / شروط الحساب",
    card: "بطاقة",
    wallet: "محفظة موبايل",
    accepted: "تم قبول العرض وإنشاء الطلب",
    acceptedExisting: "طلب السعر ده تم قبوله وتحويله لطلب بالفعل.",
    declined: "تم رفض طلب السعر ده.",
    total: "إجمالي العرض",
    listEstimate: "التقدير الحالي",
    company: "الشركة",
    contactLabel: "جهة الاتصال",
    budgetLabel: "الميزانية",
    paymentTerms: "شروط الدفع",
    rfq: "طلب سعر",
    order: "طلب",
    status: "الحالة",
  },
} as const;

const statusOrder: RfqStatus[] = ["submitted", "under_review", "quoted", "accepted"];

export function BusinessLandingPage() {
  const [locale, setLocale] = useStoreLocale();
  const text = landingCopy[locale];
  return (
    <div className="el-b2b-page" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <div className="el-storefront__shell">
        <StoreHeader locale={locale} onLocaleChange={setLocale} />
        <main>
          <section className="el-b2b-hero">
            <div className="el-b2b-hero__copy">
              <p className="el-eyebrow">{text.eyebrow}</p>
              <h1>{text.title}</h1>
              <p>{text.intro}</p>
              <div className="el-b2b-actions">
                <Link className="el-primary-button" to="/business/rfq">{text.start}<StoreIcon name="arrow" size={16} /></Link>
                <a className="el-outline-button" href="mailto:sales@elitedom.store">{text.sales}</a>
              </div>
            </div>
            <aside className="el-b2b-example">
              <p className="el-eyebrow">{text.example}</p>
              <h2>{text.exampleCompany}</h2>
              <ExampleLine quantity="24×" label="Creator workstation" meta="Ryzen 9 · RTX 5070 Ti · 64GB · 2TB" />
              <ExampleLine quantity="24×" label="27” 4K monitor" meta="IPS · USB-C · height adjustable" />
              <ExampleLine quantity="4×" label="10GbE managed switch" meta="24-port · PoE+ · 10Gb uplink" />
              <ExampleLine quantity="1×" label="Deployment & setup" meta="Staged onsite rollout" />
              <div className="el-b2b-example__total"><span>{text.estimate}</span><strong>2,480,000 EGP</strong></div>
            </aside>
          </section>

          <section className="el-b2b-feature-section">
            <header><p className="el-eyebrow">B2B / USE CASES</p><h2>{text.builtFor}</h2><p>{text.builtIntro}</p></header>
            <div className="el-b2b-feature-grid">
              {text.featureCards.map(([title, body, icon]) => (
                <article key={title}><span><StoreIcon name={icon} size={24} /></span><h3>{title}</h3><p>{body}</p></article>
              ))}
            </div>
          </section>
        </main>
        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function ExampleLine({ quantity, label, meta }: { quantity: string; label: string; meta: string }) {
  return <div className="el-b2b-example__line"><strong>{quantity}</strong><span><b>{label}</b><small>{meta}</small></span></div>;
}

export function BusinessRfqPage() {
  const { rfqCode } = useParams();
  const navigate = useNavigate();
  const [locale, setLocale] = useStoreLocale();
  const text = workspaceCopy[locale];
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authState, setAuthState] = useState<"loading" | "ready" | "denied">("loading");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [recent, setRecent] = useState<B2BRfq[]>([]);
  const [rfq, setRfq] = useState<B2BRfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active) return;
      if (!current) {
        navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
        return;
      }
      if (current.role !== "b2b_client") {
        setSession(current);
        setAuthState("denied");
        setLoading(false);
        return;
      }
      setSession(current);
      setAuthState("ready");
      try {
        if (rfqCode) {
          const detail = await fetchRfq(rfqCode, current);
          if (active) setRfq(detail);
        } else {
          const [products, rfqs] = await Promise.all([
            fetchRichCatalog({ locale, limit: 100 }),
            fetchRfqs(current),
          ]);
          if (active) {
            setCatalog(products.filter((product) => /^\d+$/.test(product.id)));
            setRecent(rfqs.rfqs);
          }
        }
        if (active) setLoadError("");
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Business workspace could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [locale, navigate, rfqCode]);

  if (authState === "loading" || loading) {
    return <BusinessShell locale={locale} onLocaleChange={setLocale}><div className="el-b2b-state"><span className="el-b2b-spinner" /><p>{text.loading}</p></div></BusinessShell>;
  }

  if (authState === "denied") {
    return <BusinessShell locale={locale} onLocaleChange={setLocale}><div className="el-b2b-state"><StoreIcon name="briefcase" size={34} /><h1>{text.deniedTitle}</h1><p>{text.deniedBody}</p><div><a className="el-primary-button" href="mailto:sales@elitedom.store">{text.contact}</a><Link className="el-outline-button" to="/business">{text.back}</Link></div></div></BusinessShell>;
  }

  if (!session) return null;
  if (loadError) {
    return <BusinessShell locale={locale} onLocaleChange={setLocale}><div className="el-b2b-state"><StoreIcon name="returns" size={34} /><h1>{loadError}</h1><button className="el-primary-button" onClick={() => window.location.reload()} type="button">{text.refresh}</button></div></BusinessShell>;
  }

  return (
    <BusinessShell locale={locale} onLocaleChange={setLocale}>
      {rfqCode && rfq ? <RfqDetail locale={locale} rfq={rfq} session={session} text={text} /> : <RfqBuilder catalog={catalog} locale={locale} recent={recent} session={session} text={text} />}
    </BusinessShell>
  );
}

function BusinessShell({ locale, onLocaleChange, children }: { locale: "en" | "ar"; onLocaleChange: (locale: "en" | "ar") => void; children: React.ReactNode }) {
  return <div className="el-b2b-page" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}><div className="el-storefront__shell"><StoreHeader locale={locale} onLocaleChange={onLocaleChange} /><main>{children}</main><StoreFooter locale={locale} /></div></div>;
}

function RfqBuilder({ catalog, recent, session, locale, text }: { catalog: Product[]; recent: B2BRfq[]; session: CustomerSession; locale: "en" | "ar"; text: typeof workspaceCopy.en | typeof workspaceCopy.ar }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.slice(0, 8);
    return catalog.filter((product) => [product.name, product.sku, product.brand, product.categoryName].join(" ").toLowerCase().includes(normalized)).slice(0, 8);
  }, [catalog, query]);
  const selectedProducts = useMemo(() => catalog.filter((product) => selected[product.id]), [catalog, selected]);

  function add(product: Product) {
    setSelected((current) => ({ ...current, [product.id]: current[product.id] ?? 1 }));
  }

  function quantity(productId: string, value: number) {
    if (value <= 0) {
      setSelected((current) => { const next = { ...current }; delete next[productId]; return next; });
      return;
    }
    setSelected((current) => ({ ...current, [productId]: Math.min(100_000, value) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProducts.length || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const current = await restoreSession();
      if (!current || current.role !== "b2b_client") throw new Error(text.deniedTitle);
      const budgetValue = Number(form.get("budget") || 0);
      const result = await submitRfq({
        items: selectedProducts.map((product) => ({ product_id: Number(product.id), quantity: selected[product.id] })),
        notes: String(form.get("notes") || "").trim() || undefined,
        procurement: {
          title: String(form.get("title") || "").trim(),
          needed_by: String(form.get("neededBy") || "") || undefined,
          delivery_location: String(form.get("delivery") || "").trim() || undefined,
          budget_target: Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : undefined,
          payment_terms: String(form.get("terms") || "").trim() || undefined,
        },
      }, current);
      navigate(`/business/rfq/${encodeURIComponent(result.rfq_code)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "RFQ could not be submitted.");
    } finally { setPending(false); }
  }

  return <>
    <section className="el-rfq-intro"><p className="el-eyebrow">B2B / RFQ WORKSPACE</p><h1>{text.createTitle}</h1><p>{text.createIntro}</p><div className="el-rfq-status-lane"><StatusChip label="Draft" active /></div></section>
    <form className="el-rfq-layout" onSubmit={submit}>
      <section className="el-rfq-panel el-rfq-requested">
        <h2>{text.requested}</h2>
        {selectedProducts.length ? <div className="el-rfq-lines">{selectedProducts.map((product) => <div className="el-rfq-line" key={product.id}><strong>{selected[product.id]}×</strong><span><b>{product.name}</b><small>{product.sku} · {product.brand}</small></span><label>{text.qty}<input min="1" onChange={(event) => quantity(product.id, Number(event.target.value))} type="number" value={selected[product.id]} /></label><button onClick={() => quantity(product.id, 0)} type="button">{text.remove}</button></div>)}</div> : <p className="el-rfq-empty-inline">{text.selectedEmpty}</p>}
        <div className="el-rfq-product-picker">
          <label><StoreIcon name="search" size={18} /><input onChange={(event) => setQuery(event.target.value)} placeholder={text.search} type="search" value={query} /></label>
          {catalog.length ? <div><p className="el-eyebrow">{text.results}</p>{matches.map((product) => <button key={product.id} onClick={() => add(product)} type="button"><span><b>{product.name}</b><small>{product.sku} · {formatMoney(product.priceEgp, locale)} EGP</small></span><strong>{selected[product.id] ? `${selected[product.id]}×` : text.add}</strong></button>)}</div> : <p className="el-rfq-empty-inline">{text.liveOnly}</p>}
        </div>
      </section>
      <aside className="el-rfq-panel el-rfq-details">
        <h2>{text.details}</h2>
        <RfqField label={text.title} name="title" placeholder={text.titlePlaceholder} required />
        <RfqField label={text.neededBy} name="neededBy" type="date" />
        <RfqField label={text.delivery} name="delivery" placeholder={text.deliveryPlaceholder} />
        <RfqField label={text.budget} min="0" name="budget" type="number" />
        <RfqField label={text.terms} name="terms" placeholder={text.termsPlaceholder} />
        <label className="el-rfq-field"><span>{text.notes}</span><textarea maxLength={4000} name="notes" placeholder={text.notesPlaceholder} rows={4} /></label>
        {error ? <p className="el-rfq-error">{error}</p> : null}
        <button className="el-rfq-submit" disabled={pending || !selectedProducts.length} type="submit">{pending ? text.submitting : text.submit}</button>
      </aside>
    </form>
    <section className="el-rfq-recent"><div className="el-rfq-section-heading"><h2>{text.recent}</h2></div>{recent.length ? <div className="el-rfq-recent-grid">{recent.slice(0, 6).map((item) => <Link key={item.id} to={`/business/rfq/${encodeURIComponent(item.rfq_code)}`}><span><b>{item.procurement?.title || item.rfq_code}</b><small>{item.rfq_code} · {formatDate(item.created_at, locale)}</small></span><StatusChip label={statusLabel(item.status, locale)} active /></Link>)}</div> : <p className="el-rfq-empty-inline">{text.noRecent}</p>}</section>
  </>;
}

function RfqDetail({ rfq, session, locale, text }: { rfq: B2BRfq; session: CustomerSession; locale: "en" | "ar"; text: typeof workspaceCopy.en | typeof workspaceCopy.ar }) {
  const [pending, setPending] = useState(false);
  const [conversion, setConversion] = useState<B2BConversion | null>(null);
  const [error, setError] = useState("");
  const procurement = rfq.procurement;
  const activeIndex = rfq.status === "declined" ? -1 : statusOrder.indexOf(rfq.status);

  async function acceptQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || rfq.status !== "quoted") return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const current = await restoreSession();
      if (!current || current.userId !== session.userId) throw new Error(text.deniedTitle);
      const result = await convertRfq(rfq.rfq_code, {
        shipping_address: String(form.get("shippingAddress") || "").trim() || undefined,
        shipping_governorate: String(form.get("governorate") || "").trim() || undefined,
        payment_method: String(form.get("paymentMethod") || "cod") as "credit_card" | "mobile_wallet" | "cod",
      }, crypto.randomUUID(), current);
      setConversion(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The quote could not be accepted.");
    } finally { setPending(false); }
  }

  return <>
    <section className="el-rfq-intro el-rfq-intro--detail"><p className="el-eyebrow">{text.rfq} #{rfq.rfq_code}</p><h1>{procurement?.title || rfq.rfq_code}</h1><div className="el-rfq-status-lane"><StatusChip label="Draft" active />{statusOrder.map((status, index) => <StatusChip key={status} label={statusLabel(status, locale)} active={activeIndex >= index} />)}{rfq.status === "declined" ? <StatusChip label={text.declined} danger active /> : null}</div></section>
    <div className="el-rfq-layout">
      <section className="el-rfq-panel el-rfq-requested">
        <h2>{text.requested}</h2>
        <div className="el-rfq-lines">{rfq.items.map((item) => <div className="el-rfq-line el-rfq-line--detail" key={item.product_id}><strong>{item.quantity}×</strong><span><b>{item.product_name || item.sku || `Product ${item.product_id}`}</b><small>{item.sku || ""}{item.quoted_unit_price != null ? ` · ${formatMoney(Number(item.quoted_unit_price), locale)} EGP / unit` : ""}</small></span>{item.line_total != null ? <em>{formatMoney(Number(item.line_total), locale)} EGP</em> : null}</div>)}</div>
        <div className="el-rfq-value-card"><span>{rfq.status === "quoted" || rfq.status === "accepted" ? text.total : text.listEstimate}</span><strong>{formatMoney(Number(rfq.total_estimated_value || 0), locale)} EGP</strong></div>
        {rfq.quote ? <div className="el-rfq-quote"><p className="el-eyebrow">{text.quote}</p><p>{rfq.quote.terms || "—"}</p>{rfq.validity_date ? <small>{text.quoteValid}: {formatDate(rfq.validity_date, locale)}</small> : null}</div> : null}
      </section>
      <aside className="el-rfq-panel el-rfq-details el-rfq-details--summary">
        <h2>{text.details}</h2>
        <Detail label={text.company} value={procurement?.company_name} />
        <Detail label={text.contactLabel} value={[procurement?.contact_name, procurement?.contact_email].filter(Boolean).join(" · ")} />
        <Detail label={text.neededBy} value={formatDate(procurement?.needed_by, locale)} />
        <Detail label={text.delivery} value={procurement?.delivery_location} />
        <Detail label={text.budgetLabel} value={procurement?.budget_target != null ? `${formatMoney(Number(procurement.budget_target), locale)} EGP` : undefined} />
        <Detail label={text.paymentTerms} value={procurement?.payment_terms} />
        <Detail label={text.status} value={statusLabel(rfq.status, locale)} />
      </aside>
    </div>
    {rfq.status === "quoted" && !conversion ? <form className="el-rfq-accept" onSubmit={acceptQuote}><div><p className="el-eyebrow">QUOTE ACCEPTANCE</p><h2>{text.accept}</h2></div><RfqField label={text.shippingAddress} name="shippingAddress" placeholder={procurement?.delivery_location || ""} /><RfqField label={text.governorate} name="governorate" /><label className="el-rfq-field"><span>{text.paymentMethod}</span><select defaultValue="cod" name="paymentMethod"><option value="cod">{text.cod}</option><option value="credit_card">{text.card}</option><option value="mobile_wallet">{text.wallet}</option></select></label>{error ? <p className="el-rfq-error">{error}</p> : null}<button className="el-rfq-submit" disabled={pending} type="submit">{pending ? text.accepting : text.accept}</button></form> : null}
    {conversion ? <div className="el-rfq-conversion-success"><StoreIcon name="check" size={26} /><span><b>{text.accepted}</b><small>{text.order} {conversion.order_number}</small></span></div> : null}
    {rfq.status === "accepted" && !conversion ? <div className="el-rfq-conversion-success"><StoreIcon name="check" size={26} /><span><b>{text.acceptedExisting}</b></span></div> : null}
  </>;
}

function RfqField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="el-rfq-field"><span>{label}</span><input {...props} /></label>;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div className="el-rfq-detail"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function StatusChip({ label, active = false, danger = false }: { label: string; active?: boolean; danger?: boolean }) {
  return <span className={`el-rfq-status ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`.trim()}>{label}</span>;
}

function statusLabel(status: RfqStatus, locale: "en" | "ar") {
  const labels: Record<RfqStatus, [string, string]> = {
    submitted: ["Submitted", "تم الإرسال"],
    under_review: ["Under review", "قيد المراجعة"],
    quoted: ["Quoted", "تم التسعير"],
    accepted: ["Approved", "تمت الموافقة"],
    declined: ["Declined", "مرفوض"],
  };
  return labels[status][locale === "ar" ? 1 : 0];
}

function formatMoney(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null | undefined, locale: "en" | "ar") {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
