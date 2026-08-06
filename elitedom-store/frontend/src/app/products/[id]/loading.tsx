export default function ProductLoading() {
  return (
    <div className="site-container py-10 sm:py-14">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-900" />
      <div className="mt-7 grid animate-pulse gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.9fr)]">
        <div className="aspect-square rounded-3xl border border-slate-800 bg-slate-900/60" />
        <div className="space-y-5 py-3">
          <div className="h-5 w-24 rounded bg-slate-900" />
          <div className="h-12 w-4/5 rounded bg-slate-900" />
          <div className="h-20 rounded bg-slate-900" />
          <div className="h-16 rounded bg-slate-900" />
        </div>
      </div>
    </div>
  );
}
