import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import type { StoreLocale } from "@/components/store/StoreHeader";

type StoreFooterProps = {
  locale: StoreLocale;
};

const footerCopy = {
  en: {
    tagline: "Premium hardware. Clear decisions. Real support.",
    vat: "Prices include VAT where applicable.",
    country: "Egypt",
    groups: [
      ["Shop", "GPUs", "CPUs", "PC builds", "Displays", "Peripherals"],
      ["Orders", "Track order", "Delivery", "Returns", "Warranty"],
      ["Support", "Help center", "Contact", "Repairs", "Business support"],
      ["Business", "B2B & RFQ", "Bulk orders", "Enterprise sourcing", "Business account"],
    ],
    legal: ["Privacy", "Terms", "Warranty", "Accessibility"],
  },
  ar: {
    tagline: "هاردوير احترافي. قرار أوضح. دعم حقيقي.",
    vat: "الأسعار تشمل ضريبة القيمة المضافة حيث تُطبق.",
    country: "مصر",
    groups: [
      ["تسوّق", "كروت الشاشة", "المعالجات", "تجميعات PC", "الشاشات", "الإكسسوارات"],
      ["طلباتك", "تتبع الطلب", "التوصيل", "المرتجعات", "الضمان"],
      ["الدعم", "مركز المساعدة", "تواصل معنا", "الصيانة", "دعم الشركات"],
      ["للشركات", "B2B و RFQ", "طلبات الكميات", "توريد الشركات", "حساب أعمال"],
    ],
    legal: ["الخصوصية", "الشروط", "الضمان", "إتاحة الاستخدام"],
  },
} as const;

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
          {copy.groups.map(([title, ...items]) => (
            <div className="el-store-footer__group" key={title}>
              <strong>{title}</strong>
              {items.map((item) => <a href="#" key={item}>{item}</a>)}
            </div>
          ))}
        </div>
      </div>

      <div className="el-store-footer__divider" />

      <div className="el-store-footer__legal">
        <div className="el-store-footer__legal-left">
          <span className="el-store-footer__vat">{copy.vat}</span>
          <span className="el-country-pill"><span /> {copy.country}</span>
          <div className="el-store-footer__legal-links">
            {copy.legal.map((item) => <a href="#" key={item}>{item}</a>)}
          </div>
        </div>
        <div className="el-store-footer__social-text">
          <a href="#">X</a>
          <a href="#">Instagram</a>
          <a href="#">Facebook</a>
          <a href="#">YouTube</a>
        </div>
      </div>
    </footer>
  );
}
