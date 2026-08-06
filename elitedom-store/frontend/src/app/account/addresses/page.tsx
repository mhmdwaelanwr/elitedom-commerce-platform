"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  type CustomerAddress,
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  setDefaultCustomerAddress,
} from "@/lib/api";
import { useStore } from "@/components/store/StoreProvider";

type AddressForm = {
  label: string;
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  address_line_2: string;
  city: string;
  governorate: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

const EMPTY_ADDRESS: AddressForm = {
  label: "Home",
  recipient_name: "",
  recipient_phone: "+20",
  street_address: "",
  address_line_2: "",
  city: "",
  governorate: "Cairo",
  postal_code: "",
  country: "Egypt",
  is_default: false,
};

export default function AddressesPage() {
  const { notify, session } = useStore();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [isLoading, setLoading] = useState(Boolean(session));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchCustomerAddresses(session)
      .then((items) => {
        if (active) setAddresses(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof ApiError ? requestError.message : "We could not load your saved addresses.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  function update<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const created = await createCustomerAddress(form, session);
      setAddresses((current) => [
        ...(created.is_default ? current.map((address) => ({ ...address, is_default: false })) : current),
        created,
      ]);
      setForm(EMPTY_ADDRESS);
      notify("Delivery address saved.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not save this address.");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(addressId: number) {
    if (!session) return;
    setError(null);
    try {
      const updated = await setDefaultCustomerAddress(addressId, session);
      setAddresses((current) => current.map((address) => address.id === updated.id ? updated : { ...address, is_default: false }));
      notify("Default delivery address updated.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not update the default address.");
    }
  }

  async function removeAddress(addressId: number) {
    if (!session) return;
    setError(null);
    try {
      await deleteCustomerAddress(addressId, session);
      setAddresses((current) => current.filter((address) => address.id !== addressId));
      notify("Delivery address removed.", "info");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not remove this address.");
    }
  }

  if (!session) return <SignInPrompt />;

  return (
    <div className="site-container py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><Link className="hover:text-white focus-ring" href="/account">Account</Link> <span aria-hidden="true">/</span> <span className="text-slate-200">Saved addresses</span></nav>
      <div className="mt-6"><p className="section-kicker">Account settings</p><h1 className="mt-2 text-3xl font-black text-white">Saved delivery addresses</h1><p className="mt-2 text-sm leading-6 text-slate-400">Save multiple Egyptian delivery locations and select the default you use most often.</p></div>
      {error && <p className="mt-6 rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {isLoading ? <p className="rounded-2xl border border-slate-800 bg-slate-900/55 p-6 text-sm text-slate-400">Loading saved addresses…</p> : addresses.length ? addresses.map((address) => <AddressCard address={address} key={address.id} onDelete={removeAddress} onDefault={makeDefault} />) : <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-400">No saved addresses yet. Add one below to speed up future checkouts.</p>}
      </section>
      <form className="mt-10 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-7" onSubmit={addAddress}>
        <h2 className="text-xl font-black text-white">Add a delivery address</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Address label"><input className="form-input" disabled={isSaving} onChange={(event) => update("label", event.target.value)} required value={form.label} /></Field>
          <Field label="Recipient name"><input autoComplete="name" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_name", event.target.value)} required value={form.recipient_name} /></Field>
          <Field label="Recipient mobile"><input autoComplete="tel" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_phone", event.target.value)} required type="tel" value={form.recipient_phone} /></Field>
          <Field label="Governorate"><input className="form-input" disabled={isSaving} onChange={(event) => update("governorate", event.target.value)} required value={form.governorate} /></Field>
          <Field label="City"><input className="form-input" disabled={isSaving} onChange={(event) => update("city", event.target.value)} required value={form.city} /></Field>
          <Field label="Postal code (optional)"><input autoComplete="postal-code" className="form-input" disabled={isSaving} onChange={(event) => update("postal_code", event.target.value)} value={form.postal_code} /></Field>
        </div>
        <Field label="Street address"><textarea autoComplete="street-address" className="form-input min-h-24 resize-y" disabled={isSaving} onChange={(event) => update("street_address", event.target.value)} required value={form.street_address} /></Field>
        <Field label="Address line 2 (optional)"><input className="form-input" disabled={isSaving} onChange={(event) => update("address_line_2", event.target.value)} value={form.address_line_2} /></Field>
        <label className="mt-5 flex items-center gap-3 text-sm text-slate-300"><input checked={form.is_default} className="h-4 w-4 accent-sky-400" disabled={isSaving} onChange={(event) => update("is_default", event.target.checked)} type="checkbox" />Make this my default delivery address</label>
        <button className="button-primary mt-6 disabled:cursor-wait disabled:opacity-70" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save address"}</button>
      </form>
    </div>
  );
}

function AddressCard({ address, onDefault, onDelete }: { address: CustomerAddress; onDefault: (addressId: number) => void; onDelete: (addressId: number) => void }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{address.label}</p><p className="mt-1 text-sm text-sky-300">{address.is_default ? "Default address" : "Saved address"}</p></div>{address.is_default && <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-bold text-sky-200">Default</span>}</div><address className="mt-5 not-italic text-sm leading-6 text-slate-300"><strong className="text-white">{address.recipient_name}</strong><br />{address.recipient_phone}<br />{address.street_address}{address.address_line_2 && <><br />{address.address_line_2}</>}<br />{address.city}, {address.governorate}<br />{address.country}{address.postal_code && ` · ${address.postal_code}`}</address><div className="mt-6 flex flex-wrap gap-3">{!address.is_default && <button className="button-secondary px-4 py-2 text-sm" onClick={() => onDefault(address.id)} type="button">Set as default</button>}<button className="px-3 py-2 text-sm font-bold text-rose-300 hover:text-rose-100 focus-ring" onClick={() => onDelete(address.id)} type="button">Remove</button></div></article>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="mt-5 grid gap-2 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>;
}

function SignInPrompt() {
  return <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center"><div><p className="text-4xl">⌂</p><h1 className="mt-4 text-3xl font-black text-white">Sign in to manage delivery addresses</h1><p className="mt-3 text-sm text-slate-400">Your saved delivery information is protected in your Elitedom account.</p><Link className="button-primary mt-6" href="/signin?next=/account/addresses">Sign in</Link></div></div>;
}
