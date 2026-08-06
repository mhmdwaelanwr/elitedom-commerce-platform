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
      .then((items) => {
        if (active) setAddresses(items);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError instanceof ApiError ? requestError.message : t("account", "addressesLoadError"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, t]);

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
        ...(created.is_default
          ? current.map((address) => ({ ...address, is_default: false }))
          : current),
        created,
      ]);
      setForm(EMPTY_ADDRESS);
      notify(t("account", "addressSaved"));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("account", "addressSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(addressId: number) {
    if (!session) return;
    setError(null);
    try {
      const updated = await setDefaultCustomerAddress(addressId, session);
      setAddresses((current) => current.map((address) =>
        address.id === updated.id ? updated : { ...address, is_default: false },
      ));
      notify(t("account", "defaultUpdated"));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("account", "defaultUpdateError"));
    }
  }

  async function removeAddress(addressId: number) {
    if (!session) return;
    setError(null);
    try {
      await deleteCustomerAddress(addressId, session);
      setAddresses((current) => current.filter((address) => address.id !== addressId));
      notify(t("account", "addressRemoved"), "info");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : t("account", "addressRemoveError"));
    }
  }

  if (!session) return <SignInPrompt />;

  return (
    <div className="site-container py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link className="focus-ring rounded-md hover:text-foreground" href="/account">
          {t("account", "title")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{t("account", "savedAddresses")}</span>
      </nav>

      <div className="mt-6">
        <p className="section-kicker">{t("account", "settings")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">{t("account", "savedDeliveryAddresses")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("account", "addressesDescription")}</p>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">{t("account", "loadingAddresses")}</p>
        ) : addresses.length > 0 ? (
          addresses.map((address) => (
            <AddressCard address={address} key={address.id} onDelete={removeAddress} onDefault={makeDefault} />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-elevated p-6 text-sm text-muted">{t("account", "noAddresses")}</p>
        )}
      </section>

      <form className="mt-10 max-w-3xl rounded-2xl border border-border bg-surface p-5 sm:p-7" onSubmit={addAddress}>
        <h2 className="text-xl font-black text-foreground">{t("account", "addDeliveryAddress")}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label={t("account", "addressLabel")}>
            <input className="form-input" disabled={isSaving} onChange={(event) => update("label", event.target.value)} required value={form.label} />
          </Field>
          <Field label={t("account", "recipientName")}>
            <input autoComplete="name" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_name", event.target.value)} required value={form.recipient_name} />
          </Field>
          <Field label={t("account", "recipientMobile")}>
            <input autoComplete="tel" className="form-input" disabled={isSaving} onChange={(event) => update("recipient_phone", event.target.value)} required type="tel" value={form.recipient_phone} />
          </Field>
          <Field label={t("account", "governorate")}>
            <select className="form-input" disabled={isSaving} onChange={(event) => update("governorate", event.target.value)} required value={form.governorate}>
              {GOVERNORATES.map((governorate) => <option key={governorate}>{governorate}</option>)}
            </select>
          </Field>
          <Field label={t("account", "city")}>
            <input className="form-input" disabled={isSaving} onChange={(event) => update("city", event.target.value)} required value={form.city} />
          </Field>
          <Field label={t("account", "postalOptional")}>
            <input autoComplete="postal-code" className="form-input" disabled={isSaving} onChange={(event) => update("postal_code", event.target.value)} value={form.postal_code} />
          </Field>
        </div>

        <Field label={t("account", "streetAddress")}>
          <textarea autoComplete="street-address" className="form-input min-h-24 resize-y" disabled={isSaving} onChange={(event) => update("street_address", event.target.value)} required value={form.street_address} />
        </Field>
        <Field label={t("account", "addressLine2Optional")}>
          <input className="form-input" disabled={isSaving} onChange={(event) => update("address_line_2", event.target.value)} value={form.address_line_2} />
        </Field>

        <label className="mt-5 flex items-center gap-3 text-sm text-muted">
          <input checked={form.is_default} className="h-4 w-4 accent-primary" disabled={isSaving} onChange={(event) => update("is_default", event.target.checked)} type="checkbox" />
          {t("account", "makeDefault")}
        </label>

        <button className="button-primary mt-6 disabled:cursor-wait disabled:opacity-70" disabled={isSaving} type="submit">
          {isSaving ? t("account", "saving") : t("account", "saveAddress")}
        </button>
      </form>
    </div>
  );
}

function AddressCard({
  address,
  onDefault,
  onDelete,
}: {
  address: CustomerAddress;
  onDefault: (addressId: number) => void;
  onDelete: (addressId: number) => void;
}) {
  const { t } = usePreferences();
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{address.label}</p>
          <p className="mt-1 text-sm text-primary">
            {address.is_default ? t("account", "defaultAddress") : t("account", "savedAddress")}
          </p>
        </div>
        {address.is_default && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{t("account", "default")}</span>
        )}
      </div>
      <address className="mt-5 not-italic text-sm leading-6 text-muted">
        <strong className="text-foreground">{address.recipient_name}</strong>
        <br />
        {address.recipient_phone}
        <br />
        {address.street_address}
        {address.address_line_2 && <><br />{address.address_line_2}</>}
        <br />
        {address.city}, {address.governorate}
        <br />
        {address.country}{address.postal_code && ` · ${address.postal_code}`}
      </address>
      <div className="mt-6 flex flex-wrap gap-3">
        {!address.is_default && (
          <button className="button-secondary px-4 py-2 text-sm" onClick={() => onDefault(address.id)} type="button">
            {t("account", "setDefault")}
          </button>
        )}
        <button className="focus-ring rounded-md px-3 py-2 text-sm font-bold text-danger hover:bg-danger/10" onClick={() => onDelete(address.id)} type="button">
          {t("account", "remove")}
        </button>
      </div>
    </article>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="mt-5 grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SignInPrompt() {
  const { t } = usePreferences();
  return (
    <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-elevated text-3xl text-primary">⌂</div>
        <h1 className="mt-4 text-3xl font-black text-foreground">{t("account", "signInManageAddresses")}</h1>
        <p className="mt-3 text-sm text-muted">{t("account", "addressesSecureText")}</p>
        <Link className="button-primary mt-6" href="/signin?next=/account/addresses">
          {t("account", "signIn")}
        </Link>
      </div>
    </div>
  );
}
