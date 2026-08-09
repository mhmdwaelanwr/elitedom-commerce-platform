import { Link } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import type { StoreLocale } from "@/components/store/StoreHeader";

type StoreFooterProps = {
  locale: StoreLocale;
};

type FooterItem = { label: string; href?: string };
type FooterGroup = { title: string; items: FooterItem[] };

const footerCopy: Record<StoreLocale, {
  tagline: string;
  vat: string;
  country: string;
  groups: FooterGroup[];
  legal: string[];
}> = {
  en: {
    tagline: "Premium hardware. Clear decisions. Real support.",
    vat: "Prices include VAT where applicable.",
    country: "Egypt",
    groups: [
      { title: "Shop", items: [{ label: "GPUs", href: "/catalog" }, { label: "CPUs", href: "/catalog?q=CPU" }, { label: "PC builds", href: "/catalog?q=PC%20build" }, { label: "Displays", href: "/catalog?q=Monitor" }, { label: "Peripherals", href: "/catalog?q=peripheral" }] },
      { title: "Orders", items: [{ label: "My orders", href: "/account?section=orders" }, { label: "Delivery", href: "/account?section=orders" }, { label: "Returns", href: "/account/warranty" }, { label: "Warranty", href: "/account/warranty" }] },
      { title: "Support", items: [{ label: "Account security", href: "/account?section=security" }, { label: "Saved hardware", href: "/account?section=saved" }, { label: "Warranty & RMA", href: "/account/warranty" }, { label: "Business support", href: "/business" }] },
      { title: "Business", items: [{ label: "B2B & RFQ", href: "/business" }, { label: "Request a quote", href: "/business/rfq" }, { label: "Enterprise sourcing", href: "/business" }, { label: "Business account", href: "/business" }] },
    ],
    legal: ["Privacy", "Terms", "Warranty", "Accessibility"],
  },
  ar: {
    tagline: "هاردوير احترافي. قرار أوضح. دعم حقيقي.",
    vat: "الأسعار تشمل ضريبة القيمة المضافة حيث تُطبق.",
    country: "مصر",
    groups: [
      { title: "تسوّق", items: [{ label: "كروت الشاشة", href: "/catalog" }, { label: "المعالجات", href: "/catalog?q=CPU" }, { label: "تجميعات PC", href: "/catalog?q=PC%20build" }, { label: "الشاشات", href: "/catalog?q=Monitor" }, { label: "الإكسسوارات", href: "/catalog?q=peripheral" }] },
      { title: "طلباتك", items: [{ label: "طلباتي", href: "/account?section=orders" }, { label: "التوصيل", href: "/account?section=orders" }, { label: "المرتجعات", href: "/account/warranty" }, { label: "الضمان", href: "/account/warranty" }] },
      { title: "الدعم", items: [{ label: "أمان الحساب", href: "/account?section=security" }, { label: "الهاردوير المحفوظ", href: "/account?section=saved" }, { label: "الضمان وRMA", href: "/account/warranty" }, { label: "دعم الشركات", href: "/business" }] },
      { title: "للشركات", items: [{ label: "B2B و RFQ", href: "/business" }, { label: "طلب عرض سعر", href: "/business/rfq" }, { label: "توريد الشركات", href: "/business" }, { label: "حساب أعمال", href: "/business" }] },
    ],
    legal: ["الخصوصية", "الشروط", "الضمان", "إتاحة الاستخدام"],
  },
};

export function StoreFooter({ locale }: StoreFooterProps) {
  const copy = footerCopy[locale];

  return (
    <footer className="el-store-footer">
      <div className="el-store-footer__main">
        <div className="el-store-footer__brand">
          <ElitedomBrand />
          <p>{copy.tagline}</p>
        </div>

        <div className="el-store-footer__groups">
          {copy.groups.map((group) => (
            <div className="el-store-footer__group" key={group.title}>
              <strong>{group.title}</strong>
              {group.items.map((item) => item.href
                ? <Link key={`${group.title}-${item.label}`} to={item.href}>{item.label}</Link>
                : <span key={`${group.title}-${item.label}`}>{item.label}</span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="el-store-footer__divider" />

      <div className="el-store-footer__legal">
        <div className="el-store-footer__legal-left">
          <span className="el-store-footer__vat">{copy.vat}</span>
          <span className="el-country-pill"><span /> {copy.country}</span>
          <div className="el-store-footer__legal-links" aria-label={locale === "ar" ? "معلومات قانونية" : "Legal information"}>
            {copy.legal.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="el-store-footer__social-text" aria-label={locale === "ar" ? "قنوات Elitedom" : "Elitedom channels"}>
          <span>X</span>
          <span>Instagram</span>
          <span>Facebook</span>
          <span>YouTube</span>
        </div>
      </div>
    </footer>
  );
}
