"use client";

import { useState } from "react";
import Link from "next/link";

const STEPS = [
  { id: "idea", title: "Your idea", description: "What are you building?" },
  { id: "market", title: "Market", description: "Who is it for?" },
  { id: "model", title: "Model", description: "How will you make money?" },
  { id: "review", title: "Review", description: "Confirm and generate" },
];

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    business_idea: "",
    industry: "",
    target_market: "",
    revenue_model: "",
  });

  const isLast = step === STEPS.length - 1;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold">Create your business plan</h1>
        <p className="mt-2 text-gray-400">
          Free: preview one section. Subscribe for the full plan.
        </p>

        {/* Progress */}
        <div className="mt-10 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-surface-border"
              }`}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-accent-glow">
          Step {step + 1} of {STEPS.length}: {STEPS[step].title}
        </p>

        <div className="glass mt-8 rounded-xl p-8">
          {step === 0 && (
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface p-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              rows={6}
              placeholder="Describe your business idea in a few sentences..."
              value={form.business_idea}
              onChange={(e) => setForm({ ...form, business_idea: e.target.value })}
            />
          )}
          {step === 1 && (
            <div className="space-y-4">
              <input
                className="w-full rounded-lg border border-surface-border bg-surface p-4 focus:border-accent focus:outline-none"
                placeholder="Industry (e.g. SaaS, retail, healthcare)"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
              <input
                className="w-full rounded-lg border border-surface-border bg-surface p-4 focus:border-accent focus:outline-none"
                placeholder="Target market"
                value={form.target_market}
                onChange={(e) => setForm({ ...form, target_market: e.target.value })}
              />
            </div>
          )}
          {step === 2 && (
            <input
              className="w-full rounded-lg border border-surface-border bg-surface p-4 focus:border-accent focus:outline-none"
              placeholder="Revenue model (e.g. subscription, marketplace, services)"
              value={form.revenue_model}
              onChange={(e) => setForm({ ...form, revenue_model: e.target.value })}
            />
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm text-gray-300">
              <p>
                <span className="text-gray-500">Idea:</span> {form.business_idea || "—"}
              </p>
              <p>
                <span className="text-gray-500">Industry:</span> {form.industry || "—"}
              </p>
              <p>
                <span className="text-gray-500">Market:</span> {form.target_market || "—"}
              </p>
              <p>
                <span className="text-gray-500">Revenue:</span> {form.revenue_model || "—"}
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              className="text-gray-400 hover:text-white disabled:opacity-30"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
            {isLast ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  className="glass rounded-lg px-6 py-2 text-sm font-medium hover:border-accent/50"
                  onClick={() => alert("Preview API not wired yet — is_preview: true")}
                >
                  Generate preview
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
                  onClick={() => alert("Subscribe to generate full plan")}
                >
                  Generate full plan
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
