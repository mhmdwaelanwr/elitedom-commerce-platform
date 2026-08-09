import googleMark from "@/assets/brand/google-g.svg";
import appleMark from "@/assets/brand/apple-mark.svg";

type AuthProviderButtonProps = {
  provider: "google" | "apple";
  disabled?: boolean;
  locale: "en" | "ar";
  onClick: () => void;
};

export function AuthProviderButton({ provider, disabled, locale, onClick }: AuthProviderButtonProps) {
  const google = provider === "google";
  const label = locale === "ar"
    ? google ? "المتابعة باستخدام Google" : "المتابعة باستخدام Apple"
    : google ? "Continue with Google" : "Continue with Apple";
  return (
    <button
      className={`el-auth-provider ${google ? "is-google" : "is-apple"}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="el-auth-provider__mark"><img alt="" aria-hidden="true" src={google ? googleMark : appleMark} /></span>
      <span>{label}</span>
    </button>
  );
}
