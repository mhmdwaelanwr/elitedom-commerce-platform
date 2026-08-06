import Image from "next/image";
import Link from "next/link";
import { HomeCatalogSections } from "@/components/store/HomeCatalogSections";

const departments = [
  { name: "Gaming", slug: "gaming", image: "/template/images/categories/categories-01.png" },
  { name: "Computers", slug: "computers", image: "/template/images/categories/categories-02.png" },
  { name: "Peripherals", slug: "peripherals", image: "/template/images/categories/categories-03.png" },
  { name: "Audio", slug: "audio", image: "/template/images/categories/categories-04.png" },
  { name: "Networking", slug: "networking", image: "/template/images/categories/categories-05.png" },
  { name: "Mobile", slug: "mobile", image: "/template/images/categories/categories-06.png" },
];

export default function HomePage() {
  return (
    <>
      <section className="overflow-hidden border-b border-slate-800 bg-[radial-gradient(circle_at_75%_10%,rgba(14,165,233,.24),transparent_32%),linear-gradient(180deg,#07111f,#050b14)] py-6 lg:py-10">
        <div className="site-container grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(20rem,1fr)]">
          <div className="relative isolate min-h-[31rem] overflow-hidden rounded-[2rem] border border-sky-300/20 bg-gradient-to-br from-[#10233d] via-[#081426] to-[#05101c] px-7 py-12 shadow-2xl sm:px-12 lg:min-h-[35rem] lg:py-16">
            <div className="absolute -right-20 -top-24 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <p className="section-kicker">Live inventory · Egyptian fulfilment</p>
              <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl">
                Technology selected for the way you <span className="text-sky-400">actually work.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Shop verified hardware with live Odoo stock, clear VAT-inclusive pricing,
                serial-aware warranty, and delivery support across Egypt.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="button-primary" href="/shop">Explore the catalogue →</Link>
                <Link className="button-secondary" href="/b2b">Request a business quote</Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-slate-700/70 pt-6">
                <Metric label="Governorates" value="27" />
                <Metric label="VAT visibility" value="14%" />
                <Metric label="Stock source" value="Odoo" />
              </dl>
            </div>
            <Image
              alt="Premium Elitedom technology"
              className="pointer-events-none absolute bottom-0 right-0 hidden h-auto w-[42%] max-w-[29rem] object-contain drop-shadow-2xl lg:block"
              height={520}
              priority
              src="/template/images/hero/hero-01.png"
              width={520}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <PromoCard
              href="/shop?category=mobile"
              image="/template/images/hero/hero-02.png"
              kicker="Mobile work"
              title="Portable performance, without guesswork."
            />
            <PromoCard
              href="/shop?category=audio"
              image="/template/images/hero/hero-03.png"
              kicker="Focused sound"
              title="Audio for calls, gaming, and the commute."
            />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-900/45">
        <div className="site-container grid divide-y divide-slate-800 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <TrustPoint title="Live stock" detail="Availability follows the Odoo warehouse ledger." />
          <TrustPoint title="Protected checkout" detail="Payment state is reconciled by signed webhooks." />
          <TrustPoint title="After-sales care" detail="Serials, warranty claims, and shipment tracking stay connected." />
        </div>
      </section>

      <section className="site-container py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Browse by department</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Start with what you are building</h2>
          </div>
          <Link className="text-sm font-black text-sky-300 hover:text-white" href="/shop">Full catalogue →</Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {departments.map((department) => (
            <Link
              className="group rounded-2xl border border-slate-800 bg-slate-900/55 p-4 text-center transition hover:-translate-y-1 hover:border-sky-400/60 hover:bg-slate-900"
              href={`/shop?category=${department.slug}`}
              key={department.slug}
            >
              <span className="relative mx-auto block aspect-square max-w-24 overflow-hidden rounded-2xl bg-slate-100">
                <Image alt="" className="object-contain p-3 transition group-hover:scale-110" fill sizes="96px" src={department.image} />
              </span>
              <span className="mt-4 block text-sm font-black text-white group-hover:text-sky-300">{department.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <HomeCatalogSections />

      <section className="site-container py-16">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Link className="group relative min-h-80 overflow-hidden rounded-3xl border border-blue-400/20 bg-blue-950/40 p-8" href="/shop?category=computers">
            <Image alt="Workstation collection" className="absolute bottom-0 right-0 h-full w-[48%] object-contain object-bottom transition group-hover:scale-105" fill sizes="50vw" src="/template/images/promo/promo-01.png" />
            <div className="relative z-10 max-w-sm">
              <p className="section-kicker">Performance systems</p>
              <h2 className="mt-3 text-3xl font-black text-white">More headroom for demanding work.</h2>
              <p className="mt-4 leading-7 text-slate-300">Compare real specifications, stock, warranty, and fulfilment before you commit.</p>
            </div>
          </Link>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <SmallBanner title="Equip your team" text="Quantity pricing and procurement-ready quotations." href="/b2b" />
            <SmallBanner title="Support after checkout" text="Track warranties, serials, and RMA requests in one place." href="/warranty" />
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-lg font-black text-white">{value}</dd></div>;
}

function PromoCard({ href, image, kicker, title }: { href: string; image: string; kicker: string; title: string }) {
  return (
    <Link className="group relative min-h-64 overflow-hidden rounded-3xl border border-slate-800 bg-white p-6 text-slate-950 transition hover:-translate-y-1 hover:border-sky-400" href={href}>
      <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">{kicker}</p>
      <h2 className="mt-3 max-w-[13rem] text-2xl font-black leading-tight">{title}</h2>
      <span className="mt-5 inline-flex text-sm font-black text-blue-700">Shop now →</span>
      <Image alt="" className="absolute bottom-0 right-0 h-[65%] w-[48%] object-contain object-bottom transition group-hover:scale-105" fill sizes="320px" src={image} />
    </Link>
  );
}

function TrustPoint({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-5 sm:px-7"><p className="font-black text-white">✓ {title}</p><p className="mt-1 text-sm text-slate-400">{detail}</p></div>;
}

function SmallBanner({ title, text, href }: { title: string; text: string; href: string }) {
  return <Link className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7 transition hover:border-sky-400/60 hover:bg-slate-900" href={href}><h3 className="text-xl font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p><span className="mt-5 inline-flex text-sm font-black text-sky-300">Open →</span></Link>;
}
