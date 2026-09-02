import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreIcon, type StoreIconName } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { restoreSession } from "@/lib/auth-session";
import { cartSubtotal, loadGuestCart, type GuestCartSnapshot } from "@/lib/cart-data";
import { submitRoutedCheckout } from "@/lib/checkout-api";
import type { CheckoutDetails, CheckoutResult } from "@/types/store";
import "@/styles/checkout.css";

type PaymentChoice = "card" | "wallet" | "cod";
type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "redirecting"; orderId: number; orderNumber: string }
  | { status: "success"; orderId: number; orderNumber: string }
  | { status: "pending"; orderId: number; orderNumber: string }
  | { status: "error"; message: string };

const EGYPT_GOVERNORATES = [
  ["Cairo", "Cairo", "القاهرة"],
  ["Giza", "Giza", "الجيزة"],
  ["Alexandria", "Alexandria", "الإسكندرية"],
  ["Qalyubia", "Qalyubia", "القليوبية"],
  ["Sharqia", "Sharqia", "الشرقية"],
  ["Dakahlia", "Dakahlia", "الدقهلية"],
  ["Beheira", "Beheira", "البحيرة"],
  ["Gharbia", "Gharbia", "الغربية"],
  ["Monufia", "Monufia", "المنوفية"],
  ["Kafr El Sheikh", "Kafr El Sheikh", "كفر الشيخ"],
  ["Damietta", "Damietta", "دمياط"],
  ["Port Said", "Port Said", "بورسعيد"],
  ["Ismailia", "Ismailia", "الإسماعيلية"],
  ["Suez", "Suez", "السويس"],
  ["Faiyum", "Faiyum", "الفيوم"],
  ["Beni Suef", "Beni Suef", "بني سويف"],
  ["Minya", "Minya", "المنيا"],
  ["Asyut", "Asyut", "أسيوط"],
  ["Sohag", "Sohag", "سوهاج"],
  ["Qena", "Qena", "قنا"],
  ["Luxor", "Luxor", "الأقصر"],
  ["Aswan", "Aswan", "أسوان"],
  ["Red Sea", "Red Sea", "البحر الأحمر"],
  ["New Valley", "New Valley", "الوادي الجديد"],
  ["Matrouh", "Matrouh", "مطروح"],
  ["North Sinai", "North Sinai", "شمال سيناء"],
  ["South Sinai", "South Sinai", "جنوب سيناء"],
] as const;

