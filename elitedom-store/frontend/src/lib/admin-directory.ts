import type { AdminPermission } from "@/lib/admin-api";
import type { StoreIconName } from "@/components/store/StoreIcon";

export type AdminDirectoryItem = {
  id: string;
  label: string;
  labelAr: string;
  href: string;
  icon: StoreIconName;
  permission: AdminPermission;
};

export const ADMIN_DIRECTORY: AdminDirectoryItem[] = [
  { id: "dashboard", label: "Dashboard", labelAr: "لوحة المتابعة", href: "/admin", icon: "home", permission: "dashboard.view" },
  { id: "orders", label: "Orders", labelAr: "الطلبات", href: "/admin?section=orders", icon: "clipboard", permission: "orders.view" },
  { id: "products", label: "Products", labelAr: "المنتجات", href: "/admin?section=products", icon: "package", permission: "catalog.view" },
  { id: "catalog", label: "Catalog Editor", labelAr: "محرر الكتالوج", href: "/admin/catalog", icon: "edit", permission: "catalog.view" },
  { id: "payments", label: "Payments", labelAr: "المدفوعات", href: "/admin/payments", icon: "payment", permission: "payments.view" },
  { id: "customers", label: "Customers", labelAr: "العملاء", href: "/admin?section=customers", icon: "users", permission: "customers.view" },
  { id: "inventory", label: "Inventory", labelAr: "المخزون", href: "/admin/inventory", icon: "warehouse", permission: "inventory.view" },
  { id: "shipments", label: "Shipments", labelAr: "الشحنات", href: "/admin?section=shipments", icon: "delivery", permission: "shipments.view" },
  { id: "dropshipping", label: "Dropshipping", labelAr: "التوريد المباشر", href: "/admin/dropshipping", icon: "delivery", permission: "suppliers.view" },
  { id: "rfq", label: "B2B / RFQ", labelAr: "الشركات / عروض الأسعار", href: "/admin?section=rfqs", icon: "briefcase", permission: "rfq.view" },
  { id: "rma", label: "RMA / Returns", labelAr: "المرتجعات / RMA", href: "/admin?section=rma", icon: "returns", permission: "support.view" },
  { id: "suppliers", label: "Suppliers", labelAr: "الموردون", href: "/admin/suppliers", icon: "building", permission: "suppliers.view" },
  { id: "reports", label: "Reports", labelAr: "التقارير", href: "/admin/reports", icon: "file", permission: "reports.view" },
  { id: "staff", label: "Staff & Roles", labelAr: "الموظفون والصلاحيات", href: "/admin?section=staff", icon: "shield", permission: "staff.view" },
  { id: "content", label: "Content", labelAr: "المحتوى", href: "/admin/catalog", icon: "file", permission: "catalog.manage" },
  { id: "integrations", label: "Integrations", labelAr: "التكاملات", href: "/admin/integrations", icon: "plug", permission: "integrations.view" },
  { id: "audit", label: "Audit Log", labelAr: "سجل التدقيق", href: "/admin?section=audit", icon: "history", permission: "audit.view" },
  { id: "launch", label: "Launch Control", labelAr: "تحكم الإطلاق", href: "/admin/launch", icon: "rocket", permission: "config.manage" },
];
