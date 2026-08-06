"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAccountOverview, logout } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/components/store/StoreProvider";

type Overview = Awaited<ReturnType<typeof fetchAccountOverview>>;

export default function AccountPage() {
  const { currency, notify, session, setSession } = useStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    if (!session) return;
    let live = true;
    fetchAccountOverview(session).then((result) => { if (live) setOverview(result); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session]);

  if (!session) return <div className="site-container grid min-h-[55vh] place-items-center py-12 text-center"><div><p className="text-4xl">◌</p><h1 className="mt-4 text-3xl font-black text-white">Your Elitedom account</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">Sign in to view orders, saved addresses, loyalty rewards, and digital warranty support.</p><div className="mt-6 flex justify-center gap-3"><Link className="button-primary" href="/signin?next=/account">Sign in</Link><Link className="button-secondary" href="/signup">Create account</Link></div></div></div>;

  const profileName = overview?.profile?.name ?? session.name ?? "Elitedom customer";
  return <div className="site-container py-10 sm:py-14"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="section-kicker">Account dashboard</p><h1 className="mt-2 text-3xl font-black text-white">Hello, {profileName}</h1><p className="mt-2 text-sm text-slate-400">{overview?.profile?.email ?? session.email} · {session.role.replaceAll("_", " ")}</p></div><button className="button-secondary text-sm" onClick={async () => { try { await logout(session); } catch { /* Clear browser state even if the API is offline. */ } setSession(null); notify("You have been signed out.", "info"); }} type="button">Sign out</button></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><AccountTile label="Loyalty points" value={overview?.loyalty ? String(overview.loyalty.points_balance) : isLoading ? "…" : "0"} detail={overview?.loyalty ? `${formatPrice(Number(overview.loyalty.redeemable_value_egp), currency)} redeemable` : "Earn points after paid orders"} /><AccountTile label="Recent orders" value={isLoading ? "…" : String(overview?.orders.length ?? 0)} detail="Your latest five orders" /><AccountLink href="/account/profile" label="Personal details" detail="Update contact preferences" icon="◌" /><AccountLink href="/account/addresses" label="Saved addresses" detail="Manage delivery locations" icon="⌂" /><AccountLink href="/warranty" label="Warranty & RMA" detail="Open or track a claim" icon="⌁" /><AccountLink href="/b2b" label="Business quotes" detail="Submit a procurement RFQ" icon="▣" /></div><section className="mt-10 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-6"><div><h2 className="text-xl font-black text-white">Recent orders</h2><p className="mt-1 text-sm text-slate-400">Orders are synced from your Elitedom account.</p></div><Link className="text-sm font-bold text-sky-300 hover:text-white focus-ring" href="/shop">Shop again</Link></div>{overview?.orders.length ? <div className="divide-y divide-slate-800">{overview.orders.map((order) => <div className="flex flex-wrap items-center justify-between gap-3 p-5" key={order.id}><div><p className="font-bold text-white">{order.name}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("en-EG", { dateStyle: "medium" }).format(new Date(order.created_at))}</p></div><div className="text-right"><p className="font-bold text-slate-100">{formatPrice(Number(order.amount_total), currency)}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-sky-300">{order.state}</p></div></div>)}</div> : <div className="p-8 text-center"><p className="text-sm text-slate-400">{isLoading ? "Loading orders…" : "You have no recorded orders yet."}</p><Link className="button-primary mt-5" href="/shop">Browse products</Link></div>}</section></div>;
}

function AccountTile({ detail, label, value }: { detail: string; label: string; value: string }) { return <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-sm font-semibold text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>; }
function AccountLink({ detail, href, icon, label }: { detail: string; href: string; icon: string; label: string }) { return <Link className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-sky-500/60 hover:bg-slate-900 focus-ring" href={href}><span className="text-xl text-sky-300">{icon}</span><p className="mt-2 font-bold text-white group-hover:text-sky-300">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></Link>; }
