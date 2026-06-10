import Link from "next/link";

const tiers = [
  { name: "Free", price: "$0", plans: "Preview only", highlight: false },
  { name: "Starter", price: "$24/mo", plans: "3 plans / month", highlight: false },
  { name: "Pro", price: "$59/mo", plans: "10 plans / month", highlight: true },
  { name: "Business", price: "$129/mo", plans: "30 plans / month", highlight: false },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/20 via-surface to-surface" />

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <nav className="mb-20 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">Build-Block</span>
          <div className="flex gap-4 text-sm text-gray-400">
            <Link href="/create" className="hover:text-white transition-colors">Create</Link>
            <Link href="/plans" className="hover:text-white transition-colors">My Plans</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/account" className="hover:text-white transition-colors">Account</Link>
            <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
          </div>
        </nav>

        <section className="mb-24 text-center">
          <p className="mb-4 text-sm uppercase tracking-widest text-accent-glow">
            AI + Proprietary Templates
          </p>
          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
            Business plans that
            <span className="block text-accent-glow">investors actually read</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400">
            Describe your idea. Our RAG pipeline retrieves proven templates and generates a
            structured, editable plan — not generic AI filler.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/create"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-white transition hover:bg-accent-glow"
            >
              Start free preview
            </Link>
            <Link
              href="/pricing"
              className="glass rounded-lg px-8 py-3 font-medium transition hover:border-accent/50"
            >
              View plans
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`glass rounded-xl p-6 ${tier.highlight ? "border-accent/50 ring-1 ring-accent/30" : ""}`}
            >
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="mt-2 text-2xl font-bold">{tier.price}</p>
              <p className="mt-2 text-sm text-gray-400">{tier.plans}</p>
            </div>
          ))}
        </section>

        <p className="mt-8 text-center text-sm text-gray-500">
          Free tier: full wizard + one watermarked executive summary preview. Subscribe for full
          plans and export.
        </p>
      </div>
    </main>
  );
}
