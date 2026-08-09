import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { submitCheckout } from "@/lib/api";
import { cartSubtotal, loadGuestCart, type GuestCartSnapshot } from "@/lib/cart-data";
import type { CheckoutDetails, CheckoutResult } from "@/types/store";
import "@/styles/checkout.css";

type PaymentChoice = "card" | "wallet" | "instapay" | "cod";
type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "redirecting"; orderNumber: string }
  | { status: "success"; orderNumber: string }
  | { status: "pending"; orderNumber: string }
  | { status: "error"; message: string };

const copy = {
  en: {
    secure: "Secure checkout · Encrypted",
    title: "Checkout",
    intro: "Guest checkout is available. Sign in only if you want saved addresses, loyalty and order history.",
    delivery: "Delivery",
    payment: "Payment",
    review: "Review",
    fullName: "Full name",
    fullNamePlaceholder: "Mohamed Anwar",
    email: "Email address",
    emailPlaceholder: "name@example.com",
    phone: "Phone",
    phonePlaceholder: "01X XXX XXXX",
    governorate: "Governorate",
    governoratePlaceholder: "Cairo",
    street: "Street address",
    streetPlaceholder: "Building, street, district",
    choosePayment: "Choose how you’d like to pay.",
    card: "Credit / debit card",
    cardMeta: "Visa · Mastercard · Meeza",
    wallet: "Mobile wallet",
    walletMeta: "Pay with a supported mobile wallet",
    instapay: "InstaPay",
    instapayMeta: "Pay using your InstaPay account",
    cod: "Cash on delivery",
    codMeta: "Available for eligible orders",
    reviewMeta: "Delivery address · payment method · products · final total",
    placeOrder: "Place order",
    placing: "Placing order…",
    yourOrder: "Your order",
    qty: "Qty",
    subtotal: "Subtotal",
    shipping: "Shipping",
    calculated: "Calculated next",
    vat: "VAT",
    included: "Included",
    total: "Total",
    encrypted: "Encrypted checkout · Protected over HTTPS",
    empty: "Your cart is empty.",
    back: "Back to catalogue",
    loadError: "We could not load your checkout session.",
    retry: "Retry",
    redirecting: "Order created. Redirecting to secure payment…",
    successTitle: "Order confirmed.",
    successText: "Your order is confirmed and can be tracked from your account once you sign in.",
    pendingTitle: "Order created — payment pending.",
    pendingText: "The order exists, but the payment redirect was not returned. Do not place a duplicate order; retry payment from the order when available.",
    failedTitle: "Checkout was not completed.",
    continueShopping: "Continue shopping",
    orderLabel: "Order",
  },
  ar: {
    secure: "إتمام طلب آمن · مشفر",
    title: "إتمام الطلب",
    intro: "تقدر تكمل كزائر. سجّل الدخول فقط لو عايز العناوين المحفوظة والنقاط وسجل الطلبات.",
    delivery: "التوصيل",
    payment: "الدفع",
    review: "المراجعة",
    fullName: "الاسم بالكامل",
    fullNamePlaceholder: "محمد أنور",
    email: "البريد الإلكتروني",
    emailPlaceholder: "name@example.com",
    phone: "رقم الموبايل",
    phonePlaceholder: "01X XXX XXXX",
    governorate: "المحافظة",
    governoratePlaceholder: "القاهرة",
    street: "العنوان بالتفصيل",
    streetPlaceholder: "المبنى، الشارع، المنطقة",
    choosePayment: "اختار طريقة الدفع المناسبة.",
    card: "بطاقة ائتمان أو خصم",
    cardMeta: "Visa · Mastercard · Meeza",
    wallet: "محفظة موبايل",
    walletMeta: "ادفع باستخدام محفظة مدعومة",
    instapay: "InstaPay",
    instapayMeta: "ادفع من حساب InstaPay",
    cod: "الدفع عند الاستلام",
    codMeta: "متاح للطلبات المؤهلة",
    reviewMeta: "عنوان التوصيل · طريقة الدفع · المنتجات · الإجمالي النهائي",
    placeOrder: "تأكيد الطلب",
    placing: "جارٍ تأكيد الطلب…",
    yourOrder: "ملخص الطلب",
    qty: "الكمية",
    subtotal: "المنتجات",
    shipping: "الشحن",
    calculated: "يُحسب في الخطوة التالية",
    vat: "الضريبة",
    included: "مشمولة",
    total: "الإجمالي",
    encrypted: "دفع مشفر · اتصال HTTPS آمن",
    empty: "السلة فاضية.",
    back: "ارجع للكتالوج",
    loadError: "تعذر تحميل جلسة إتمام الطلب.",
    retry: "حاول تاني",
    redirecting: "تم إنشاء الطلب. جاري التحويل لصفحة الدفع الآمنة…",
    successTitle: "تم تأكيد الطلب.",
    successText: "طلبك اتأكد وتقدر تتابعه من حسابك بعد تسجيل الدخول.",
    pendingTitle: "تم إنشاء الطلب — الدفع قيد الانتظار.",
    pendingText: "الطلب اتسجل، لكن رابط الدفع ما رجعش. ما تعملش طلب مكرر؛ أعد محاولة الدفع من الطلب لما يبقى متاح.",
    failedTitle: "إتمام الطلب ما اكتملش.",
    continueShopping: "كمّل تسوق",
    orderLabel: "طلب",
  },
} as const;

