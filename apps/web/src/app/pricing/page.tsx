import Link from "next/link";

const tiers = [
  {
    name: "Free",
    price: 0,
    plans: "0 full plans",
    features: ["Full intake wizard", "1 watermarked preview section", "No export"],
    cta: "Start preview",
    href: "/create",
  },
  {
    name: "Starter",
    price: 24,
    plans: "3 plans / month",
    features: ["Full business plans", "PDF export", "General templates"],
    cta: "Subscribe",
    href: "/create",
  },
  {
    name: "Pro",
    price: 59,
    plans: "10 plans / month",
    features: ["Industry-specific RAG", "PDF + DOCX export", "All templates"],
    cta: "Subscribe",
    href: "/create",
    popular: true,
  },
  {
    name: "Business",
    price: 129,
    plans: "30 plans / month",
    features: ["Priority generation queue", "Longer plans", "Email support"],
    cta: "Subscribe",
    href: "/create",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="mt-6 text-4xl font-bold">Simple subscription pricing</h1>
        <p className="mt-2 text-gray-400">One full plan = one generation. Resets each billing period.</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`glass flex flex-col rounded-xl p-6 ${
                tier.popular ? "border-accent/50 ring-1 ring-accent/30" : ""
              }`}
            >
              {tier.popular && (
                <span className="mb-2 text-xs font-medium uppercase text-accent-glow">Popular</span>
              )}
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="mt-2 text-3xl font-bold">
                {tier.price === 0 ? "Free" : `$${tier.price}`}
                {tier.price > 0 && <span className="text-sm font-normal text-gray-400">/mo</span>}
              </p>
              <p className="mt-1 text-sm text-gray-400">{tier.plans}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-300">
                {tier.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`mt-6 block rounded-lg py-2 text-center text-sm font-medium ${
                  tier.popular
                    ? "bg-accent text-white hover:bg-accent-glow"
                    : "glass hover:border-accent/50"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
