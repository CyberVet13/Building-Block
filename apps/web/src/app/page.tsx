import Link from "next/link";

const FEATURES = [
  {
    icon: "◈",
    title: "Proprietary templates",
    body: "Every plan is grounded in battle-tested frameworks — not generic AI output.",
  },
  {
    icon: "⟳",
    title: "Multi-stage pipeline",
    body: "Market analysis, financials, competitive landscape, and executive summary — each stage purpose-built.",
  },
  {
    icon: "⬡",
    title: "Fully editable output",
    body: "Plans arrive as structured documents you can edit inline and export to PDF or DOCX.",
  },
  {
    icon: "⬢",
    title: "Instant, not overnight",
    body: "Full business plan in 2–5 minutes. No consulting retainer required.",
  },
];

const TIERS = [
  { name: "Free",     price: "$0",     plans: "Preview only",    highlight: false },
  { name: "Starter",  price: "$24/mo", plans: "3 plans / month", highlight: false },
  { name: "Pro",      price: "$59/mo", plans: "10 plans / month", highlight: true  },
  { name: "Business", price: "$129/mo",plans: "30 plans / month", highlight: false },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.15),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-6">

        {/* ── Hero ── */}
        <section className="py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent-glow mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-glow animate-pulse" />
            Proprietary RAG pipeline · No generic AI filler
          </div>

          <h1 className="text-5xl font-bold tracking-tight leading-tight md:text-6xl">
            Business plans that
            <span className="block text-accent-glow">investors actually read</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 leading-relaxed">
            Describe your idea. Our AI retrieves proven templates, runs a multi-stage
            analysis pipeline, and delivers a structured, editable business plan in minutes —
            not a wall of generic text.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/create"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-white transition hover:bg-accent-glow shadow-lg shadow-accent/20"
            >
              Generate free preview
            </Link>
            <Link
              href="/pricing"
              className="glass rounded-lg px-8 py-3 font-medium transition hover:border-accent/50"
            >
              View plans →
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-600">
            No credit card for preview · Full plan from $24/mo
          </p>
        </section>

        {/* ── Features ── */}
        <section className="py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-xl p-6">
                <span className="text-2xl text-accent-glow">{f.icon}</span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-16 text-center">
          <h2 className="text-3xl font-bold">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Describe your idea", body: "4-step wizard — business concept, market, revenue model." },
              { step: "2", title: "Pipeline runs",       body: "8 AI stages: outline, market, financials, competitive, ops, summary." },
              { step: "3", title: "Edit and export",     body: "Structured plan with inline editing. Download PDF or DOCX." },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 text-sm font-bold text-accent-glow">
                  {item.step}
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="py-16">
          <h2 className="mb-2 text-center text-3xl font-bold">Simple pricing</h2>
          <p className="mb-10 text-center text-gray-400">
            One plan = one full generation. Resets each billing period.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`glass flex flex-col rounded-xl p-6 ${
                  tier.highlight ? "border-accent/50 ring-1 ring-accent/30" : ""
                }`}
              >
                {tier.highlight && (
                  <span className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-glow">Popular</span>
                )}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className="mt-2 text-2xl font-bold">{tier.price}</p>
                <p className="mt-1 text-sm text-gray-400">{tier.plans}</p>
                <Link
                  href="/pricing"
                  className={`mt-auto pt-4 text-sm font-medium text-center rounded-lg py-2 ${
                    tier.highlight
                      ? "bg-accent text-white hover:bg-accent-glow"
                      : "glass hover:border-accent/50"
                  }`}
                >
                  {tier.name === "Free" ? "Try free" : "Get started"}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-16 text-center">
          <div className="glass mx-auto max-w-2xl rounded-2xl p-12">
            <h2 className="text-3xl font-bold">Ready to build your plan?</h2>
            <p className="mt-3 text-gray-400">
              Free preview — no credit card. Full plan in 2–5 minutes.
            </p>
            <Link
              href="/create"
              className="mt-8 inline-block rounded-lg bg-accent px-10 py-3 font-medium text-white hover:bg-accent-glow shadow-lg shadow-accent/20"
            >
              Start now
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-surface-border py-8 text-center text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Build-Block · AI-powered business plans</p>
          <p className="mt-1">
            <Link href="/pricing" className="hover:text-gray-400">Pricing</Link>
            {" · "}
            <Link href="/signin" className="hover:text-gray-400">Sign in</Link>
            {" · "}
            <Link href="/signup" className="hover:text-gray-400">Sign up</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