function formatEgp(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value);
}

export function CheckoutPage() {
  const [locale, setLocale] = useStoreLocale();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<GuestCartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>("card");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const text = copy[locale];

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await loadGuestCart(locale));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void reload(); }, [reload]);

  const items = snapshot?.items ?? [];
  const subtotal = cartSubtotal(items);

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || items.length === 0 || submitState.status === "submitting") return;
    const form = new FormData(event.currentTarget);
    const details: CheckoutDetails = {
      fullName: String(form.get("fullName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      governorate: String(form.get("governorate") ?? "").trim(),
      shippingAddress: String(form.get("street") ?? "").trim(),
      paymentMethod: payment === "cod" ? "cash_on_delivery" : payment === "card" ? "credit_card" : "instapay",
      useLoyaltyPoints: false,
    };

    setSubmitState({ status: "submitting" });
    try {
      const result: CheckoutResult = await submitCheckout(details, undefined, snapshot.sessionId);
      if (result.paymentGatewayUrl) {
        setSubmitState({ status: "redirecting", orderNumber: result.orderNumber });
        window.location.assign(result.paymentGatewayUrl);
        return;
      }
      if (payment === "cod") setSubmitState({ status: "success", orderNumber: result.orderNumber });
      else setSubmitState({ status: "pending", orderNumber: result.orderNumber });
    } catch (error) {
      const message = error instanceof Error ? error.message : text.failedTitle;
      setSubmitState({ status: "error", message });
    }
  }

  if (submitState.status === "success" || submitState.status === "pending" || submitState.status === "redirecting" || submitState.status === "error") {
    return (
      <div className="el-checkout-page">
        <div className="el-checkout-result-shell">
          <ElitedomBrand />
          <CheckoutResultPanel locale={locale} state={submitState} />
        </div>
      </div>
    );
  }

  return (
    <div className="el-checkout-page">
      <div className="el-storefront__shell">
        <header className="el-checkout-header">
          <Link to="/"><ElitedomBrand /></Link>
          <span><StoreIcon name="warranty" size={16} />{text.secure}</span>
        </header>

        <main>
          <section className="el-checkout-intro">
            <h1>{text.title}</h1>
            <p>{text.intro}</p>
            <div className="el-checkout-steps">
              <span className="is-active">01 · {text.delivery}</span>
              <span className="is-active">02 · {text.payment}</span>
              <span>03 · {text.review}</span>
            </div>
          </section>

          {loading ? <div className="el-checkout-loading"><div /><div /></div> : null}
          {!loading && loadError ? (
            <div className="el-cart-empty"><StoreIcon name="returns" size={30} /><h2>{text.loadError}</h2><button onClick={() => void reload()} type="button">{text.retry}</button></div>
          ) : null}
          {!loading && !loadError && items.length === 0 ? (
            <div className="el-cart-empty"><StoreIcon name="cart" size={34} /><h2>{text.empty}</h2><Link to="/catalog">{text.back} <StoreIcon name="arrow" size={15} /></Link></div>
          ) : null}

          {!loading && !loadError && items.length > 0 ? (
            <form className="el-checkout-layout" onSubmit={placeOrder}>
              <div className="el-checkout-form-stack">
                <section className="el-checkout-panel">
                  <PanelHeading number="01" title={text.delivery} />
                  <div className="el-checkout-fields">
                    <CheckoutField icon="account" label={text.fullName} name="fullName" placeholder={text.fullNamePlaceholder} required />
                    <CheckoutField icon="mail" label={text.email} name="email" placeholder={text.emailPlaceholder} required type="email" />
                    <div className="el-checkout-fields__two">
                      <CheckoutField icon="phone" label={text.phone} name="phone" pattern="^(?:\+20|0)1[0125][0-9]{8}$" placeholder={text.phonePlaceholder} required type="tel" />
                      <CheckoutField icon="location" label={text.governorate} name="governorate" placeholder={text.governoratePlaceholder} required />
                    </div>
                    <CheckoutField icon="location" label={text.street} minLength={5} name="street" placeholder={text.streetPlaceholder} required />
                  </div>
                </section>

                <section className="el-checkout-panel">
                  <PanelHeading number="02" title={text.payment} />
                  <p className="el-checkout-panel__hint">{text.choosePayment}</p>
                  <div className="el-payment-methods">
                    <PaymentMethod active={payment === "card"} icon="payment" meta={text.cardMeta} onSelect={() => setPayment("card")} title={text.card} />
                    <PaymentMethod active={payment === "wallet"} icon="wallet" meta={text.walletMeta} onSelect={() => setPayment("wallet")} title={text.wallet} />
                    <PaymentMethod active={payment === "instapay"} icon="bank" meta={text.instapayMeta} onSelect={() => setPayment("instapay")} title={text.instapay} />
                    <PaymentMethod active={payment === "cod"} icon="cash" meta={text.codMeta} onSelect={() => setPayment("cod")} title={text.cod} />
                  </div>
                </section>

                <section className="el-checkout-panel el-checkout-review">
                  <PanelHeading number="03" title={text.review} />
                  <p>{text.reviewMeta}</p>
                  <button className="el-place-order" disabled={submitState.status === "submitting"} type="submit">
                    <StoreIcon name="check" size={17} />
                    {submitState.status === "submitting" ? text.placing : `${text.placeOrder} — ${formatEgp(subtotal, locale)} EGP`}
                  </button>
                </section>
              </div>

              <aside className="el-order-summary el-order-summary--checkout">
                <h2>{text.yourOrder}</h2>
                <div className="el-checkout-summary-items">
                  {items.map((item) => (
                    <div className="el-checkout-summary-item" key={item.serverItemId ?? item.product.id}>
                      <div><img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={item.product.image} /></div>
                      <span><strong>{item.product.name}</strong><small>{text.qty} {item.quantity}</small></span>
                      <b>{formatEgp(item.product.priceEgp * item.quantity, locale)} EGP</b>
                    </div>
                  ))}
                </div>
                <div className="el-summary-divider" />
                <SummaryRow label={text.subtotal} value={`${formatEgp(subtotal, locale)} EGP`} />
                <SummaryRow label={text.shipping} value={text.calculated} />
                <SummaryRow label={text.vat} value={text.included} />
                <SummaryRow emphasis label={text.total} value={`${formatEgp(subtotal, locale)} EGP`} />
                <p className="el-summary-security">{text.encrypted}</p>
              </aside>
            </form>
          ) : null}
        </main>

        <StoreFooter locale={locale} />
      </div>
    </div>
  );
}