const copy = {
  en: {
    secure: "Secure checkout · Encrypted", title: "Checkout", intro: "Guest checkout is available. Sign in only if you want saved addresses, loyalty and order history.",
    delivery: "Delivery", payment: "Payment", review: "Review", fullName: "Full name", fullNamePlaceholder: "Mohamed Anwar",
    email: "Email address", emailPlaceholder: "name@example.com", phone: "Phone", phonePlaceholder: "01X XXX XXXX", governorate: "Governorate",
    governoratePlaceholder: "Choose governorate", street: "Street address", streetPlaceholder: "Building, street, district", choosePayment: "Choose how you’d like to pay.",
    card: "Credit / debit card", cardMeta: "Continue through the secure payment provider", wallet: "Mobile wallet", walletMeta: "Continue with a supported mobile wallet",
    cod: "Cash on delivery", codMeta: "Pay when the order is delivered",
    reviewMeta: "Delivery address · payment method · products · estimated total", placeOrder: "Place order", placing: "Placing order…", yourOrder: "Your order",
    qty: "Qty", subtotal: "Products", shipping: "Shipping", calculated: "Confirmed when the order is placed", total: "Estimated pre-shipping total",
    encrypted: "Encrypted checkout · Protected over HTTPS · Full card details are never displayed", empty: "Your cart is empty.", back: "Back to catalogue", loadError: "We could not load your checkout session.",
    retry: "Retry", redirecting: "Redirecting to secure payment", successTitle: "Order confirmed", successText: "Your order was created successfully. Keep the order number for reference.",
    pendingTitle: "Payment confirmation pending", pendingText: "We are waiting for confirmation. Your order is reserved; do not place a duplicate order.",
    failedTitle: "Payment was not completed", failedText: "Your cart is safe. No duplicate charge was created.", submitError: "We could not place the order. Check your delivery and payment details, then try again.",
    trackOrder: "Track order", viewStatus: "View order status", continueShopping: "Continue shopping", tryAgain: "Try payment again", orderLabel: "Order", cartTotal: "Cart total",
  },
  ar: {
    secure: "إتمام طلب آمن · مشفر", title: "إتمام الطلب", intro: "تقدر تكمل كزائر. سجّل الدخول فقط لو عايز العناوين المحفوظة والنقاط وسجل الطلبات.",
    delivery: "التوصيل", payment: "الدفع", review: "المراجعة", fullName: "الاسم بالكامل", fullNamePlaceholder: "محمد أنور",
    email: "البريد الإلكتروني", emailPlaceholder: "name@example.com", phone: "رقم الموبايل", phonePlaceholder: "01X XXX XXXX", governorate: "المحافظة",
    governoratePlaceholder: "اختار المحافظة", street: "العنوان بالتفصيل", streetPlaceholder: "المبنى، الشارع، المنطقة", choosePayment: "اختار طريقة الدفع المناسبة.",
    card: "بطاقة ائتمان أو خصم", cardMeta: "تكمل الدفع من خلال مزود الدفع الآمن", wallet: "محفظة موبايل", walletMeta: "تكمل باستخدام محفظة موبايل مدعومة",
    cod: "الدفع عند الاستلام", codMeta: "ادفع عند استلام الطلب",
    reviewMeta: "عنوان التوصيل · طريقة الدفع · المنتجات · الإجمالي المبدئي", placeOrder: "تأكيد الطلب", placing: "جارٍ تأكيد الطلب…", yourOrder: "ملخص الطلب",
    qty: "الكمية", subtotal: "المنتجات", shipping: "الشحن", calculated: "يتم تأكيده عند إنشاء الطلب", total: "الإجمالي المبدئي قبل الشحن",
    encrypted: "دفع مشفر · اتصال HTTPS آمن · لن نعرض بيانات البطاقة كاملة", empty: "السلة فاضية.", back: "ارجع للكتالوج", loadError: "تعذر تحميل جلسة إتمام الطلب.", retry: "حاول تاني",
    redirecting: "جاري التحويل للدفع الآمن", successTitle: "تم تأكيد الطلب", successText: "تم إنشاء طلبك بنجاح. احتفظ برقم الطلب للرجوع إليه.",
    pendingTitle: "تأكيد الدفع قيد الانتظار", pendingText: "مستنيين تأكيد الدفع وطلبك محجوز. ما تعملش طلب مكرر.",
    failedTitle: "عملية الدفع ما اكتملتش", failedText: "سلتك محفوظة وما اتعملش خصم مكرر.", submitError: "مقدرناش نأكد الطلب. راجع بيانات التوصيل وطريقة الدفع وحاول تاني.",
    trackOrder: "تتبع الطلب", viewStatus: "عرض حالة الطلب", continueShopping: "كمّل تسوق", tryAgain: "حاول الدفع تاني", orderLabel: "طلب", cartTotal: "إجمالي السلة",
  },
} as const;

function formatEgp(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 0 }).format(value);
}

