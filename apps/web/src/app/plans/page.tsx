"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { exportPlan, APIError } from "@/lib/api";

interface PlanMeta {
  plan_id: string;
  title: string;
  is_preview: boolean;
  industry: string;
  created_at: string;
  status: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plans`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPlans(data.plans ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  async function download(planId: string, format: "pdf" | "docx") {
    const token = getToken();
    if (!token) return;
    setExporting(`${planId}-${format}`);
    setExportMsg(null);
    try {
      const { download_url, filename } = await exportPlan(planId, format, token);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      a.click();
    } catch (err) {
      if (err instanceof APIError && err.status === 402) {
        setExportMsg("Upgrade to export plans.");
      } else {
        setExportMsg(String(err));
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Plans</h1>
            <p className="mt-1 text-sm text-gray-400">{total} plans generated</p>
          </div>
          <Link
            href="/create"
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-glow"
          >
            + New plan
          </Link>
        </div>

        {exportMsg && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <span>{exportMsg}</span>
            <Link href="/pricing" className="underline">Upgrade</Link>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass h-20 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <p className="text-gray-400">No plans yet.</p>
            <Link
              href="/create"
              className="mt-4 inline-block rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
            >
              Generate your first plan
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.plan_id} className="glass flex items-center justify-between rounded-xl px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/plans/${plan.plan_id}`} className="truncate font-medium hover:text-accent-glow transition-colors">
                      {plan.title}
                    </Link>
                    {plan.is_preview && (
                      <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent-glow">
                        preview
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 capitalize">
                    {plan.industry} · {new Date(plan.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="ml-4 flex shrink-0 gap-2">
                  {!plan.is_preview && (
                    <>
                      <button
                        type="button"
                        disabled={exporting === `${plan.plan_id}-pdf`}
                        onClick={() => download(plan.plan_id, "pdf")}
                        className="glass rounded-lg px-3 py-1.5 text-xs font-medium hover:border-accent/50 disabled:opacity-50"
                      >
                        {exporting === `${plan.plan_id}-pdf` ? "…" : "PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={exporting === `${plan.plan_id}-docx`}
                        onClick={() => download(plan.plan_id, "docx")}
                        className="glass rounded-lg px-3 py-1.5 text-xs font-medium hover:border-accent/50 disabled:opacity-50"
                      >
                        {exporting === `${plan.plan_id}-docx` ? "…" : "DOCX"}
                      </button>
                    </>
                  )}
                  {plan.is_preview && (
                    <Link
                      href="/pricing"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-glow"
                    >
                      Unlock
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