function PanelHeading({ number, title }: { number: string; title: string }) {
  return <div className="el-panel-heading"><span>{number}</span><h2>{title}</h2></div>;
}

function CheckoutField({ icon, label, ...inputProps }: { icon: StoreIconName; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="el-checkout-field">
      <span>{label}</span>
      <div><StoreIcon name={icon} size={18} /><input {...inputProps} /></div>
    </label>
  );
}

function PaymentMethod({ active, icon, title, meta, onSelect }: { active: boolean; icon: StoreIconName; title: string; meta: string; onSelect: () => void }) {
  return (
    <button aria-pressed={active} className={active ? "el-payment-method is-active" : "el-payment-method"} onClick={onSelect} type="button">
      <span className="el-payment-method__icon"><StoreIcon name={icon} size={22} /></span>
      <span className="el-payment-method__copy"><strong>{title}</strong><small>{meta}</small></span>
      <i />
    </button>
  );
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? "el-summary-row is-emphasis" : "el-summary-row"}><span>{label}</span><strong>{value}</strong></div>;
}

function CheckoutResultPanel({ locale, state }: { locale: "en" | "ar"; state: Exclude<SubmitState, { status: "idle" } | { status: "submitting" }> }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const title = state.status === "success" ? text.successTitle : state.status === "pending" ? text.pendingTitle : state.status === "redirecting" ? text.redirecting : text.failedTitle;
  const body = state.status === "success" ? text.successText : state.status === "pending" ? text.pendingText : state.status === "redirecting" ? text.encrypted : state.message;
  const orderNumber = "orderNumber" in state ? state.orderNumber : undefined;
  return (
    <main className={`el-checkout-result el-checkout-result--${state.status}`}>
      <span className="el-checkout-result__icon"><StoreIcon name={state.status === "error" ? "returns" : "check"} size={30} /></span>
      <p className="el-commerce-crumb">{orderNumber ? `${text.orderLabel} ${orderNumber}` : text.secure}</p>
      <h1>{title}</h1>
      <p>{body}</p>
      {state.status !== "redirecting" ? <button onClick={() => navigate("/catalog")} type="button">{text.continueShopping} <StoreIcon name="arrow" size={15} /></button> : null}
    </main>
  );
}
