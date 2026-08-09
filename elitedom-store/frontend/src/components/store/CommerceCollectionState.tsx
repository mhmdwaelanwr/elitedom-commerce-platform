import { StoreIcon } from "@/components/store/StoreIcon";
import type { StoreLocale } from "@/components/store/StoreHeader";

type CollectionState = "empty" | "loading" | "error";

export function CommerceCollectionState({ locale, state, onAction }: { locale: StoreLocale; state: CollectionState; onAction?: () => void }) {
  const ar = locale === "ar";
  const copy = {
    empty: ar
      ? { title: "مفيش هاردوير مطابق لسه", body: "جرّب تشيل فلتر أو تستخدم بحث أوسع.", action: "امسح الفلاتر" }
      : { title: "No hardware matches yet", body: "Try removing a filter or search a broader term.", action: "Clear filters" },
    loading: ar
      ? { title: "بنحمّل الهاردوير", body: "بنحافظ على شكل الصفحة ثابت أثناء تحميل النتائج.", action: "" }
      : { title: "Loading hardware", body: "Keep the layout stable while product results are requested.", action: "" },
    error: ar
      ? { title: "مقدرناش نحمل النتائج", body: "البحث والفلاتر محفوظين. جرّب تاني.", action: "حاول تاني" }
      : { title: "We could not load results", body: "Your filters and search are preserved. Try again.", action: "Retry" },
  }[state];

  return (
    <section aria-busy={state === "loading"} className={`el-collection-surface is-${state}`}>
      {state === "loading" ? (
        <div className="el-collection-surface__skeleton" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <span key={index}><i /><b /><em /></span>)}
        </div>
      ) : (
        <span className="el-collection-surface__icon"><StoreIcon name={state === "error" ? "returns" : "search"} size={24} /></span>
      )}
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      {state !== "loading" && onAction ? <button className={state === "error" ? "el-surface-primary" : "el-surface-secondary"} onClick={onAction} type="button">{copy.action}</button> : null}
    </section>
  );
}