export function CheckoutPage() {
  const [locale, setLocale] = useStoreLocale();
  const [snapshot, setSnapshot] = useState<GuestCartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>("card");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const text = copy[locale];

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const currentSession = await restoreSession();
      setSnapshot(await loadGuestCart(locale, currentSession));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((currentSession) => loadGuestCart(locale, currentSession))
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [locale]);

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
      paymentMethod: payment === "cod" ? "cash_on_delivery" : payment === "card" ? "credit_card" : "mobile_wallet",
      useLoyaltyPoints: false,
    };

    setSubmitState({ status: "submitting" });
    try {
      const result: CheckoutResult & { orderId: number } = await submitRoutedCheckout(details, snapshot.session, snapshot.sessionId);
      if (result.paymentGatewayUrl) {
        setSubmitState({ status: "redirecting", orderId: result.orderId, orderNumber: result.orderNumber });
        window.location.assign(result.paymentGatewayUrl);
        return;
      }
      if (payment === "cod") setSubmitState({ status: "success", orderId: result.orderId, orderNumber: result.orderNumber });
      else setSubmitState({ status: "pending", orderId: result.orderId, orderNumber: result.orderNumber });
    } catch {
      setSubmitState({ status: "error", message: text.submitError });
    }
  }

  if (["success", "pending", "redirecting", "error"].includes(submitState.status)) {
    return (
      <div className="el-checkout-page">
        <div className="el-checkout-result-shell">
          <ElitedomBrand />
          <CheckoutResultPanel
            authenticated={Boolean(snapshot?.session)}
            locale={locale}
            onRetry={() => setSubmitState({ status: "idle" })}
            state={submitState as Exclude<SubmitState, { status: "idle" } | { status: "submitting" }>}
            total={subtotal}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="el-checkout-page">
      <div className="el-storefront__shell">
        <div className="el-checkout-store-header"><StoreHeader locale={locale} onLocaleChange={setLocale} /></div>
        <header className="el-checkout-header"><Link to="/"><ElitedomBrand /></Link><span><StoreIcon name="warranty" size={16} />{text.secure}</span></header>
        <main>
          <section className="el-checkout-intro"><h1>{text.title}</h1><p>{text.intro}</p><div className="el-checkout-steps"><span className="is-active">01 · {text.delivery}</span><span className="is-active">02 · {text.payment}</span><span className="is-active">03 · {text.review}</span></div></section>
          {loading ? <div className="el-checkout-loading"><div /><div /></div> : null}
          {!loading && loadError ? <div className="el-cart-empty"><StoreIcon name="returns" size={30} /><h2>{text.loadError}</h2><button onClick={() => void reload()} type="button">{text.retry}</button></div> : null}
          {!loading && !loadError && items.length === 0 ? <div className="el-cart-empty"><StoreIcon name="cart" size={34} /><h2>{text.empty}</h2><Link to="/catalog">{text.back} <StoreIcon name="arrow" size={15} /></Link></div> : null}
          {!loading && !loadError && items.length > 0 ? (
            <form className="el-checkout-layout" onSubmit={placeOrder}>
              <div className="el-checkout-form-stack">
                <section className="el-checkout-panel el-checkout-delivery">
                  <PanelHeading number="01" title={text.delivery} />
                  <div className="el-checkout-fields">
                    <CheckoutField autoComplete="name" icon="account" label={text.fullName} name="fullName" placeholder={text.fullNamePlaceholder} required />
                    <CheckoutField autoComplete="email" icon="mail" inputMode="email" label={text.email} name="email" placeholder={text.emailPlaceholder} required type="email" />
                    <div className="el-checkout-fields__two">
                      <CheckoutField autoComplete="tel" icon="phone" inputMode="tel" label={text.phone} name="phone" pattern="^(?:\+20|0)1[0125][0-9]{8}$" placeholder={text.phonePlaceholder} required type="tel" />
                      <GovernorateField label={text.governorate} locale={locale} placeholder={text.governoratePlaceholder} />
                    </div>
                    <CheckoutField autoComplete="street-address" icon="location" label={text.street} minLength={5} name="street" placeholder={text.streetPlaceholder} required />
                  </div>
                </section>
                <section className="el-checkout-panel el-checkout-payment">
                  <PanelHeading number="02" title={text.payment} /><p className="el-checkout-panel__hint">{text.choosePayment}</p>
                  <div className="el-payment-methods">
                    <PaymentMethod active={payment === "card"} icon="payment" meta={text.cardMeta} onSelect={() => setPayment("card")} title={text.card} />
                    <PaymentMethod active={payment === "wallet"} icon="wallet" meta={text.walletMeta} onSelect={() => setPayment("wallet")} title={text.wallet} />
                    <PaymentMethod active={payment === "cod"} icon="cash" meta={text.codMeta} onSelect={() => setPayment("cod")} title={text.cod} />
                  </div>
                </section>
                <section className="el-checkout-panel el-checkout-review">
                  <PanelHeading number="03" title={text.review} /><p>{text.reviewMeta}</p>
                  <button className="el-place-order" disabled={submitState.status === "submitting"} type="submit">
                    <StoreIcon name="check" size={17} />
                    {submitState.status === "submitting" ? text.placing : text.placeOrder}
                  </button>
                </section>
                <p className="el-checkout-mobile-security">{text.encrypted}</p>
              </div>
              <aside className="el-order-summary el-order-summary--checkout">
                <h2>{text.yourOrder}</h2>
                <div className="el-checkout-summary-items">
                  {items.map((item) => <div className="el-checkout-summary-item" key={item.serverItemId ?? item.product.id}><div><img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={item.product.image} /></div><span><strong>{item.product.name}</strong><small>{text.qty} {item.quantity}</small></span><b>{formatEgp(item.product.priceEgp * item.quantity, locale)} EGP</b></div>)}
                </div>
                <div className="el-summary-divider" /><SummaryRow label={text.subtotal} value={`${formatEgp(subtotal, locale)} EGP`} /><SummaryRow label={text.shipping} value={text.calculated} /><SummaryRow emphasis label={text.total} value={`${formatEgp(subtotal, locale)} EGP`} /><p className="el-summary-security">{text.encrypted}</p>
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

function CheckoutField({ icon, label, ...inputProps }: { icon: StoreIconName; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const technicalInput = inputProps.type === "email" || inputProps.type === "tel";
  return <label className="el-checkout-field"><span>{label}</span><div><StoreIcon name={icon} size={18} /><input dir={technicalInput ? "ltr" : "auto"} {...inputProps} /></div></label>;
}

function GovernorateField({ label, locale, placeholder }: { label: string; locale: "en" | "ar"; placeholder: string }) {
  return (
    <label className="el-checkout-field">
      <span>{label}</span>
      <div>
        <StoreIcon name="location" size={18} />
        <select
          aria-label={label}
          autoComplete="address-level1"
          defaultValue=""
          name="governorate"
          required
          style={{ minWidth: 0, flex: 1, border: 0, outline: 0, color: "var(--el-text-primary)", background: "transparent", fontSize: 13 }}
        >
          <option disabled value="">{placeholder}</option>
          {EGYPT_GOVERNORATES.map(([value, en, ar]) => <option key={value} value={value}>{locale === "ar" ? ar : en}</option>)}
        </select>
      </div>
    </label>
  );
}

function PaymentMethod({ active, icon, title, meta, onSelect }: { active: boolean; icon: StoreIconName; title: string; meta: string; onSelect: () => void }) {
  return <button aria-pressed={active} className={active ? "el-payment-method is-active" : "el-payment-method"} onClick={onSelect} type="button"><span className="el-payment-method__icon"><StoreIcon name={icon} size={22} /></span><span className="el-payment-method__copy"><strong dir="auto">{title}</strong><small dir="auto">{meta}</small></span><i /></button>;
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? "el-summary-row is-emphasis" : "el-summary-row"}><span>{label}</span><strong>{value}</strong></div>;
}

function CheckoutResultPanel({ authenticated, locale, state, total, onRetry }: { authenticated: boolean; locale: "en" | "ar"; state: Exclude<SubmitState, { status: "idle" } | { status: "submitting" }>; total: number; onRetry: () => void }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const success = state.status === "success";
  const pending = state.status === "pending" || state.status === "redirecting";
  const title = success ? text.successTitle : pending ? (state.status === "redirecting" ? text.redirecting : text.pendingTitle) : text.failedTitle;
  const body = success ? text.successText : pending ? (state.status === "redirecting" ? text.encrypted : text.pendingText) : state.status === "error" ? state.message : text.failedText;
  const orderNumber = "orderNumber" in state ? state.orderNumber : undefined;
  const icon: StoreIconName = success ? "check" : pending ? "clock" : "returns";
  const action = state.status === "error"
    ? text.tryAgain
    : authenticated
      ? (success ? text.trackOrder : text.viewStatus)
      : text.continueShopping;

  function act() {
    if (state.status === "error") {
      onRetry();
      return;
    }
    if (!authenticated) {
      navigate("/catalog");
      return;
    }
    navigate(`/account/orders/${state.orderId}`);
  }

  return (
    <main className={`el-checkout-result el-checkout-result--${state.status}`}>
      <span className="el-checkout-result__icon"><StoreIcon name={icon} size={28} /></span>
      <h1>{title}</h1>
      <p>{body}</p>
      <p className="el-commerce-crumb"><StoreIcon name="package" size={18} />{orderNumber ? `${text.orderLabel} #${orderNumber}` : `${text.cartTotal} ${formatEgp(total, locale)} EGP`}</p>
      <button onClick={act} type="button">{action}</button>
    </main>
  );
}