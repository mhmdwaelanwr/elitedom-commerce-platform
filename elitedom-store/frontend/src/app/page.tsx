import Image from "next/image";
import Link from "next/link";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { CATALOG, CATEGORIES } from "@/lib/catalog";

const useCases = [
  {
    description: "Performance parts, controllers, audio, and custom builds for a focused setup.",
    href: "/shop?category=gaming",
    icon: "◈",
    title: "Game & create",
  },
  {
    description: "Reliable laptops, wireless peripherals, and networking for every workday.",
    href: "/shop?category=computers",
    icon: "⌘",
    title: "Work without limits",
  },
  {
    description: "Procurement-ready equipment, quantity pricing, and a team that speaks technical.",
    href: "/b2b",
    icon: "▦",
    title: "Equip a team",
  },
];

export default function HomePage() {
  const featuredProducts = CATALOG.filter((product) => product.featured).slice(0, 4);
  const latestProducts = [...CATALOG]
    .filter((product) => !product.featured)
    .sort((first, second) => second.rating - first.rating)
    .slice(0, 4);

  return (
    <>
      <section className="surface-grid overflow-hidden border-b border-slate-800 bg-[radial-gradient(circle_at_82%_16%,rgba(37,99,235,0.34),transparent_30%),radial-gradient(circle_at_16%_0%,rgba(14,165,233,0.18),transparent_28%)]">
        <div className="site-container grid gap-5 py-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,.72fr)] lg:py-7">
          <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-sky-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 px-6 py-10 shadow-2xl shadow-blue-950/30 sm:px-10 sm:py-14 lg:min-h-[31rem]">
            <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="relative z-10 max-w-[37rem]">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">Egyptian technology retail</span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">Digital warranty included</span>
              </div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-sky-300">Build a better setup</p>
              <h1 className="mt-3 max-w-xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
                Tech you can choose with <span className="text-sky-400">confidence.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Discover carefully selected hardware with live availability, VAT-inclusive pricing, delivery across Egypt, and support after checkout.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="button-primary" href="/shop">
                  Shop all technology <span aria-hidden="true" className="ml-2">→</span>
                </Link>
                <Link className="button-secondary" href="/b2b">Build a business quote</Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-700/70 pt-5">
                <Metric label="Governorates covered" value="27" />
                <Metric label="VAT shown clearly" value="14%" />
                <Metric label="Warranty support" value="1:1" />
              </dl>
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 hidden w-[43%] max-w-[22rem] lg:block">
              <Image
                alt="Wireless headphones from the Elitedom collection"
                className="h-auto w-full object-contain drop-shadow-2xl"
                height={361}
                priority
                src="/template/images/hero/hero-01.png"
                width={354}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <HeroDepartment
              href="/shop?category=mobile"
              image="/template/images/hero/hero-02.png"
              label="Mobile & tablets"
              title="Stay connected, anywhere."
            />
            <HeroDepartment
              href="/shop?category=audio"
              image="/template/images/hero/hero-03.png"
              label="Audio essentials"
              title="Sound that keeps up."
            />
            <Link className="group rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-5 transition hover:border-emerald-300/45 hover:bg-emerald-400/10 focus-ring sm:col-span-2 lg:col-span-1" href="/warranty">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-300">Post-purchase care</p>
              <p className="mt-2 font-bold text-white">Register, track, and get help with your warranty.</p>
              <span className="mt-4 inline-flex text-sm font-bold text-emerald-200 group-hover:text-white">Open warranty support <span aria-hidden="true" className="ml-2">→</span></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 bg-slate-900/45">
        <div className="site-container grid divide-y divide-slate-800 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <TrustPoint detail="Clear product availability before checkout." icon="✓" title="Verified stock" />
          <TrustPoint detail="Cards, InstaPay, or cash on delivery." icon="⌁" title="Flexible ways to pay" />
          <TrustPoint detail="Support for orders, serials, and RMAs." icon="✦" title="Support that stays" />
        </div>
      </section>

      <section className="site-container py-16 sm:py-20">
        <SectionHeading
          actionHref="/shop"
          actionLabel="View all products"
          eyebrow="Shop your way"
          title="Start with a department"
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Link
              className="group flex min-h-32 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:bg-slate-900 focus-ring"
              href={`/shop?category=${category.slug}`}
              key={category.slug}
            >
              <div className="relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                <Image alt="" className="object-contain p-2 transition duration-300 group-hover:scale-110" fill sizes="72px" src={category.image} />
              </div>
              <div>
                <h3 className="font-bold text-white group-hover:text-sky-300">{category.name}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-400">{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/35 py-16 sm:py-20">
        <div className="site-container">
          <SectionHeading
            actionHref="/shop"
            actionLabel="See the full catalogue"
            eyebrow="Chosen for demanding setups"
            title="Featured technology"
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => <StoreProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </section>

      <section className="site-container py-16 sm:py-20">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <Promotion
            accent="blue"
            description="From a single device to a full desk setup, browse technology with the details you need to decide." 
            href="/shop?category=computers"
            image="/template/images/promo/promo-01.png"
            kicker="Focused work, smarter hardware"
            title="Give your workday more headroom."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <Promotion
              accent="teal"
              compact
              description="Keyboards, mice, controllers, and the small things that change a setup."
              href="/shop?category=peripherals"
              image="/template/images/promo/promo-02.png"
              kicker="Everyday essentials"
              title="Upgrade the gear you touch most."
            />
            <Promotion
              accent="amber"
              compact
              description="A better listening and calling experience starts with the right audio." 
              href="/shop?category=audio"
              image="/template/images/promo/promo-03.png"
              kicker="Listen in"
              title="Audio made for the whole day."
            />
          </div>
        </div>
      </section>

      {latestProducts.length > 0 && (
        <section className="border-y border-slate-800 bg-slate-900/30 py-16 sm:py-20">
          <div className="site-container">
            <SectionHeading
              actionHref="/shop"
              actionLabel="Browse everything"
              eyebrow="Worth a closer look"
              title="More to explore"
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {latestProducts.map((product) => <StoreProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      <section className="site-container py-16 sm:py-20">
        <SectionHeading eyebrow="Make the shortlist" title="What are you shopping for?" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {useCases.map((useCase) => (
            <Link className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:-translate-y-1 hover:border-sky-500/55 hover:bg-slate-900 focus-ring" href={useCase.href} key={useCase.title}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/10 text-lg font-black text-sky-300">{useCase.icon}</span>
              <h2 className="mt-5 text-lg font-bold text-white group-hover:text-sky-300">{useCase.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{useCase.description}</p>
              <span className="mt-5 inline-flex text-sm font-bold text-sky-300 group-hover:text-white">Explore <span aria-hidden="true" className="ml-2">→</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 bg-gradient-to-r from-blue-950/70 via-slate-950 to-slate-950">
        <div className="site-container grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="section-kicker">Teams, schools, and institutions</p>
            <h2 className="mt-2 text-3xl font-black text-white">Need more than a single unit?</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">Build an RFQ, get tiered pricing, and work with a dedicated Elitedom account manager for procurement.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link className="button-primary" href="/b2b">Start a B2B RFQ</Link>
            <Link className="button-secondary" href="/warranty">Warranty support</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroDepartment({ href, image, label, title }: { href: string; image: string; label: string; title: string }) {
  return (
    <Link className="group relative min-h-40 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-5 transition hover:border-sky-400/60 hover:bg-slate-800 focus-ring" href={href}>
      <div className="relative z-10 max-w-[10rem]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-300">{label}</p>
        <h2 className="mt-2 text-lg font-black leading-6 text-white">{title}</h2>
        <span className="mt-5 inline-flex text-sm font-bold text-slate-300 group-hover:text-white">Shop now <span aria-hidden="true" className="ml-2">→</span></span>
      </div>
      <Image alt="" className="absolute bottom-0 right-2 h-[86%] w-auto object-contain transition duration-300 group-hover:scale-105" height={210} src={image} width={150} />
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xl font-black text-white">{value}</dt>
      <dd className="mt-1 text-xs leading-5 text-slate-400">{label}</dd>
    </div>
  );
}

function TrustPoint({ detail, icon, title }: { detail: string; icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 py-4 sm:px-6 first:pl-0 last:pr-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-400/10 text-sm font-black text-sky-300">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  actionHref,
  actionLabel,
  eyebrow,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{title}</h2>
      </div>
      {actionHref && actionLabel && <Link className="text-sm font-bold text-sky-300 hover:text-white focus-ring" href={actionHref}>{actionLabel} →</Link>}
    </div>
  );
}

function Promotion({
  accent,
  compact = false,
  description,
  href,
  image,
  kicker,
  title,
}: {
  accent: "amber" | "blue" | "teal";
  compact?: boolean;
  description: string;
  href: string;
  image: string;
  kicker: string;
  title: string;
}) {
  const accentClasses = {
    amber: "border-amber-300/20 bg-amber-300/[0.07] hover:border-amber-300/50",
    blue: "border-sky-300/20 bg-blue-500/[0.08] hover:border-sky-300/50",
    teal: "border-teal-300/20 bg-teal-300/[0.07] hover:border-teal-300/50",
  }[accent];

  return (
    <Link className={`group relative isolate overflow-hidden rounded-3xl border p-7 transition hover:-translate-y-0.5 focus-ring ${compact ? "min-h-[15rem]" : "min-h-[25rem] sm:p-10"} ${accentClasses}`} href={href}>
      <div className={`relative z-10 ${compact ? "max-w-[15rem]" : "max-w-[27rem]"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">{kicker}</p>
        <h2 className={`mt-3 font-black tracking-tight text-white ${compact ? "text-2xl leading-8" : "text-3xl leading-9 sm:text-4xl sm:leading-10"}`}>{title}</h2>
        <p className={`mt-4 leading-6 text-slate-300 ${compact ? "text-sm" : "max-w-md text-sm sm:text-base"}`}>{description}</p>
        <span className="mt-7 inline-flex text-sm font-bold text-sky-200 group-hover:text-white">Explore the collection <span aria-hidden="true" className="ml-2">→</span></span>
      </div>
      <Image alt="" className={`pointer-events-none absolute bottom-0 right-0 z-0 object-contain opacity-90 transition duration-500 group-hover:scale-105 ${compact ? "h-[92%] w-[50%]" : "h-[90%] w-[45%]"}`} fill sizes="(max-width: 640px) 48vw, 32vw" src={image} />
    </Link>
  );
}
