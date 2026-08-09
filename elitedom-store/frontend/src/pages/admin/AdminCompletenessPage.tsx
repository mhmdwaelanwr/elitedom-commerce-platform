import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ElitedomBrand } from "@/components/store/ElitedomBrand";
import { StoreIcon } from "@/components/store/StoreIcon";
import { ThemeToggle } from "@/components/store/ThemeToggle";
import { useStoreLocale } from "@/hooks/useStoreLocale";
import { ADMIN_DIRECTORY } from "@/lib/admin-directory";
import { fetchAdminAccess, type AdminAccess } from "@/lib/admin-api";
import { restoreSession } from "@/lib/auth-session";
import {
  createCatalogProduct,
  getCatalogProduct,
  listCatalogProducts,
  resolveCatalogImage,
  updateCatalogProduct,
  type CatalogProduct,
  type CatalogProductListItem,
} from "@/lib/catalog-admin-api";
import { fetchRichCatalog } from "@/lib/catalog-api";
import {
  fetchInventoryReport,
  fetchReportingDashboard,
  fetchRmaReport,
  fetchSupplierReport,
  type InventoryReport,
  type ReportingDashboard,
  type RmaReport,
  type SupplierReport,
} from "@/lib/platform-api";
import {
  adjustInventoryStock,
  createCatalogAdminCategory,
  createCatalogAttributeDefinition,
  createPurchaseOrder,
  createSupplier,
  deleteCatalogMedia,
  downloadSalesExport,
  fetchCatalogContent,
  fetchStockLevel,
  fetchSupplierPerformance,
  listCatalogAdminCategories,
  listCatalogAttributeDefinitions,
  listProductSupplierLinks,
  listPurchaseOrders,
  listSuppliers,
  lookupInventorySerial,
  scanInventoryBarcode,
  updateCatalogAdminCategory,
  updateCatalogAttributeDefinition,
  updateCatalogContent,
  updateDropshipShipment,
  updatePurchaseOrder,
  updateSupplier,
  uploadCatalogMedia,
  upsertProductSupplierLink,
  type BarcodeScan,
  type CatalogAttributeDefinition,
  type CatalogCategoryAdmin,
  type CatalogContent,
  type ProductSupplierLink,
  type PurchaseOrder,
  type SerialLookup,
  type StockAdjustment,
  type StockLevel,
  type Supplier,
  type SupplierPerformance,
} from "@/lib/operations-api";
import type { CustomerSession, Product } from "@/types/store";
import "@/styles/p20-completeness.css";

export type AdminCompletenessKind = "inventory" | "suppliers" | "dropshipping" | "catalog" | "reports";
type Props = { kind: AdminCompletenessKind };
type LoadState = "loading" | "ready" | "error";
type WorkspaceProps = { session: CustomerSession; access: AdminAccess; locale: "en" | "ar"; ar: boolean };

const frameIds: Record<AdminCompletenessKind, string> = {
  inventory: "247:70",
  dropshipping: "247:135",
  catalog: "247:200",
  suppliers: "247:265",
  reports: "247:329",
};

const titles = {
  inventory: ["Inventory tools", "أدوات المخزون", "Barcode scan, serial lookup, live SKU stock and audited adjustments."],
  suppliers: ["Supplier management", "إدارة الموردين", "Supplier records, procurement, purchase-order workflow and measured performance."],
  dropshipping: ["Dropshipping control", "إدارة التوريد المباشر", "Product-supplier routing and persisted supplier shipment updates."],
  catalog: ["Catalog editing workspace", "مساحة تحرير الكتالوج", "Core product data, localized content, categories, attributes and controlled media."],
  reports: ["Reporting & exports", "التقارير والتصدير", "Live persisted analytics and authenticated sales exports."],
} as const;

export function AdminCompletenessPage({ kind }: Props) {
  const [locale, setLocale] = useStoreLocale();
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void restoreSession().then(async (current) => {
      if (!active || !current) return;
      try {
        const resolved = await fetchAdminAccess(current);
        if (!active) return;
        setSession(current);
        setAccess(resolved);
        setState("ready");
      } catch (reason) {
        if (!active) return;
        setError(message(reason));
        setState("error");
      }
    });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => ADMIN_DIRECTORY.filter((item) => access?.permissions.includes(item.permission)), [access]);
  const pageTitle = ar ? titles[kind][1] : titles[kind][0];

  return (
    <div className="el-p20-admin" dir={ar ? "rtl" : "ltr"} lang={locale} data-figma-node={frameIds[kind]}>
      <aside className="el-p20-admin__sidebar">
        <div className="el-p20-admin__brand"><ElitedomBrand compact /><span><b>ELITEDOM OPS</b><small>ADMIN / RBAC / MFA</small></span></div>
        <nav aria-label={ar ? "واجهات الإدارة" : "Admin surfaces"}>{visible.map((item) => <Link className={item.id === kind ? "is-active" : ""} key={item.id} to={item.href}><StoreIcon name={item.icon} size={18} /><span>{ar ? item.labelAr : item.label}</span></Link>)}</nav>
      </aside>
      <main className="el-p20-admin__main">
        <header className="el-p20-admin__topbar"><div><p className="el-p20-eyebrow">P20 / BACKEND-SOURCED</p><h1>{pageTitle}</h1><p>{titles[kind][2]}</p></div><div><span className="el-p20-status is-success"><StoreIcon name="shield" size={14} />MFA VERIFIED</span><ThemeToggle locale={locale} /><button className="el-p20-control" onClick={() => setLocale(ar ? "en" : "ar")} type="button">{ar ? "EN" : "AR"}</button></div></header>
        {state === "loading" ? <State text={ar ? "بنحمّل الواجهة…" : "Loading surface…"} /> : null}
        {state === "error" ? <State error text={error} /> : null}
        {state === "ready" && session && access ? <Surface access={access} ar={ar} kind={kind} locale={locale} session={session} /> : null}
        <p className="el-p20-evidence">FIGMA {frameIds[kind]} · REAL API · RBAC · MFA · RTL/LTR · LIGHT/DARK</p>
      </main>
    </div>
  );
}

