import Link from "next/link";

const footerLinks = [
  { href: "/shop", label: "Shop hardware" },
  { href: "/b2b", label: "B2B quotation" },
  { href: "/warranty", label: "Warranty & RMA" },
  { href: "/account", label: "My account" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg focus-ring">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-base font-black text-white">E</span>
            <span className="text-lg font-black tracking-tight text-white">ELITE<span className="text-sky-400">DOM</span></span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6">
            Technology retail built around transparent pricing, careful product selection, and dependable after-sales support in Egypt.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200">Store</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            {footerLinks.map((link) => <li key={link.href}><Link className="hover:text-white focus-ring" href={link.href}>{link.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200">Customer promise</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6">
            <li>Clear VAT-inclusive prices</li>
            <li>Delivery across Egyptian governorates</li>
            <li>Digital warranty and RMA tracking</li>
            <li>Technical help before and after purchase</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="site-container flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Elitedom Store. All rights reserved.</span>
          <span>Payments: Cards · Mobile wallet · Cash on delivery</span>
        </div>
      </div>
    </footer>
  );
}
