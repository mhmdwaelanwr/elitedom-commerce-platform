"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useStore } from "@/components/store/StoreProvider";
import {
  ApiError,
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  setDefaultCustomerAddress,
  type CustomerAddress,
} from "@/lib/api";
import { GOVERNORATES } from "@/lib/checkout";
import { usePreferences } from "@/providers/AppPreferencesProvider";

type AddressForm = { label: string; recipient_name: string; recipient_phone: string; street_address: string; address_line_2: string; city: string; governorate: string; postal_code: string; country: string; is_default: boolean };
const EMPTY_ADDRESS: AddressForm = { label: "Home", recipient_name: "", recipient_phone: "+20", street_address: "", address_line_2: "", city: "", governorate: "Cairo", postal_code: "", country: "Egypt", is_default: false };

export default function AddressesPage() {
  const { t } = usePreferences();
  const { notify, session } = useStore();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetchCustomerAddresses(session)
      .then((items) => { if (active) setAddresses(items); })
      .catch((requestError) => { if (active) setError(requestError instanceof ApiError ? requestError.message : t("account", "addressesLoadError")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, t]);

  function update<K extends keyof AddressForm>(key: K, value: AddressForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return; setError(null); setSaving(true);
    try {
      const created = await createCustomerAddress(form, session);
      setAddresses((current) => [...(created.is_default ? current.map((address) => ({ ...address, is_default: false })) : current), created]);
      setForm(EMPTY_ADDRESS); notify(t("account", "addressSaved"));
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : t("account", "addressSaveError")); } finally { setSaving(false); }
  }
  async function makeDefault(addressId: number) {
    if (!session) return; setError(null);
    try { const updated = await setDefaultCustomerAddress(addressId, session); setAddresses((current) => current.map((address) => address.id === updated.id ? updated : { ...address, is_default: false })); notify(t("account", "defaultUpdated")); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : t("account", "defaultUpdateError")); }
  }
  async function removeAddress(addressId: number) {
    if (!session) return; setError(null);
    try { await deleteCustomerAddress(addressId, session); setAddresses((current) => current.filter((address) => address.id !== addressId)); notify(t("account", "addressRemoved"), "info"); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : t("account", "addressRemoveError")); }
  }

  if (!session) return <SignInPrompt />;

  return (
    <div className="site-container py-7 sm:py-10 lg:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted"><Link className="focus-ring rounded-md hover:text-foreground" href="/account">{t("account", "title")}</Link><span aria-hidden="true">/</span><span className="text-foreground">{t("account", "savedAddresses")}</span></nav>

      <div className="mt-6 grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-10">
        <SettingsNav />
        <div className="min-w-0">
          <header className="border-b border-border pb-6"><p className="section-kicker">{t("account", "settings")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("account", "savedDeliveryAddresses")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("account", "addressesDescription")}</p></header>

          {error && <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert"><AlertIcon/><span>{error}</span></div>}

          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {isLoading ? (
              [1,2].map((item) => <div className="h-52 animate-pulse rounded-2xl border border-border bg-surface" key={item}/>)
            ) : addresses.length > 0 ? (
              addresses.map((address) => <AddressCard address={address} key={address.id} onDelete={removeAddress} onDefault={makeDefault}/>)
            ) : (
              <div className="md:col-span-2 rounded-2xl border border-dashed border-border bg-elevated px-6 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-surface text-primary"><LocationIcon/></span><p className="mt-4 text-sm text-muted">{t("account", "noAddresses")}</p></div>
            )}
          </section>

          <form className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface" onSubmit={addAddress}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6"><span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated text-primary"><PlusIcon/></span><h2 className="text-lg font-black text-foreground">{t("account", "addDeliveryAddress")}</h2></div>
            <div className="p-5 sm:p-6">
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Field label={t("account", "addressLabel")}><input className="form-input" disabled={isSaving} onChange={(event) => update("label", event.target.value)} required value={form.label}/></Field>
                <Field label={t("account", "recipientName")}><input autoComplete="name" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_name", event.target.value)} required value={form.recipient_name}/></Field>
                <Field label={t("account", "recipientMobile")}><input autoComplete="tel" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_phone", event.target.value)} required type="tel" value={form.recipient_phone}/></Field>
                <Field label={t("account", "governorate")}><select className="form-input" disabled={isSaving} onChange={(event) => update("governorate", event.target.value)} required value={form.governorate}>{GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}</select></Field>
                <Field label={t("account", "city")}><input className="form-input" disabled={isSaving} onChange={(event) => update("city", event.target.value)} required value={form.city}/></Field>
                <Field label={t("account", "postalOptional")}><input autoComplete="postal-code" className="form-input" disabled={isSaving} onChange={(event) => update("postal_code", event.target.value)} value={form.postal_code}/></Field>
              </div>
              <Field label={t("account", "streetAddress")}><textarea autoComplete="street-address" className="form-input min-h-24 resize-y" disabled={isSaving} onChange={(event) => update("street_address", event.target.value)} required value={form.street_address}/></Field>
              <Field label={t("account", "addressLine2Optional")}><input className="form-input" disabled={isSaving} onChange={(event) => update("address_line_2", event.target.value)} value={form.address_line_2}/></Field>
              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl bg-elevated px-4 py-3 text-sm font-bold text-foreground"><input checked={form.is_default} className="h-4 w-4 accent-primary" disabled={isSaving} onChange={(event) => update("is_default", event.target.checked)} type="checkbox"/>{t("account", "makeDefault")}</label>
            </div>
            <div className="border-t border-border bg-elevated px-5 py-4 sm:px-6"><button className="button-primary disabled:cursor-wait disabled:opacity-65" disabled={isSaving} type="submit">{isSaving ? t("account", "saving") : t("account", "saveAddress")}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AddressCard({ address, onDefault, onDelete }: { address: CustomerAddress; onDefault: (addressId: number) => void; onDelete: (addressId: number) => void }) {
  const { t } = usePreferences();
  return <article className={`relative overflow-hidden rounded-2xl border bg-surface p-5 ${address.is_default ? "border-primary/45" : "border-border"}`}>
    {address.is_default && <span className="absolute inset-x-0 top-0 h-1 bg-primary"/>}
    <div className="flex items-start justify-between gap-4"><span className={`grid h-10 w-10 place-items-center rounded-xl ${address.is_default ? "bg-[var(--ds-soft-primary)] text-primary" : "bg-elevated text-muted"}`}><LocationIcon/></span>{address.is_default && <span className="rounded-full bg-[var(--ds-soft-primary)] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-primary">{t("account", "default")}</span>}</div>
    <h3 className="mt-4 font-black text-foreground">{address.label}</h3><p className="mt-1 text-xs font-bold text-muted">{address.is_default ? t("account", "defaultAddress") : t("account", "savedAddress")}</p>
    <address className="mt-4 not-italic text-sm leading-6 text-muted"><strong className="text-foreground">{address.recipient_name}</strong><br/>{address.recipient_phone}<br/>{address.street_address}{address.address_line_2 && <><br/>{address.address_line_2}</>}<br/>{address.city}, {address.governorate}<br/>{address.country}{address.postal_code && ` · ${address.postal_code}`}</address>
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">{!address.is_default && <button className="button-secondary px-3 py-2 text-xs" onClick={() => onDefault(address.id)} type="button">{t("account", "setDefault")}</button>}<button className="focus-ring rounded-lg px-3 py-2 text-xs font-black text-danger hover:bg-danger/10" onClick={() => onDelete(address.id)} type="button">{t("account", "remove")}</button></div>
  </article>;
}
function SettingsNav() { const { t } = usePreferences(); const links=[{href:"/account/profile",label:t("account","personalDetails"),icon:<UserIcon/>},{href:"/account/addresses",label:t("account","savedAddresses"),icon:<LocationIcon/>,active:true},{href:"/account/security",label:t("auth","securityTitle"),icon:<ShieldIcon/>}]; return <aside className="h-fit rounded-2xl border border-border bg-surface p-2 lg:sticky lg:top-28">{links.map((link)=><Link className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition ${link.active?"bg-[var(--ds-soft-primary)] text-primary":"text-muted hover:bg-elevated hover:text-foreground"}`} href={link.href} key={link.href}><span>{link.icon}</span>{link.label}</Link>)}</aside>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="mt-5 grid gap-2 text-sm font-bold text-foreground"><span>{label}</span>{children}</label>; }
function SignInPrompt() { const { t } = usePreferences(); return <div className="site-container grid min-h-[64vh] place-items-center py-14 text-center"><section className="w-full max-w-lg"><span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface text-primary"><LocationIcon large/></span><h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">{t("account", "signInManageAddresses")}</h1><p className="mt-3 text-sm text-muted">{t("account", "addressesSecureText")}</p><Link className="button-primary mt-6" href="/signin?next=/account/addresses">{t("account", "signIn")}</Link></section></div>; }
function LocationIcon({ large=false }: { large?: boolean }) { const s=large?32:18; return <svg aria-hidden="true" fill="none" height={s} viewBox="0 0 24 24" width={s}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>; }
function UserIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 20c.8-3.2 3.3-5.2 7-5.2s6.2 2 7 5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;} function ShieldIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>;} function PlusIcon(){return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>;} function AlertIcon(){return <svg aria-hidden="true" className="mt-0.5 shrink-0" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8"/><path d="M12 9v5M12 17.5v.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>;}