function Surface({ kind, session, access, locale, ar }: WorkspaceProps & { kind: AdminCompletenessKind }) {
  if (kind === "inventory") return <InventoryWorkspace access={access} ar={ar} locale={locale} session={session} />;
  if (kind === "suppliers") return <SupplierWorkspace access={access} ar={ar} locale={locale} session={session} />;
  if (kind === "dropshipping") return <DropshipWorkspace access={access} ar={ar} locale={locale} session={session} />;
  if (kind === "catalog") return <CatalogWorkspace access={access} ar={ar} locale={locale} session={session} />;
  return <ReportsWorkspace ar={ar} locale={locale} session={session} />;
}

function InventoryWorkspace({ session, access, locale, ar }: WorkspaceProps) {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [stock, setStock] = useState<StockLevel | null>(null);
  const [scan, setScan] = useState<BarcodeScan | null>(null);
  const [serial, setSerial] = useState<SerialLookup | null>(null);
  const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchInventoryReport(session).then(
      (result) => { if (active) setReport(result); },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [session]);

  async function refresh() { setReport(await fetchInventoryReport(session)); }
  async function lookup(event: FormEvent<HTMLFormElement>, kind: "stock" | "scan" | "serial") {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("value") || "").trim();
    if (!value) return;
    setBusy(true); setError("");
    try {
      if (kind === "stock") setStock(await fetchStockLevel(value, session));
      if (kind === "scan") setScan(await scanInventoryBarcode(value, session));
      if (kind === "serial") setSerial(await lookupInventorySerial(value, session));
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      setAdjustment(await adjustInventoryStock({ sku: String(form.get("sku") || "").trim(), quantity_delta: Number(form.get("delta")), reason: String(form.get("reason") || "").trim() }, session));
      await refresh(); event.currentTarget.reset();
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  return <>
    <Kpis items={[[ar ? "عدد SKU" : "SKU COUNT", n(report?.total_sku_count ?? 0, locale), "persisted"], [ar ? "الوحدات" : "UNITS ON HAND", n(report?.total_units_on_hand ?? 0, locale), "total"], [ar ? "مخزون منخفض" : "LOW STOCK", n(report?.low_stock_products.length ?? 0, locale), "exceptions"], [ar ? "التعديل" : "ADJUST", access.permissions.includes("inventory.adjust") ? "AUDITED" : "VIEW ONLY", "RBAC"]]} />
    {error ? <ErrorBox text={error} /> : null}
    <section className="el-p20-admin-grid el-p20-admin-grid--wide">
      <Panel title={ar ? "بحث وفحص المخزون" : "Inventory lookup & scan"}>
        <div className="el-p20-tool-grid"><LookupForm ar={ar} busy={busy} label="SKU" onSubmit={(event) => void lookup(event, "stock")} placeholder="RTX-5070-TI" /><LookupForm ar={ar} busy={busy} label={ar ? "باركود / SKU" : "Barcode / SKU"} onSubmit={(event) => void lookup(event, "scan")} placeholder="RTX-5070-TI" /><LookupForm ar={ar} busy={busy} label={ar ? "رقم سيريال" : "Serial number"} onSubmit={(event) => void lookup(event, "serial")} placeholder="SN-…" /></div>
        <div className="el-p20-result-grid">{stock ? <Result title={stock.sku} rows={[[ar ? "المخزون" : "Stock", n(stock.stock_qty, locale)], [ar ? "التتبع" : "Tracking", stock.tracking], [ar ? "متاح" : "Available", stock.is_available ? "Yes" : "No"], ["Dropship", stock.is_dropship ? "Yes" : "No"]]} /> : null}{scan ? <Result title={scan.name} rows={[["SKU", scan.sku], [ar ? "المخزون" : "Stock", n(scan.stock_qty, locale)], [ar ? "السعر" : "Price", `${money(scan.list_price, locale)} EGP`]]} /> : null}{serial ? <Result title={serial.product_name} rows={[["SKU", serial.sku], [ar ? "السيريال" : "Serial", serial.serial_number], [ar ? "الضمان" : "Warranty", serial.is_warranty_active ? "Active" : "Inactive"], [ar ? "ينتهي" : "Expires", serial.warranty_expiration_date || "—"]]} /> : null}</div>
      </Panel>
      <Panel title={ar ? "تعديل مخزون مسجل" : "Audited stock adjustment"}>{access.permissions.includes("inventory.adjust") ? <form className="el-p20-form" onSubmit={adjust}><Field label="SKU"><input name="sku" required /></Field><Field label={ar ? "فرق الكمية" : "Quantity delta"}><input name="delta" required type="number" /></Field><Field label={ar ? "السبب" : "Reason"}><textarea minLength={3} name="reason" required /></Field><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "تسجيل التعديل" : "Record adjustment"}</button></form> : <Muted text={ar ? "الحساب الحالي للعرض فقط." : "This role has view-only inventory access."} />}{adjustment ? <Result title={ar ? "آخر تعديل" : "Latest adjustment"} rows={[["SKU", adjustment.sku], [ar ? "قبل" : "Before", n(adjustment.previous_stock_qty, locale)], [ar ? "الفرق" : "Delta", n(adjustment.quantity_delta, locale)], [ar ? "بعد" : "After", n(adjustment.stock_qty, locale)]]} /> : null}</Panel>
    </section>
    <Panel title={ar ? "تنبيهات المخزون المنخفض" : "Low-stock exceptions"}><Table headers={["SKU", ar ? "المنتج" : "Product", ar ? "المخزون" : "Stock", "Dropship"]}>{(report?.low_stock_products ?? []).map((item) => <tr key={item.product_id}><td><code>{item.sku}</code></td><td>{item.name}</td><td>{n(item.stock_qty, locale)}</td><td>{item.is_dropship_enabled ? "Yes" : "—"}</td></tr>)}</Table></Panel>
  </>;
}

