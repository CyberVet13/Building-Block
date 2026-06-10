"use client";

import { useState } from "react";
import Link from "next/link";
import { startGeneration, waitForJob, exportPlan, APIError, type JobResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";

const STEPS = [
  { id: "idea",   title: "Your idea",   placeholder: "Describe your business idea in a few sentences…", field: "business_idea" as const },
  { id: "market", title: "Market",      placeholder: "Who is your target customer?",                    field: "target_market" as const },
  { id: "model",  title: "Revenue",     placeholder: "How will you make money? (e.g. subscription, marketplace)", field: "revenue_model" as const },
  { id: "review", title: "Review",      placeholder: "",                                                field: null },
];

type FormData = {
  business_idea: string;
  industry: string;
  target_market: string;
  revenue_model: string;
};

type GenState =
  | { phase: "idle" }
  | { phase: "generating"; stage: string | null }
  | { phase: "done"; job: JobResponse }
  | { phase: "error"; message: string; isPaywall: boolean };

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    business_idea: "",
    industry: "",
    target_market: "",
    revenue_model: "",
  });
  const [gen, setGen] = useState<GenState>({ phase: "idle" });
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const isLast = step === STEPS.length - 1;

  async function generate(isPreview: boolean) {
    const token = getToken();
    if (!token) {
      setGen({ phase: "error", message: "Not signed in", isPaywall: false });
      return;
    }
    setGen({ phase: "generating", stage: "Starting…" });
    try {
      const res = await startGeneration(
        {
          business_idea: form.business_idea,
          industry: form.industry || "general",
          target_market: form.target_market,
          revenue_model: form.revenue_model || undefined,
          is_preview: isPreview,
        },
        token,
      );

      const final = await waitForJob(
        res.job_id,
        token,
        (job) => setGen({ phase: "generating", stage: job.stage ?? "Processing…" }),
      );

      if (final.status === "failed") {
        setGen({ phase: "error", message: "Generation failed — please try again.", isPaywall: false });
      } else {
        setGen({ phase: "done", job: final });
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 402) {
        setGen({ phase: "error", message: "Plan limit reached for this billing period.", isPaywall: true });
      } else {
        setGen({ phase: "error", message: String(err), isPaywall: false });
      }
    }
  }

  async function download(planId: string, format: "pdf" | "docx") {
    const token = getToken();
    if (!token) return;
    setExporting(format);
    setExportError(null);
    try {
      const { download_url, filename } = await exportPlan(planId, format, token);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      a.click();
    } catch (err) {
      if (err instanceof APIError && err.status === 402) {
        setExportError("Upgrade your plan to export.");
      } else {
        setExportError(String(err));
      }
    } finally {
      setExporting(null);
    }
  }

  // ── Result view ─────────────────────────────────────────────────────────
  if (gen.phase === "done") {
    const plan = gen.job.plan;
    const sections = plan?.content?.sections ?? {};
    const planId = plan?.plan_id ?? "";

    return (
      <main className="min-h-screen bg-surface px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">{plan?.title ?? "Your Business Plan"}</h1>
            {plan?.is_preview && (
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs text-accent-glow">
                Preview
              </span>
            )}
          </div>

          {/* Export bar */}
          {!plan?.is_preview && planId && (
            <div className="glass mb-6 flex items-center gap-3 rounded-xl px-5 py-3">
              <span className="text-sm text-gray-400">Export:</span>
              <button
                type="button"
                disabled={exporting === "pdf"}
                onClick={() => download(planId, "pdf")}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-glow disabled:opacity-50"
              >
                {exporting === "pdf" ? "Generating…" : "PDF"}
              </button>
              <button
                type="button"
                disabled={exporting === "docx"}
                onClick={() => download(planId, "docx")}
                className="glass rounded-lg px-4 py-1.5 text-sm font-medium hover:border-accent/50 disabled:opacity-50"
              >
                {exporting === "docx" ? "Generating…" : "DOCX"}
              </button>
              {exportError && (
                <span className="text-xs text-red-400">
                  {exportError}{" "}
                  <Link href="/pricing" className="underline">Upgrade</Link>
                </span>
              )}
            </div>
          )}

          {Object.entries(sections).map(([key, text]) => (
            <div key={key} className="glass mb-6 rounded-xl p-6">
              <h2 className="mb-3 text-lg font-semibold capitalize">{key.replace(/_/g, " ")}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{text as string}</p>
            </div>
          ))}

          {plan?.is_preview && (
            <div className="glass rounded-xl border-accent/40 p-6 text-center">
              <p className="mb-4 text-gray-300">
                This is a preview of your executive summary. Subscribe to generate the full plan
                with all sections, financial projections, and PDF export.
              </p>
              <Link
                href="/pricing"
                className="rounded-lg bg-accent px-8 py-3 font-medium text-white hover:bg-accent-glow"
              >
                Unlock full plan
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setGen({ phase: "idle" }); setStep(0); }}
            className="mt-6 text-sm text-gray-400 hover:text-white"
          >
            ← Start a new plan
          </button>
        </div>
      </main>
    );
  }

  // ── Generating view ──────────────────────────────────────────────────────
  if (gen.phase === "generating") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <div className="glass rounded-xl p-10 text-center">
          <div className="mb-4 flex justify-center">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-surface-border border-t-accent" />
          </div>
          <p className="text-lg font-medium">Building your plan…</p>
          <p className="mt-2 text-sm text-gray-400 capitalize">{gen.stage ?? "Starting"}</p>
        </div>
      </main>
    );
  }

  // ── Error / paywall view ─────────────────────────────────────────────────
  if (gen.phase === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="glass max-w-md rounded-xl p-8 text-center">
          <p className="mb-2 text-lg font-semibold">{gen.isPaywall ? "Plan limit reached" : "Something went wrong"}</p>
          <p className="mb-6 text-sm text-gray-400">{gen.message}</p>
          {gen.isPaywall ? (
            <Link href="/pricing" className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow">
              Upgrade plan
            </Link>
          ) : (
            <button type="button" onClick={() => setGen({ phase: "idle" })} className="text-sm text-accent-glow hover:underline">
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  const currentStep = STEPS[step];

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Back</Link>
        <h1 className="mt-6 text-3xl font-bold">Create your business plan</h1>
        <p className="mt-2 text-sm text-gray-400">
          Free: preview one section. Subscribe for the full plan.
        </p>

        {/* Progress bar */}
        <div className="mt-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-surface-border"}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-accent-glow">
          Step {step + 1} of {STEPS.length} — {currentStep.title}
        </p>

        <div className="glass mt-6 rounded-xl p-8">
          {step === 0 && (
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface p-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              rows={6}
              placeholder={currentStep.placeholder}
              value={form.business_idea}
              onChange={(e) => setForm({ ...form, business_idea: e.target.value })}
            />
          )}
          {step === 1 && (
            <div className="space-y-4">
              <input
                className="w-full rounded-lg border border-surface-border bg-surface p-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                placeholder="Industry (e.g. SaaS, retail, healthcare)"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
              <input
                className="w-full rounded-lg border border-surface-border bg-surface p-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                placeholder={currentStep.placeholder}
                value={form.target_market}
                onChange={(e) => setForm({ ...form, target_market: e.target.value })}
              />
            </div>
          )}
          {step === 2 && (
            <input
              className="w-full rounded-lg border border-surface-border bg-surface p-4 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              placeholder={currentStep.placeholder}
              value={form.revenue_model}
              onChange={(e) => setForm({ ...form, revenue_model: e.target.value })}
            />
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm text-gray-300">
              <ReviewRow label="Idea"     value={form.business_idea} />
              <ReviewRow label="Industry" value={form.industry} />
              <ReviewRow label="Market"   value={form.target_market} />
              <ReviewRow label="Revenue"  value={form.revenue_model} />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-gray-400 hover:text-white disabled:opacity-30"
            >
              Back
            </button>

            {isLast ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => generate(true)}
                  className="glass rounded-lg px-5 py-2 text-sm font-medium hover:border-accent/50"
                >
                  Preview (free)
                </button>
                <button
                  type="button"
                  onClick={() => generate(false)}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-glow"
                >
                  Generate full plan
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      {value || <span className="italic text-gray-600">not set</span>}
    </p>
  );
}
