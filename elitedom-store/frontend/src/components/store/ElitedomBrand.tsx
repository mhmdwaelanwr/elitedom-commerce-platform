import brandMark from "@/assets/brand/elitedom-mark-on-dark.svg";

type ElitedomBrandProps = {
  compact?: boolean;
  className?: string;
};

export function ElitedomBrand({ compact = false, className }: ElitedomBrandProps) {
  return (
    <span className={["el-brand", compact ? "el-brand--compact" : "", className ?? ""].filter(Boolean).join(" ")}>
      <img aria-hidden="true" alt="" className="el-brand__mark" src={brandMark} />
      {!compact ? <span className="el-brand__wordmark">Elitedom</span> : null}
    </span>
  );
}