function SupplierWorkspace({ session, access, locale, ar }: WorkspaceProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = access.permissions.includes("suppliers.manage");

  useEffect(() => {
    let active = true;
    void Promise.all([listSuppliers(session), listPurchaseOrders(session)]).then(
      ([supplierList, poList]) => { if (active) { setSuppliers(supplierList.suppliers); setOrders(poList.purchase_orders); } },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [session]);

  async function refresh() { const [supplierList, poList] = await Promise.all([listSuppliers(session), listPurchaseOrders(session)]); setSuppliers(supplierList.suppliers); setOrders(poList.purchase_orders); }
  async function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { await createSupplier({ name: String(form.get("name") || ""), email: String(form.get("email") || ""), contact_name: String(form.get("contact") || "") || null, phone: String(form.get("phone") || "") || null, lead_time_days: Number(form.get("lead") || 7), is_verified: form.get("verified") === "on" }, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }
  async function addPo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { await createPurchaseOrder({ supplier_id: Number(form.get("supplier")), items: [{ product_id: Number(form.get("product")), quantity: Number(form.get("quantity")), unit_cost: form.get("unit_cost") ? Number(form.get("unit_cost")) : null }], currency: String(form.get("currency") || "USD"), expected_delivery_date: String(form.get("expected") || "") || null }, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }
  async function toggleSupplier(item: Supplier) { setBusy(true); setError(""); try { await updateSupplier(item.id, { is_verified: !item.is_verified }, session); await refresh(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function changePo(item: PurchaseOrder, status: PurchaseOrder["status"]) { setBusy(true); setError(""); try { await updatePurchaseOrder(item.po_number, { status, actual_delivery_date: status === "received" ? new Date().toISOString().slice(0, 10) : null }, session); await refresh(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }

  return <>
    <Kpis items={[[ar ? "الموردون" : "SUPPLIERS", n(suppliers.length, locale), `${n(suppliers.filter((item) => item.is_verified).length, locale)} verified`], [ar ? "أوامر شراء" : "PURCHASE ORDERS", n(orders.length, locale), `${n(orders.filter((item) => !["received", "cancelled"].includes(item.status)).length, locale)} open`], [ar ? "الإدارة" : "MANAGE", canManage ? "ENABLED" : "VIEW ONLY", "RBAC"], [ar ? "الأداء" : "PERFORMANCE", performance ? `${Number(performance.on_time_delivery_rate_percent ?? 0).toFixed(1)}%` : "SELECT", "measured"]]} />
    {error ? <ErrorBox text={error} /> : null}
    <section className="el-p20-admin-grid"><Panel title={ar ? "دليل الموردين" : "Supplier directory"}><Table headers={[ar ? "المورد" : "Supplier", ar ? "الحالة" : "State", ar ? "مدة التوريد" : "Lead", ar ? "إجراء" : "Action"]}>{suppliers.map((item) => <tr key={item.id}><td><button className="el-p20-text-button" onClick={() => void fetchSupplierPerformance(item.id, session).then(setPerformance).catch((reason) => setError(message(reason)))} type="button">{item.name}</button><small>{item.email}</small></td><td><Status value={item.is_verified ? "verified" : "unverified"} /></td><td>{n(item.lead_time_days, locale)} {ar ? "يوم" : "days"}</td><td>{canManage ? <button disabled={busy} onClick={() => void toggleSupplier(item)} type="button">{item.is_verified ? (ar ? "إلغاء التوثيق" : "Unverify") : (ar ? "توثيق" : "Verify")}</button> : "—"}</td></tr>)}</Table></Panel><Panel title={ar ? "أداء المورد" : "Supplier performance"}>{performance ? <Result title={performance.supplier.name} rows={[[ar ? "أوامر شراء" : "Purchase orders", n(performance.total_purchase_orders, locale)], [ar ? "مستلم" : "Received", n(performance.received_purchase_orders, locale)], [ar ? "في الموعد" : "On time", n(performance.on_time_deliveries, locale)], [ar ? "معدل العيوب" : "Defect rate", `${Number(performance.defect_rate_percent).toFixed(2)}%`]]} /> : <Muted text={ar ? "اختر موردًا لعرض الأداء الفعلي." : "Select a supplier to load measured performance."} />}</Panel></section>
    <Panel title={ar ? "أوامر الشراء" : "Purchase orders"}><Table headers={["PO", ar ? "المورد" : "Supplier", ar ? "الحالة" : "Status", ar ? "القيمة" : "Value", ar ? "إجراء" : "Action"]}>{orders.map((item) => <tr key={item.id}><td><code>{item.po_number}</code></td><td>#{item.supplier_id}</td><td><Status value={item.status} /></td><td>{money(item.total_amount, locale)} {item.currency}</td><td>{canManage && !["received", "cancelled"].includes(item.status) ? <select aria-label={ar ? "تغيير حالة أمر الشراء" : "Change purchase order status"} disabled={busy} onChange={(event) => { const value = event.target.value as PurchaseOrder["status"]; if (value) void changePo(item, value); }} value=""><option value="">{ar ? "تغيير…" : "Change…"}</option><option value="sent">Sent</option><option value="partial">Partial</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select> : "—"}</td></tr>)}</Table></Panel>
    {canManage ? <section className="el-p20-admin-grid"><Panel title={ar ? "إضافة مورد" : "Create supplier"}><form className="el-p20-form" onSubmit={addSupplier}><Field label={ar ? "الاسم" : "Name"}><input minLength={2} name="name" required /></Field><Field label="Email"><input name="email" required type="email" /></Field><Field label={ar ? "جهة الاتصال" : "Contact"}><input name="contact" /></Field><Field label={ar ? "الهاتف" : "Phone"}><input name="phone" /></Field><Field label={ar ? "مدة التوريد بالأيام" : "Lead time days"}><input defaultValue={7} min={0} name="lead" type="number" /></Field><Check name="verified" label={ar ? "موثق" : "Verified"} /><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ المورد" : "Create supplier"}</button></form></Panel><Panel title={ar ? "أمر شراء جديد" : "New purchase order"}><form className="el-p20-form" onSubmit={addPo}><Field label={ar ? "المورد" : "Supplier"}><select name="supplier" required><option value="">—</option>{suppliers.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Product ID"><input min={1} name="product" required type="number" /></Field><Field label={ar ? "الكمية" : "Quantity"}><input min={1} name="quantity" required type="number" /></Field><Field label={ar ? "تكلفة الوحدة" : "Unit cost"}><input min={0} name="unit_cost" step="0.01" type="number" /></Field><Field label={ar ? "تاريخ متوقع" : "Expected date"}><input name="expected" type="date" /></Field><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "إنشاء أمر الشراء" : "Create PO"}</button></form></Panel></section> : null}
  </>;
}

function DropshipWorkspace({ session, access, locale, ar }: WorkspaceProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [links, setLinks] = useState<Record<number, ProductSupplierLink[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = access.permissions.includes("suppliers.manage");

  useEffect(() => {
    let active = true;
    void Promise.all([fetchRichCatalog({ locale, limit: 100 }), listSuppliers(session), listPurchaseOrders(session)]).then(
      async ([catalog, supplierList, poList]) => {
        const dropship = catalog.filter((item) => item.dropshipEnabled);
        const resolved = await Promise.allSettled(dropship.slice(0, 30).map(async (item) => [Number(item.id), (await listProductSupplierLinks(Number(item.id), session)).product_suppliers] as const));
        if (!active) return;
        setProducts(dropship); setSuppliers(supplierList.suppliers); setOrders(poList.purchase_orders);
        setLinks(Object.fromEntries(resolved.flatMap((item) => item.status === "fulfilled" ? [item.value] : [])));
      },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [locale, session]);

  async function refresh() {
    const [catalog, supplierList, poList] = await Promise.all([fetchRichCatalog({ locale, limit: 100 }), listSuppliers(session), listPurchaseOrders(session)]);
    const dropship = catalog.filter((item) => item.dropshipEnabled);
    const resolved = await Promise.allSettled(dropship.slice(0, 30).map(async (item) => [Number(item.id), (await listProductSupplierLinks(Number(item.id), session)).product_suppliers] as const));
    setProducts(dropship); setSuppliers(supplierList.suppliers); setOrders(poList.purchase_orders); setLinks(Object.fromEntries(resolved.flatMap((item) => item.status === "fulfilled" ? [item.value] : [])));
  }
  async function linkProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { await upsertProductSupplierLink(Number(form.get("supplier")), Number(form.get("product")), { supplier_sku: String(form.get("supplier_sku") || ""), unit_cost_usd: Number(form.get("cost")), lead_time_days: form.get("lead") ? Number(form.get("lead")) : null, is_primary: form.get("primary") === "on", is_active: true }, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }
  async function shipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const po = orders.find((item) => item.po_number === form.get("po"));
    if (!po?.sale_order_id) { setError(ar ? "أمر الشراء المختار غير مربوط بطلب عميل." : "Selected PO is not linked to a customer order."); setBusy(false); return; }
    try { await updateDropshipShipment(po.sale_order_id, { purchase_order_number: po.po_number, status: String(form.get("status")) as "shipped" | "delivered" | "exception", tracking_number: String(form.get("tracking") || "") || null, carrier: String(form.get("carrier") || "") || null }, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  const activePos = orders.filter((item) => item.sale_order_id && !["received", "cancelled"].includes(item.status));
  return <>
    <Kpis items={[[ar ? "منتجات Dropship" : "DROPSHIP PRODUCTS", n(products.length, locale), "catalogue"], [ar ? "روابط موردين" : "SUPPLIER LINKS", n(Object.values(links).flat().length, locale), "persisted"], [ar ? "PO مرتبطة" : "LINKED POs", n(activePos.length, locale), "customer orders"], [ar ? "الإدارة" : "MANAGE", canManage ? "ENABLED" : "VIEW ONLY", "RBAC"]]} />
    {error ? <ErrorBox text={error} /> : null}
    <Panel title={ar ? "توجيه المنتج للمورد" : "Product-supplier routing"}><Table headers={["SKU", ar ? "المنتج" : "Product", ar ? "الموردون" : "Suppliers", ar ? "الأساسي" : "Primary"]}>{products.map((product) => { const rows = links[Number(product.id)] ?? []; const primary = rows.find((row) => row.is_primary); return <tr key={product.id}><td><code>{product.sku}</code></td><td>{product.name}</td><td>{rows.length ? rows.map((row) => suppliers.find((supplier) => supplier.id === row.supplier_id)?.name || `#${row.supplier_id}`).join(", ") : "—"}</td><td>{primary ? suppliers.find((supplier) => supplier.id === primary.supplier_id)?.name || `#${primary.supplier_id}` : "—"}</td></tr>; })}</Table></Panel>
    {canManage ? <section className="el-p20-admin-grid"><Panel title={ar ? "ربط مورد بمنتج" : "Link supplier to product"}><form className="el-p20-form" onSubmit={linkProduct}><Field label={ar ? "المنتج" : "Product"}><select name="product" required><option value="">—</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></Field><Field label={ar ? "المورد" : "Supplier"}><select name="supplier" required><option value="">—</option>{suppliers.filter((supplier) => supplier.is_active && supplier.is_verified).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Supplier SKU"><input name="supplier_sku" required /></Field><Field label={ar ? "التكلفة USD" : "Unit cost USD"}><input min={0} name="cost" required step="0.01" type="number" /></Field><Field label={ar ? "مدة التوريد" : "Lead days"}><input min={0} name="lead" type="number" /></Field><Check name="primary" label={ar ? "مورد أساسي" : "Primary supplier"} /><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ الرابط" : "Save link"}</button></form></Panel><Panel title={ar ? "تحديث شحنة المورد" : "Supplier shipment update"}><form className="el-p20-form" onSubmit={shipment}><Field label="Purchase order"><select name="po" required><option value="">—</option>{activePos.map((po) => <option key={po.id} value={po.po_number}>{po.po_number} · Order #{po.sale_order_id}</option>)}</select></Field><Field label={ar ? "الحالة" : "Status"}><select defaultValue="shipped" name="status"><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="exception">Exception</option></select></Field><Field label={ar ? "التتبع" : "Tracking"}><input name="tracking" /></Field><Field label={ar ? "الناقل" : "Carrier"}><input name="carrier" /></Field><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "تسجيل تحديث الشحنة" : "Record shipment update"}</button></form></Panel></section> : null}
  </>;
}

function CatalogWorkspace({ session, access, locale, ar }: WorkspaceProps) {
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [content, setContent] = useState<CatalogContent | null>(null);
  const [categories, setCategories] = useState<CatalogCategoryAdmin[]>([]);
  const [attributes, setAttributes] = useState<CatalogAttributeDefinition[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = access.permissions.includes("catalog.manage");

  useEffect(() => {
    let active = true;
    void Promise.all([listCatalogProducts(session, { page: 1 }), listCatalogAdminCategories(session), listCatalogAttributeDefinitions(session)]).then(
      ([productList, categoryList, attributeList]) => { if (active) { setProducts(productList.products); setCategories(categoryList); setAttributes(attributeList); } },
      (reason) => { if (active) setError(message(reason)); },
    );
    return () => { active = false; };
  }, [session]);

  async function refresh() { const [productList, categoryList, attributeList] = await Promise.all([listCatalogProducts(session, { page: 1 }), listCatalogAdminCategories(session), listCatalogAttributeDefinitions(session)]); setProducts(productList.products); setCategories(categoryList); setAttributes(attributeList); }
  async function choose(productId: number) { setBusy(true); setError(""); try { const [product, localized] = await Promise.all([getCatalogProduct(productId, session), fetchCatalogContent(productId, session)]); setSelected(product); setContent(localized); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function saveCore(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { const updated = await updateCatalogProduct(selected.id, { name: String(form.get("core_name") || selected.name), list_price: Number(form.get("price")), brand: String(form.get("brand") || "") || null, category_id: form.get("category") ? Number(form.get("category")) : null, is_active: form.get("active") === "on", is_dropship_enabled: form.get("dropship") === "on" }, session); setSelected(updated); setNotice(ar ? "تم حفظ بيانات المنتج." : "Product data saved."); await refresh(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function saveContent(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { setContent(await updateCatalogContent(selected.id, { slug: String(form.get("slug") || ""), name: String(form.get("name") || ""), name_ar: String(form.get("name_ar") || "") || null, short_description: String(form.get("short") || "") || null, short_description_ar: String(form.get("short_ar") || "") || null, description: String(form.get("description") || "") || null, description_ar: String(form.get("description_ar") || "") || null, publication_status: String(form.get("status")) as CatalogContent["publication_status"], is_featured: form.get("featured") === "on" }, session)); setNotice(ar ? "تم حفظ المحتوى." : "Content saved."); await refresh(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function createProduct(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { const product = await createCatalogProduct({ name: String(form.get("new_name") || ""), sku: String(form.get("new_sku") || "") || undefined, list_price: Number(form.get("new_price") || 0), is_active: false }, session); await refresh(); await choose(product.id); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget); const file = form.get("image"); if (!(file instanceof File) || !file.size) return; setBusy(true); setError(""); try { await uploadCatalogMedia(selected.id, file, { alt_text: String(form.get("alt") || "") || undefined, is_primary: form.get("primary") === "on" }, session); setSelected(await getCatalogProduct(selected.id, session)); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function removeImage(imageId: number) { if (!selected || !window.confirm(ar ? "حذف الصورة؟" : "Delete this image?")) return; setBusy(true); setError(""); try { await deleteCatalogMedia(selected.id, imageId, session); setSelected(await getCatalogProduct(selected.id, session)); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function categoryAction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const id = Number(form.get("category_id") || 0); const existing = categories.find((item) => item.id === id); const input = { name: String(form.get("category_name") || existing?.name || ""), name_ar: String(form.get("category_name_ar") || existing?.name_ar || "") || null, slug: String(form.get("category_slug") || existing?.slug || ""), parent_id: existing?.parent_id ?? null, description: existing?.description ?? null, description_ar: existing?.description_ar ?? null, is_featured: existing?.is_featured ?? false, sort_order: existing?.sort_order ?? 0, is_active: true }; try { if (existing) await updateCatalogAdminCategory(existing.id, input, session); else await createCatalogAdminCategory(input, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }
  async function attributeAction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const id = Number(form.get("attribute_id") || 0); const existing = attributes.find((item) => item.id === id); const input = { code: String(form.get("attribute_code") || existing?.code || ""), name: String(form.get("attribute_name") || existing?.name || ""), name_ar: String(form.get("attribute_name_ar") || existing?.name_ar || "") || null, data_type: existing?.data_type ?? "text", unit: existing?.unit ?? null, unit_ar: existing?.unit_ar ?? null, is_filterable: true, is_active: true, sort_order: existing?.sort_order ?? 0 }; try { if (existing) await updateCatalogAttributeDefinition(existing.id, input, session); else await createCatalogAttributeDefinition(input, session); await refresh(); event.currentTarget.reset(); } catch (reason) { setError(message(reason)); } finally { setBusy(false); } }

  return <>
    <Kpis items={[[ar ? "المنتجات" : "PRODUCTS", n(products.length, locale), "current page"], [ar ? "الأقسام" : "CATEGORIES", n(categories.length, locale), "definitions"], [ar ? "الخصائص" : "ATTRIBUTES", n(attributes.length, locale), "technical"], [ar ? "التحرير" : "EDIT", canManage ? "ENABLED" : "VIEW ONLY", "RBAC"]]} />
    {error ? <ErrorBox text={error} /> : null}{notice ? <p className="el-p20-notice" role="status">{notice}</p> : null}
    <section className="el-p20-admin-grid el-p20-admin-grid--catalog"><Panel title={ar ? "المنتجات" : "Products"}><div className="el-p20-product-picker">{products.map((item) => <button className={selected?.id === item.id ? "is-active" : ""} key={item.id} onClick={() => void choose(item.id)} type="button"><span><b>{item.name}</b><small>{item.sku} · {money(item.list_price, locale)} EGP</small></span><Status value={item.is_active ? "active" : "inactive"} /></button>)}</div>{canManage ? <form className="el-p20-inline-form el-p20-new-product" onSubmit={createProduct}><input name="new_name" placeholder={ar ? "اسم منتج جديد" : "New product name"} required /><input name="new_sku" placeholder="SKU" /><input min={0} name="new_price" placeholder="EGP" step="0.01" type="number" /><button className="el-p20-primary" disabled={busy} type="submit">+</button></form> : null}</Panel><Panel title={ar ? "تحرير المنتج" : "Product editor"}>{selected && content ? <div className="el-p20-editor-stack"><form className="el-p20-form" onSubmit={saveCore}><h3>{ar ? "بيانات التجارة" : "Commerce data"}</h3><Field label={ar ? "الاسم" : "Name"}><input defaultValue={selected.name} name="core_name" required /></Field><Field label={ar ? "السعر EGP" : "Price EGP"}><input defaultValue={String(selected.list_price)} min={0} name="price" step="0.01" type="number" /></Field><Field label={ar ? "العلامة" : "Brand"}><input defaultValue={selected.brand ?? ""} name="brand" /></Field><Field label={ar ? "القسم" : "Category"}><select defaultValue={selected.category_id ?? ""} name="category"><option value="">—</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="el-p20-check-row"><Check checked={selected.is_active} name="active" label={ar ? "نشط" : "Active"} /><Check checked={selected.is_dropship_enabled} name="dropship" label="Dropship" /></div>{canManage ? <button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ بيانات المنتج" : "Save product data"}</button> : null}</form><form className="el-p20-form" onSubmit={saveContent}><h3>{ar ? "المحتوى المحلي" : "Localized content"}</h3><Field label="Slug"><input defaultValue={content.slug} name="slug" required /></Field><Field label="Name EN"><input defaultValue={content.name} name="name" required /></Field><Field label="Name AR"><input defaultValue={content.name_ar ?? ""} dir="rtl" name="name_ar" /></Field><Field label="Description EN"><textarea defaultValue={content.description ?? ""} name="description" rows={5} /></Field><Field label="Description AR"><textarea defaultValue={content.description_ar ?? ""} dir="rtl" name="description_ar" rows={5} /></Field><Field label={ar ? "النشر" : "Publication"}><select defaultValue={content.publication_status} name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></Field><Check checked={content.is_featured} name="featured" label={ar ? "مميز" : "Featured"} />{canManage ? <button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ المحتوى" : "Save content"}</button> : null}</form><div><h3>{ar ? "الصور" : "Media"}</h3><div className="el-p20-media-grid">{selected.images.map((image) => <figure key={image.id}><img alt={image.alt_text || selected.name} src={resolveCatalogImage(image.url)} /><figcaption>{image.is_primary ? "PRIMARY" : `#${image.sort_order}`}{canManage ? <button disabled={busy} onClick={() => void removeImage(image.id)} type="button">×</button> : null}</figcaption></figure>)}</div>{canManage ? <form className="el-p20-form" onSubmit={upload}><Field label={ar ? "ملف الصورة" : "Image file"}><input accept="image/*" name="image" required type="file" /></Field><Field label="Alt text"><input name="alt" /></Field><Check name="primary" label={ar ? "صورة أساسية" : "Primary"} /><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "رفع الصورة" : "Upload media"}</button></form> : null}</div></div> : <Muted text={busy ? "…" : ar ? "اختر منتجًا لفتح مساحة التحرير." : "Select a product to open the editor."} />}</Panel></section>
    {canManage ? <section className="el-p20-admin-grid"><Panel title={ar ? "إضافة / تعديل قسم" : "Create / update category"}><form className="el-p20-form" onSubmit={categoryAction}><Field label={ar ? "تعديل قسم موجود" : "Existing category"}><select name="category_id"><option value="">{ar ? "قسم جديد" : "New category"}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Name EN"><input name="category_name" /></Field><Field label="Name AR"><input dir="rtl" name="category_name_ar" /></Field><Field label="Slug"><input name="category_slug" /></Field><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ القسم" : "Save category"}</button></form></Panel><Panel title={ar ? "إضافة / تعديل خاصية" : "Create / update attribute"}><form className="el-p20-form" onSubmit={attributeAction}><Field label={ar ? "تعديل خاصية" : "Existing attribute"}><select name="attribute_id"><option value="">{ar ? "خاصية جديدة" : "New attribute"}</option>{attributes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Code"><input name="attribute_code" pattern="[a-z0-9_]+" /></Field><Field label="Name EN"><input name="attribute_name" /></Field><Field label="Name AR"><input dir="rtl" name="attribute_name_ar" /></Field><button className="el-p20-primary" disabled={busy} type="submit">{ar ? "حفظ الخاصية" : "Save attribute"}</button></form></Panel></section> : null}
  </>;
}

function ReportsWorkspace({ session, locale, ar }: Omit<WorkspaceProps, "access">) {
  const [dashboard, setDashboard] = useState<ReportingDashboard | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [rma, setRma] = useState<RmaReport | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([fetchReportingDashboard(session), fetchInventoryReport(session), fetchRmaReport(session), fetchSupplierReport(session)]).then(([a, b, c, d]) => {
      if (!active) return;
      if (a.status === "fulfilled") setDashboard(a.value); else setError(message(a.reason));
      if (b.status === "fulfilled") setInventory(b.value);
      if (c.status === "fulfilled") setRma(c.value);
      if (d.status === "fulfilled") setSuppliers(d.value);
    });
    return () => { active = false; };
  }, [session]);

  async function download(kind: "csv" | "pdf") { setBusy(kind); setError(""); try { const result = await downloadSalesExport(kind, session); const url = URL.createObjectURL(result.blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); } catch (reason) { setError(message(reason)); } finally { setBusy(null); } }

  return <>
    <Kpis items={[[ar ? "الإيراد" : "REVENUE", `${money(dashboard?.total_revenue ?? 0, locale)} EGP`, "period"], [ar ? "الطلبات" : "ORDERS", n(dashboard?.total_orders ?? 0, locale), `${n(dashboard?.paid_orders ?? 0, locale)} paid`], [ar ? "مخزون منخفض" : "LOW STOCK", n(inventory?.low_stock_products.length ?? 0, locale), "SKUs"], ["RMA", n(rma?.total_claims ?? 0, locale), `${n(rma?.recent_claims ?? 0, locale)} recent`]]} />
    {error ? <ErrorBox text={error} /> : null}
    <section className="el-p20-admin-grid"><Panel title={ar ? "سلسلة الإيراد" : "Revenue series"}><Table headers={[ar ? "الفترة" : "Period", ar ? "الطلبات" : "Orders", ar ? "الإيراد" : "Revenue"]}>{(dashboard?.revenue_series ?? []).slice(-12).map((item) => <tr key={item.period}><td>{item.period}</td><td>{n(item.order_count, locale)}</td><td>{money(item.revenue, locale)} EGP</td></tr>)}</Table></Panel><Panel title={ar ? "التصدير الموثق" : "Authenticated exports"}><div className="el-p20-export-actions"><button className="el-p20-primary" disabled={busy !== null} onClick={() => void download("csv")} type="button"><StoreIcon name="file" size={18} />{busy === "csv" ? "…" : "Sales CSV"}</button><button className="el-p20-secondary" disabled={busy !== null} onClick={() => void download("pdf")} type="button"><StoreIcon name="file" size={18} />{busy === "pdf" ? "…" : "Sales PDF"}</button></div><Result title={ar ? "تغطية التقارير" : "Report coverage"} rows={[[ar ? "المخزون" : "Inventory", inventory ? "Live" : "Unavailable"], ["RMA", rma ? "Live" : "Unavailable"], [ar ? "الموردون" : "Suppliers", suppliers ? `${suppliers.suppliers.length}` : "Unavailable"], [ar ? "المبيعات" : "Sales", dashboard ? "Live" : "Unavailable"]]} /></Panel></section>
    <Panel title={ar ? "الأكثر مبيعًا" : "Best sellers"}><Table headers={["SKU", ar ? "المنتج" : "Product", ar ? "الوحدات" : "Units", ar ? "الإيراد" : "Revenue"]}>{(dashboard?.best_sellers ?? []).map((item) => <tr key={item.product_id}><td><code>{item.sku}</code></td><td>{item.name}</td><td>{n(item.units_sold, locale)}</td><td>{money(item.revenue, locale)} EGP</td></tr>)}</Table></Panel>
  </>;
}

function LookupForm({ label, placeholder, ar, busy, onSubmit }: { label: string; placeholder: string; ar: boolean; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="el-p20-lookup" onSubmit={onSubmit}><label><span>{label}</span><input name="value" placeholder={placeholder} required /></label><button disabled={busy} type="submit"><StoreIcon name="search" size={16} />{ar ? "بحث" : "Lookup"}</button></form>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span>{label}</span>{children}</label>; }
function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) { return <label className="el-p20-checkbox"><input defaultChecked={checked} name={name} type="checkbox" /><span>{label}</span></label>; }
function Kpis({ items }: { items: Array<[string, string, string]> }) { return <section className="el-p20-kpis">{items.map(([label, value, meta]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{meta}</span></article>)}</section>; }
function Panel({ title, children }: { title: string; children: ReactNode }) { return <article className="el-p20-panel"><div className="el-p20-panel__heading"><h2>{title}</h2></div>{children}</article>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="el-p20-table-wrap"><table className="el-p20-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Result({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div className="el-p20-result"><h3>{title}</h3>{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>; }
function Status({ value }: { value: string }) { const normalized = value.toLowerCase(); const tone = ["active", "verified", "received", "paid", "delivered"].some((item) => normalized.includes(item)) ? "success" : ["cancel", "exception", "inactive"].some((item) => normalized.includes(item)) ? "danger" : ["draft", "sent", "partial", "unverified", "pending"].some((item) => normalized.includes(item)) ? "warning" : "accent"; return <span className={`el-p20-status is-${tone}`}>{human(value)}</span>; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <section className={`el-p20-state${error ? " is-error" : ""}`}><StoreIcon name={error ? "returns" : "clock"} size={32} /><p>{text}</p></section>; }
function ErrorBox({ text }: { text: string }) { return <p className="el-p20-error" role="alert">{text}</p>; }
function Muted({ text }: { text: string }) { return <p className="el-p20-muted">{text}</p>; }
function human(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "The operation could not be completed."; }
function n(value: number, locale: "en" | "ar") { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(value); }
function money(value: string | number, locale: "en" | "ar") { const numeric = Number(value); return Number.isFinite(numeric) ? new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { maximumFractionDigits: 2 }).format(numeric) : String(value); }
