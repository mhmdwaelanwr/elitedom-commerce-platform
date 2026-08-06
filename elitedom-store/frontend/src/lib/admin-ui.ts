export function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatAdminDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-EG", {
    dateStyle: "medium",
    ...(options ?? {}),
  }).format(parsed);
}

export function formatAdminDateTime(value: string | null | undefined) {
  return formatAdminDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatEgp(value: string | number | null | undefined, compact = false) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function statusTone(value: string | null | undefined) {
  switch (value) {
    case "paid":
    case "sale":
    case "done":
    case "approved":
    case "completed":
    case "accepted":
    case "healthy":
      return "emerald";
    case "pending":
    case "pending_review":
    case "sent":
    case "submitted":
    case "under_review":
    case "quoted":
    case "assigned":
    case "waiting":
    case "low_stock":
      return "amber";
    case "failed":
    case "cancel":
    case "rejected":
    case "out_of_stock":
    case "inactive":
      return "rose";
    default:
      return "slate";
  }
}
