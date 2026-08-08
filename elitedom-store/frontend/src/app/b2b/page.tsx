"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import { ApiError, submitRfq } from "@/lib/api";
import { CATALOG } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type QuoteItem = { productId: string; quantity: number };

export default function B2BPage() {
  const router = useRouter();
  const { locale } = usePreferences();
  const { cart, currency, notify, session } = useStore();
  const ar = locale === "ar";
  const copy = ar ? AR_COPY : EN_COPY;
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("+20");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItem[]>(
    cart.length
      ? cart.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
      : [{ productId: CATALOG[0].id, quantity: 1 }],
  );
  const [error, setError] = useState<string | null>(null);
  const [rfqCode, setRfqCode] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const estimate = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          (CATALOG.find((product) => product.id === item.productId)?.priceEgp ?? 0) *
            item.quantity,
        0,
      ),
    [items],
  );

  function updateItem(index: number, change: Partial<QuoteItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...change } : item,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!session) {
      notify(copy.signInNotice, "info");
      router.push("/signin?next=/b2b");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitRfq(
        {
          items: items.map((item) => ({
            product_id: Number(item.productId),
            quantity: item.quantity,
          })),
          notes: `Company: ${companyName}\nContact: ${contactName}\nMobile: ${phone}${notes ? `\n\n${notes}` : ""}`,
        },
        session,
      );
      setRfqCode(result.rfq_code);
      notify(`${copy.rfqLabel} ${result.rfq_code} ${copy.submittedNotice}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : copy.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (rfqCode) {
    return (
      <div className="site-container grid min-h-[62vh] place-items-center py-14">
        <section className="w-full max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success text-primary-contrast"><CheckIcon /></span>
          <p className="section-kicker mt-6 text-success">{copy.submitted}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{copy.proposalTitle}</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            {copy.reference} <strong className="font-mono text-foreground">{rfqCode}</strong>. {copy.trackText}
          </p>
          <Link className="button-primary mt-6" href="/account">{copy.goAccount}</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <section className="overflow-hidden rounded-2xl border border-border bg-primary text-primary-contrast shadow-sm">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">{copy.title}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 opacity-82 sm:text-base">{copy.description}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <a className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-surface px-4 text-sm font-black text-primary" href="#rfq-form">{copy.startRequest}</a>
              <Link className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-primary-contrast/30 px-4 text-sm font-bold" href="/shop">{copy.browseCatalog}</Link>
            </div>
          </div>

          <div className="grid border-t border-primary-contrast/20 lg:border-s lg:border-t-0">
            <HeroMetric value="B2B" label={copy.procurement} />
            <HeroMetric value="EGP" label={copy.localPricing} />
            <HeroMetric value="Odoo" label={copy.erpWorkflow} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(19rem,0.75fr)_minmax(0,1.25fr)]">
        <aside className="grid h-fit gap-3 xl:sticky xl:top-36">
          <Benefit number="01" title={copy.benefit1Title} icon={<ListIcon />}>{copy.benefit1Text}</Benefit>
          <Benefit number="02" title={copy.benefit2Title} icon={<QuoteIcon />}>{copy.benefit2Text}</Benefit>
          <Benefit number="03" title={copy.benefit3Title} icon={<WorkflowIcon />}>{copy.benefit3Text}</Benefit>
          <div className="rounded-xl border border-border bg-elevated/55 p-5 text-sm text-muted">
            <p className="font-black text-foreground">{copy.forTeams}</p>
            <p className="mt-2 leading-6">{copy.forTeamsText}</p>
          </div>
        </aside>

        <form className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7" id="rfq-form" onSubmit={handleSubmit}>
          <div className="border-b border-border pb-5">
            <p className="section-kicker">{copy.formEyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">{copy.formTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.formDescription}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.company}><input className="form-input" onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></Field>
            <Field label={copy.contact}><input className="form-input" onChange={(event) => setContactName(event.target.value)} required value={contactName} /></Field>
          </div>
          <Field label={copy.mobile}><input className="form-input" onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} /></Field>

          <fieldset className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <legend className="text-sm font-black text-foreground">{copy.requestedItems}</legend>
              <span className="text-xs text-muted">{items.length} {copy.lines}</span>
            </div>
            <div className="mt-3 grid gap-2.5">
              {items.map((item, index) => (
                <div className="grid gap-2 rounded-lg border border-border bg-elevated/45 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-center" key={`${item.productId}-${index}`}>
                  <select aria-label={`${copy.product} ${index + 1}`} className="form-input" onChange={(event) => updateItem(index, { productId: event.target.value })} value={item.productId}>
                    {CATALOG.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <input aria-label={`${copy.quantity} ${index + 1}`} className="form-input" min="1" onChange={(event) => updateItem(index, { quantity: Math.max(1, Number(event.target.value)) })} type="number" value={item.quantity} />
                  <button className="focus-ring rounded-md px-2 py-2 text-xs font-bold text-danger hover:bg-danger/5 disabled:text-muted" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">{copy.remove}</button>
                </div>
              ))}
            </div>
            <button className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-primary hover:brightness-110" onClick={() => setItems((current) => [...current, { productId: CATALOG[0].id, quantity: 1 }])} type="button">
              <PlusIcon />{copy.addProduct}
            </button>
          </fieldset>

          <Field label={copy.notes}>
            <textarea className="form-input min-h-28 resize-y" onChange={(event) => setNotes(event.target.value)} placeholder={copy.notesPlaceholder} value={notes} />
          </Field>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-elevated/55 p-4">
            <div><p className="text-xs font-bold text-muted">{copy.retailEstimate}</p><p className="mt-1 text-[11px] text-muted">{copy.estimateNote}</p></div>
            <strong className="text-xl font-black tracking-tight text-foreground">{formatPrice(estimate, currency, locale)}</strong>
          </div>

          {error ? <p className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}

          <button className="button-primary mt-5 w-full disabled:cursor-wait disabled:opacity-65" disabled={isSubmitting} type="submit">
            <SendIcon />{isSubmitting ? copy.submitting : copy.submit}
          </button>
        </form>
      </div>
    </div>
  );
}

const EN_COPY = {
  eyebrow: "Institutional procurement",
  title: "Technology procurement built for teams, projects, and scale.",
  description: "Request commercial pricing for offices, schools, labs, studios, and IT teams. Build the exact bill of materials and let Elitedom handle availability, pricing tiers, and fulfillment terms.",
  startRequest: "Start an RFQ",
  browseCatalog: "Browse catalogue",
  procurement: "Procurement",
  localPricing: "Local pricing",
  erpWorkflow: "ERP workflow",
  benefit1Title: "Build the exact request",
  benefit1Text: "Start from your cart or add products and quantities directly to the RFQ.",
  benefit2Title: "Receive commercial terms",
  benefit2Text: "Review availability, volume pricing, validity dates, and payment terms in one proposal.",
  benefit3Title: "Convert into operations",
  benefit3Text: "Approved quotations can flow into orders, invoicing, fulfillment, and ERP tracking.",
  forTeams: "Designed for Egyptian organizations",
  forTeamsText: "Use one procurement path for business hardware, workstations, networking, peripherals, and project deployments.",
  formEyebrow: "Business request",
  formTitle: "Request for quotation",
  formDescription: "Submit the products, quantities, and project context your procurement team needs reviewed.",
  company: "Company / institution",
  contact: "Contact name",
  mobile: "Contact mobile",
  requestedItems: "Requested items",
  lines: "line items",
  product: "Product",
  quantity: "Quantity",
  remove: "Remove",
  addProduct: "Add another product",
  notes: "Project notes (optional)",
  notesPlaceholder: "Technical requirements, delivery timeline, payment terms, deployment constraints, or other context",
  retailEstimate: "Retail estimate before B2B pricing",
  estimateNote: "Commercial terms are confirmed after review.",
  submit: "Submit RFQ",
  submitting: "Submitting RFQ…",
  signInNotice: "Sign in with your verified B2B account before submitting an RFQ.",
  rfqLabel: "RFQ",
  submittedNotice: "was submitted.",
  submitError: "We could not submit your RFQ.",
  submitted: "RFQ submitted",
  proposalTitle: "We’ll prepare your proposal",
  reference: "Your reference is",
  trackText: "A verified business account can track the quote as it is reviewed.",
  goAccount: "Go to account",
};

const AR_COPY: typeof EN_COPY = {
  eyebrow: "مشتريات المؤسسات",
  title: "مشتريات تقنية مصممة للفرق والمشروعات والتوسع.",
  description: "اطلب أسعارًا تجارية للمكاتب والمدارس والمعامل والاستوديوهات وفرق تقنية المعلومات. حدّد المنتجات والكميات ودع Elitedom يتولى مراجعة التوفر وشرائح الأسعار وشروط التنفيذ.",
  startRequest: "ابدأ طلب عرض سعر",
  browseCatalog: "تصفح الكتالوج",
  procurement: "المشتريات",
  localPricing: "تسعير محلي",
  erpWorkflow: "مسار ERP",
  benefit1Title: "كوّن الطلب بدقة",
  benefit1Text: "ابدأ من سلة التسوق أو أضف المنتجات والكميات مباشرة داخل طلب عرض السعر.",
  benefit2Title: "استلم الشروط التجارية",
  benefit2Text: "راجع التوفر وتسعير الكميات وفترة صلاحية العرض وشروط الدفع داخل عرض واحد.",
  benefit3Title: "حوّل العرض إلى تنفيذ",
  benefit3Text: "يمكن تحويل عروض الأسعار المعتمدة إلى طلبات وفواتير وتنفيذ ومتابعة عبر ERP.",
  forTeams: "مصمم للمؤسسات المصرية",
  forTeamsText: "مسار مشتريات واحد لأجهزة الأعمال ومحطات العمل والشبكات والملحقات وتجهيز المشروعات.",
  formEyebrow: "طلب أعمال",
  formTitle: "طلب عرض سعر",
  formDescription: "أرسل المنتجات والكميات وتفاصيل المشروع التي يحتاج فريق المشتريات إلى مراجعتها.",
  company: "الشركة / المؤسسة",
  contact: "اسم مسؤول التواصل",
  mobile: "رقم التواصل",
  requestedItems: "المنتجات المطلوبة",
  lines: "بنود",
  product: "المنتج",
  quantity: "الكمية",
  remove: "حذف",
  addProduct: "إضافة منتج آخر",
  notes: "ملاحظات المشروع (اختياري)",
  notesPlaceholder: "المتطلبات التقنية أو موعد التسليم أو شروط الدفع أو قيود التنفيذ أو أي تفاصيل أخرى",
  retailEstimate: "تقدير سعر التجزئة قبل تسعير الأعمال",
  estimateNote: "يتم تأكيد الشروط التجارية بعد المراجعة.",
  submit: "إرسال طلب عرض السعر",
  submitting: "جارٍ إرسال الطلب…",
  signInNotice: "سجّل الدخول بحساب أعمال موثّق قبل إرسال طلب عرض السعر.",
  rfqLabel: "طلب عرض السعر",
  submittedNotice: "تم إرساله.",
  submitError: "تعذر إرسال طلب عرض السعر.",
  submitted: "تم إرسال طلب عرض السعر",
  proposalTitle: "سنجهز عرضك التجاري",
  reference: "الرقم المرجعي هو",
  trackText: "يمكن للحساب التجاري الموثّق متابعة العرض أثناء مراجعته.",
  goAccount: "الذهاب إلى الحساب",
};

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-primary-contrast/20 p-6 last:border-b-0 lg:px-8"><span className="text-sm opacity-70">{label}</span><strong className="text-xl font-black">{value}</strong></div>;
}
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="mt-4 grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span>{children}</label>; }
function Benefit({ children, icon, number, title }: { children: ReactNode; icon: ReactNode; number: string; title: string }) { return <article className="rounded-xl border border-border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary">{icon}</span><span className="text-xs font-black text-muted">{number}</span></div><h2 className="mt-4 font-black text-foreground">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{children}</p></article>; }
function CheckIcon() { return <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 24 24" width="28"><path d="m6 12 4 4 8-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>; }
function ListIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function QuoteIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M5 4h14v13H9l-4 3V4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8 8h8m-8 4h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function WorkflowIcon() { return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><rect height="5" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="2" y="3" /><rect height="5" rx="1" stroke="currentColor" strokeWidth="1.8" width="6" x="16" y="16" /><path d="M8 5.5h5a4 4 0 0 1 4 4V16M16 18.5h-5a4 4 0 0 1-4-4V8" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function PlusIcon() { return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>; }
function SendIcon() { return <svg aria-hidden="true" className="rtl:rotate-180" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="m3 11 18-8-8 18-2-7-8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></svg>; }
