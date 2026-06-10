"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCheckoutSession, APIError } from "@/lib/api";
import { getToken } from "@/lib/auth";

const tiers = [
  {
    id: "free" as const,
    name: "Free",
    price: 0,
    plans: "Preview only",
    features: [
      "Full intake wizard",
      "1 watermarked preview section",
      "No PDF / DOCX export",
    ],
    cta: "Start preview",
    href: "/create",
    popular: false,
  },
  {
    id: "starter" as const,
    name: "Starter",
    price: 24,
    plans: "3 plans / month",
    features: [
      "Full business plans",
      "PDF export",
      "General templates",
    ],
    cta: "Get Starter",
    href: null,
    popular: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 59,
    plans: "10 plans / month",
    features: [
      "Industry-specific RAG",
      "PDF + DOCX export",
      "All templates",
    ],
    cta: "Get Pro",
    href: null,
    popular: true,
  },
  {
    id: "business" as const,
    name: "Business",
    price: 129,
    plans: "30 plans / month",
    features: [
      "Priority generation queue",
      "Longer plans",
      "Email support",
    ],
    cta: "Get Business",
    href: null,
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(tierId: string) {
    const token = getToken();
    if (!token) { router.push("/create"); return; }

    setLoading(tierId);
    setError(null);
    try {
      const { checkout_url } = await createCheckoutSession(tierId, token);
      window.location.href = checkout_url;
    } catch (err) {
      if (err instanceof APIError && err.status === 503) {
        setError("Billing is not yet configured. Check back soon.");
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold">Simple subscription pricing</h1>
        <p className="mt-2 text-gray-400">
          One full plan = one generation. Resets each billing period.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`glass flex flex-col rounded-xl p-6 ${
                tier.popular ? "border-accent/50 ring-1 ring-accent/30" : ""
              }`}
            >
              {tier.popular && (
                <span className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-glow">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="mt-2 text-3xl font-bold">
                {tier.price === 0 ? "Free" : `$${tier.price}`}
                {tier.price > 0 && (
                  <span className="text-sm font-normal text-gray-400">/mo</span>
                )}
              </p>
              <p className="mt-1 text-sm text-gray-400">{tier.plans}</p>

              <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-300">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent-glow">✓</span> {f}
                  </li>
                ))}
              </ul>

              {tier.href ? (
                <Link
                  href={tier.href}
                  className="glass mt-6 block rounded-lg py-2 text-center text-sm font-medium hover:border-accent/50"
                >
                  {tier.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={loading === tier.id}
                  onClick={() => subscribe(tier.id)}
                  className={`mt-6 rounded-lg py-2 text-sm font-medium transition ${
                    tier.popular
                      ? "bg-accent text-white hover:bg-accent-glow disabled:opacity-50"
                      : "glass hover:border-accent/50 disabled:opacity-50"
                  }`}
                >
                  {loading === tier.id ? "Redirecting…" : tier.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Manage or cancel any time via the{" "}
          <Link href="/account" className="text-accent-glow hover:underline">
            billing portal
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
