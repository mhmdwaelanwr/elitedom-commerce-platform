import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import {
  oauthLogin,
  passwordLogin,
  requestPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/auth-api";
import { completeAuthentication, readStoredSession } from "@/lib/auth-session";
import { registerAccount } from "@/lib/auth-registration";
import { getAppleIdToken, getGoogleIdToken } from "@/lib/oauth-client";
import "@/styles/auth.css";

export type AuthMode = "sign-in" | "create" | "otp" | "forgot" | "reset";
type OtpPurpose = "sign-in" | "create" | "recovery";
type StoredOtp = {
  challengeId: string;
  mobile: string;
  name?: string;
  purpose: OtpPurpose;
  resendAt: number;
  expiresAt: number;
  debugCode?: string;
  next: string;
};

const OTP_KEY = "elitedom-auth-otp";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function authHref(path: string, next: string) {
  const suffix = next !== "/account" ? `?next=${encodeURIComponent(next)}` : "";
  return `${path}${suffix}`;
}

function cleanPhone(value: string) {
  return value.replace(/[\s\-()]/g, "");
}

function isEgyptianPhone(value: string) {
  return /^(?:\+20|0)1[0125]\d{8}$/.test(cleanPhone(value));
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passwordError(value: string) {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(value)) return "Add at least one lowercase letter.";
  if (!/\d/.test(value)) return "Add at least one number.";
  if (!/[!@#$%^&*(),.?'":{}|<>]/.test(value)) return "Add at least one special character.";
  return "";
}

function saveOtp(value: StoredOtp) {
  window.sessionStorage.setItem(OTP_KEY, JSON.stringify(value));
}

function readOtp(): StoredOtp | null {
  try {
    const raw = window.sessionStorage.getItem(OTP_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredOtp;
    return value?.challengeId && value?.mobile ? value : null;
  } catch {
    return null;
  }
}

function clearOtp() {
  window.sessionStorage.removeItem(OTP_KEY);
}

const copy = {
  en: {
    signInTitle: "Welcome back",
    signInCopy: "Sign in to manage orders, saved items and account details.",
    identifier: "Email or phone",
    identifierPlaceholder: "you@example.com or 01X XXX XXXX",
    password: "Password",
    passwordPlaceholder: "Your password",
    forgot: "Forgot password?",
    signIn: "Sign in",
    sendCode: "Send verification code",
    newAccount: "New to Elitedom?",
    createLink: "Create account",
    terms: "By continuing, you agree to the Terms and Privacy Policy.",
    or: "or",
    phoneHint: "Phone sign-in uses a secure one-time code instead of your password.",
    createTitle: "Create your account",
    createCopy: "Use Google, Apple, email or phone. You can change sign-in methods later.",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    mobile: "Mobile number",
    mobilePlaceholder: "01X XXX XXXX",
    create: "Create account",
    creating: "Creating account…",
    verifyTitle: "Verify your phone",
    verifyCopy: "Enter the 6-digit code sent to",
    verify: "Verify code",
    verifying: "Verifying…",
    resend: "Resend code",
    useAnother: "Use another phone number",
    secureOtp: "Encrypted verification · One-time code expires in 5 minutes",
    recoveryTitle: "Reset your password",
    recoveryCopy: "Enter the phone number linked to your account and we’ll verify it securely.",
    account: "ACCOUNT",
    recover: "Send recovery code",
    back: "Back to sign in",
    resetTitle: "Choose a new password",
    resetCopy: "Your phone was verified. Set a strong new password for your Elitedom account.",
    newPassword: "New password",
    resetAction: "Update password",
    resetPending: "Updating…",
    recovered: "Password updated. Sign in with your new password.",
    missingRecovery: "Your recovery verification session is missing or expired.",
    emailRecoveryGap: "Email recovery links are not configured yet. Use the verified phone number linked to your account.",
    providerError: "Provider sign-in could not be completed.",
    invalidIdentifier: "Enter a valid email address or Egyptian mobile number.",
  },
  ar: {
    signInTitle: "أهلاً برجوعك",
    signInCopy: "سجّل الدخول لإدارة الطلبات والمحفوظات وبيانات الحساب.",
    identifier: "البريد الإلكتروني أو الموبايل",
    identifierPlaceholder: "you@example.com أو 01X XXX XXXX",
    password: "كلمة المرور",
    passwordPlaceholder: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    signIn: "تسجيل الدخول",
    sendCode: "إرسال كود التحقق",
    newAccount: "أول مرة على Elitedom؟",
    createLink: "إنشاء حساب",
    terms: "بالمتابعة أنت توافق على الشروط وسياسة الخصوصية.",
    or: "أو",
    phoneHint: "الدخول بالموبايل بيستخدم كود تحقق لمرة واحدة بدل كلمة المرور.",
    createTitle: "أنشئ حسابك",
    createCopy: "استخدم Google أو Apple أو البريد أو الموبايل.",
    fullName: "الاسم بالكامل",
    fullNamePlaceholder: "اسمك",
    mobile: "رقم الموبايل",
    mobilePlaceholder: "01X XXX XXXX",
    create: "إنشاء حساب",
    creating: "جارٍ إنشاء الحساب…",
    verifyTitle: "أكد رقم الموبايل",
    verifyCopy: "اكتب الكود المكون من 6 أرقام المرسل إلى",
    verify: "تأكيد الكود",
    verifying: "جارٍ التحقق…",
    resend: "إعادة إرسال الكود",
    useAnother: "استخدم رقم موبايل آخر",
    secureOtp: "تحقق مشفر · الكود صالح لمدة 5 دقائق",
    recoveryTitle: "استرجاع كلمة المرور",
    recoveryCopy: "اكتب رقم الموبايل المرتبط بالحساب علشان نتحقق منه بأمان.",
    account: "الحساب",
    recover: "إرسال كود الاسترجاع",
    back: "رجوع لتسجيل الدخول",
    resetTitle: "اختار كلمة مرور جديدة",
    resetCopy: "تم تأكيد رقمك. اختار كلمة مرور قوية لحساب Elitedom.",
    newPassword: "كلمة المرور الجديدة",
    resetAction: "تحديث كلمة المرور",
    resetPending: "جارٍ التحديث…",
    recovered: "تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.",
    missingRecovery: "جلسة استرجاع الحساب غير موجودة أو انتهت.",
    emailRecoveryGap: "استرجاع كلمة المرور بالإيميل لسه غير مفعّل. استخدم رقم الموبايل الموثق بالحساب.",
    providerError: "تعذر إكمال تسجيل الدخول بمزود الحساب.",
    invalidIdentifier: "اكتب بريد إلكتروني صحيح أو رقم موبايل مصري صحيح.",
  },
} as const;

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [locale] = useStoreLocale();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  return (
    <AuthShell locale={locale}>
      <ElitedomBrand compact />
      {mode === "sign-in" ? <SignIn locale={locale} next={next} /> : null}
      {mode === "create" ? <CreateAccount locale={locale} next={next} /> : null}
      {mode === "otp" ? <OtpVerification locale={locale} next={next} /> : null}
      {mode === "forgot" ? <ForgotPassword locale={locale} next={next} /> : null}
      {mode === "reset" ? <ResetPassword locale={locale} next={next} /> : null}
    </AuthShell>
  );
}

function SignIn({ locale, next }: { locale: "en" | "ar"; next: string }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const phone = isEgyptianPhone(identifier);

  async function finish(session: Awaited<ReturnType<typeof passwordLogin>>) {
    await completeAuthentication(session);
    navigate(next, { replace: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!phone && !isEmail(identifier)) {
      setError(text.invalidIdentifier);
      return;
    }
    setPending(true);
    try {
      if (phone) {
        const challenge = await requestPhoneOtp({ mobile: identifier });
        saveOtp({
          challengeId: challenge.challengeId,
          mobile: identifier,
          purpose: "sign-in",
          resendAt: Date.now() + challenge.resendAfter * 1000,
          expiresAt: Date.now() + challenge.expiresIn * 1000,
          debugCode: challenge.debugCode,
          next,
        });
        navigate(authHref("/auth/otp", next));
      } else {
        await finish(await passwordLogin({ email: identifier.trim(), password }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  async function provider(providerName: "google" | "apple") {
    setPending(true);
    setError("");
    try {
      const idToken = providerName === "google" ? await getGoogleIdToken() : await getAppleIdToken();
      await finish(await oauthLogin(providerName, idToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.providerError);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2>{text.signInTitle}</h2>
      <p className="el-auth-card__intro">{text.signInCopy}</p>
      <AuthProviderButton disabled={pending} locale={locale} onClick={() => void provider("google")} provider="google" />
      <AuthProviderButton disabled={pending} locale={locale} onClick={() => void provider("apple")} provider="apple" />
      <AuthSeparator label={text.or} />
      <form className="el-auth-form" onSubmit={submit}>
        <AuthField autoComplete="username" icon="mail" label={text.identifier} onChange={setIdentifier} placeholder={text.identifierPlaceholder} value={identifier} />
        {phone ? <p className="el-auth-inline-note"><StoreIcon name="phone" size={14} />{text.phoneHint}</p> : (
          <AuthField
            autoComplete="current-password"
            icon="lock"
            label={text.password}
            onChange={setPassword}
            placeholder={text.passwordPlaceholder}
            required
            type={showPassword ? "text" : "password"}
            value={password}
            trailing={<button aria-label="Toggle password visibility" className="el-auth-eye" onClick={() => setShowPassword((shown) => !shown)} type="button"><StoreIcon name="eye" size={18} /></button>}
          />
        )}
        <Link className="el-auth-link" to={authHref("/auth/forgot", next)}>{text.forgot}</Link>
        {error ? <p className="el-auth-error" role="alert">{error}</p> : null}
        <button className="el-auth-primary" disabled={pending} type="submit">{pending ? "…" : phone ? text.sendCode : text.signIn}</button>
      </form>
      <p className="el-auth-switch">{text.newAccount} <Link to={authHref("/auth/create", next)}>{text.createLink}</Link></p>
      <p className="el-auth-legal">{text.terms}</p>
    </>
  );
}

function CreateAccount({ locale, next }: { locale: "en" | "ar"; next: string }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const phone = isEgyptianPhone(identifier);

  async function finish(session: Awaited<ReturnType<typeof passwordLogin>>) {
    await completeAuthentication(session);
    navigate(next, { replace: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return;
    if (phone) {
      setPending(true);
      try {
        const challenge = await requestPhoneOtp({ mobile: identifier, name: name.trim() });
        saveOtp({
          challengeId: challenge.challengeId,
          mobile: identifier,
          name: name.trim(),
          purpose: "create",
          resendAt: Date.now() + challenge.resendAfter * 1000,
          expiresAt: Date.now() + challenge.expiresIn * 1000,
          debugCode: challenge.debugCode,
          next,
        });
        navigate(authHref("/auth/otp", next));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Account creation failed.");
      } finally {
        setPending(false);
      }
      return;
    }
    if (!isEmail(identifier)) {
      setError(text.invalidIdentifier);
      return;
    }
    if (!isEgyptianPhone(mobile)) {
      setError(locale === "ar" ? "اكتب رقم موبايل مصري صحيح." : "Enter a valid Egyptian mobile number.");
      return;
    }
    const strengthError = passwordError(password);
    if (strengthError) {
      setError(locale === "ar" ? "كلمة المرور لازم تكون 8 أحرف على الأقل وتحتوي حرف كبير وصغير ورقم ورمز." : strengthError);
      return;
    }
    setPending(true);
    try {
      await registerAccount({ name: name.trim(), email: identifier.trim(), mobile, password });
      await finish(await passwordLogin({ email: identifier.trim(), password }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account creation failed.");
    } finally {
      setPending(false);
    }
  }

  async function provider(providerName: "google" | "apple") {
    setPending(true);
    setError("");
    try {
      const idToken = providerName === "google" ? await getGoogleIdToken() : await getAppleIdToken();
      await finish(await oauthLogin(providerName, idToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.providerError);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2>{text.createTitle}</h2>
      <p className="el-auth-card__intro">{text.createCopy}</p>
      <AuthProviderButton disabled={pending} locale={locale} onClick={() => void provider("google")} provider="google" />
      <AuthProviderButton disabled={pending} locale={locale} onClick={() => void provider("apple")} provider="apple" />
      <AuthSeparator label={text.or} />
      <form className="el-auth-form" onSubmit={submit}>
        <AuthField autoComplete="name" icon="account" label={text.fullName} onChange={setName} placeholder={text.fullNamePlaceholder} required value={name} />
        <AuthField autoComplete="username" icon="mail" label={text.identifier} onChange={setIdentifier} placeholder={text.identifierPlaceholder} required value={identifier} />
        {!phone && isEmail(identifier) ? <AuthField autoComplete="tel" icon="phone" label={text.mobile} onChange={setMobile} placeholder={text.mobilePlaceholder} required value={mobile} /> : null}
        {!phone ? <AuthField
          autoComplete="new-password"
          icon="lock"
          label={text.password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          required
          type={showPassword ? "text" : "password"}
          value={password}
          trailing={<button aria-label="Toggle password visibility" className="el-auth-eye" onClick={() => setShowPassword((shown) => !shown)} type="button"><StoreIcon name="eye" size={18} /></button>}
        /> : <p className="el-auth-inline-note"><StoreIcon name="phone" size={14} />{text.phoneHint}</p>}
        {error ? <p className="el-auth-error" role="alert">{error}</p> : null}
        <button className="el-auth-primary" disabled={pending} type="submit">{pending ? text.creating : phone ? text.sendCode : text.create}</button>
      </form>
      <p className="el-auth-switch"><Link to={authHref("/auth", next)}>{text.back}</Link></p>
      <p className="el-auth-legal">{text.terms}</p>
    </>
  );
}

function OtpVerification({ locale, next }: { locale: "en" | "ar"; next: string }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<StoredOtp | null>(() => readOtp());
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function keyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  }

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!code) return;
    event.preventDefault();
    const nextDigits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");
    setDigits(nextDigits);
    refs.current[Math.min(code.length, 6) - 1]?.focus();
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) {
      setError(locale === "ar" ? "اكتب الكود كامل." : "Enter the complete 6-digit code.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const session = await verifyPhoneOtp({ challengeId: challenge.challengeId, mobile: challenge.mobile, code });
      await completeAuthentication(session);
      clearOtp();
      navigate(challenge.purpose === "recovery" ? authHref("/auth/reset", challenge.next) : challenge.next || next, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (!challenge || clock < challenge.resendAt) return;
    setPending(true);
    setError("");
    try {
      const renewed = await requestPhoneOtp({ mobile: challenge.mobile, name: challenge.name });
      const nextChallenge = {
        ...challenge,
        challengeId: renewed.challengeId,
        resendAt: Date.now() + renewed.resendAfter * 1000,
        expiresAt: Date.now() + renewed.expiresIn * 1000,
        debugCode: renewed.debugCode,
      };
      saveOtp(nextChallenge);
      setChallenge(nextChallenge);
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not resend code.");
    } finally {
      setPending(false);
    }
  }

  if (!challenge) {
    return <AuthMessage title={text.verifyTitle} message={locale === "ar" ? "ابدأ تسجيل الدخول برقم الموبايل الأول." : "Start with your phone number to request a verification code."} href={authHref("/auth", next)} action={text.back} />;
  }

  const seconds = Math.max(0, Math.ceil((challenge.resendAt - clock) / 1000));
  return (
    <>
      <h2>{text.verifyTitle}</h2>
      <p className="el-auth-card__intro el-auth-destination"><StoreIcon name="phone" size={16} />{text.verifyCopy} <strong>{maskPhone(challenge.mobile)}</strong>.</p>
      <form className="el-auth-form" onSubmit={verify}>
        <div className="el-otp-cells" dir="ltr">
          {digits.map((digit, index) => <input
            aria-label={`OTP digit ${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            inputMode="numeric"
            key={index}
            maxLength={1}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => keyDown(index, event)}
            onPaste={paste}
            ref={(node) => { refs.current[index] = node; }}
            value={digit}
          />)}
        </div>
        {challenge.debugCode ? <p className="el-auth-dev-code">DEV OTP: {challenge.debugCode}</p> : null}
        {error ? <p className="el-auth-error" role="alert">{error}</p> : null}
        <button className="el-auth-primary" disabled={pending} type="submit">{pending ? text.verifying : text.verify}</button>
      </form>
      <button className="el-auth-text-button" disabled={pending || seconds > 0} onClick={() => void resend()} type="button">{seconds > 0 ? `${text.resend} 00:${String(seconds).padStart(2, "0")}` : text.resend}</button>
      <Link className="el-auth-secondary-link" onClick={clearOtp} to={authHref(challenge.purpose === "create" ? "/auth/create" : challenge.purpose === "recovery" ? "/auth/forgot" : "/auth", challenge.next)}>{text.useAnother}</Link>
      <p className="el-auth-security-note"><StoreIcon name="shield" size={16} />{text.secureOtp}</p>
    </>
  );
}

function ForgotPassword({ locale, next }: { locale: "en" | "ar"; next: string }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isEmail(identifier)) {
      setError(text.emailRecoveryGap);
      return;
    }
    if (!isEgyptianPhone(identifier)) {
      setError(text.invalidIdentifier);
      return;
    }
    setPending(true);
    try {
      const challenge = await requestPhoneOtp({ mobile: identifier });
      saveOtp({
        challengeId: challenge.challengeId,
        mobile: identifier,
        purpose: "recovery",
        resendAt: Date.now() + challenge.resendAfter * 1000,
        expiresAt: Date.now() + challenge.expiresIn * 1000,
        debugCode: challenge.debugCode,
        next,
      });
      navigate(authHref("/auth/otp", next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Recovery could not be started.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="el-auth-recovery-panel">
      <div className="el-auth-recovery-icon"><StoreIcon name="mail" size={24} /></div>
      <h2>{text.recoveryTitle}</h2>
      <p className="el-auth-card__intro">{text.recoveryCopy}</p>
      <form className="el-auth-form" onSubmit={submit}>
        <AuthField icon="phone" label={text.account} onChange={setIdentifier} placeholder={text.identifierPlaceholder} required value={identifier} />
        {error ? <p className="el-auth-error" role="alert">{error}</p> : null}
        <button className="el-auth-primary el-auth-primary--fit" disabled={pending} type="submit">{pending ? "…" : text.recover}</button>
      </form>
      <Link className="el-auth-link" to={authHref("/auth", next)}>{text.back}</Link>
    </div>
  );
}

function ResetPassword({ locale, next }: { locale: "en" | "ar"; next: string }) {
  const text = copy[locale];
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const session = readStoredSession();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = passwordError(password);
    if (issue) {
      setError(locale === "ar" ? "كلمة المرور لازم تكون 8 أحرف على الأقل وتحتوي حرف كبير وصغير ورقم ورمز." : issue);
      return;
    }
    if (!session) {
      setError(text.missingRecovery);
      return;
    }
    setPending(true);
    setError("");
    try {
      const { recoverPassword } = await import("@/lib/auth-api");
      await recoverPassword(password, session);
      navigate(authHref("/auth", next), { replace: true, state: { message: text.recovered } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="el-auth-recovery-panel">
      <div className="el-auth-recovery-icon"><StoreIcon name="lock" size={24} /></div>
      <h2>{text.resetTitle}</h2>
      <p className="el-auth-card__intro">{text.resetCopy}</p>
      <form className="el-auth-form" onSubmit={submit}>
        <AuthField
          autoComplete="new-password"
          icon="lock"
          label={text.newPassword}
          onChange={setPassword}
          placeholder="At least 8 characters"
          required
          type={showPassword ? "text" : "password"}
          value={password}
          trailing={<button aria-label="Toggle password visibility" className="el-auth-eye" onClick={() => setShowPassword((shown) => !shown)} type="button"><StoreIcon name="eye" size={18} /></button>}
        />
        {error ? <p className="el-auth-error" role="alert">{error}</p> : null}
        <button className="el-auth-primary el-auth-primary--fit" disabled={pending} type="submit">{pending ? text.resetPending : text.resetAction}</button>
      </form>
      <Link className="el-auth-link" to={authHref("/auth", next)}>{text.back}</Link>
    </div>
  );
}

function AuthSeparator({ label }: { label: string }) {
  return <div className="el-auth-separator"><span />{label}<span /></div>;
}

function AuthField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  autoComplete,
  trailing,
}: {
  label: string;
  icon: "account" | "mail" | "phone" | "lock";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="el-auth-field">
      <span>{label}</span>
      <div>
        <StoreIcon name={icon} size={18} />
        <input autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
        {trailing}
      </div>
    </label>
  );
}

function AuthMessage({ title, message, href, action }: { title: string; message: string; href: string; action: string }) {
  return <div className="el-auth-recovery-panel"><h2>{title}</h2><p className="el-auth-card__intro">{message}</p><Link className="el-auth-primary el-auth-primary--link" to={href}>{action}</Link></div>;
}

function maskPhone(value: string) {
  const clean = cleanPhone(value);
  if (clean.length < 7) return clean;
  return `${clean.slice(0, clean.length - 6)} •••• ${clean.slice(-4)}`;
}
