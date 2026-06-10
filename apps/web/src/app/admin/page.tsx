"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface Stats {
  subscriptions_by_tier: Record<string, number>;
  plans_30d: number;
  previews_30d: number;
  estimated_cost_usd_30d: number;
  failed_jobs_7d: number;
  new_users_30d: number;
  plans_per_day_14d: { day: string; count: number }[];
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;

  const tiers = stats?.subscriptions_by_tier ?? {};
  const mrr = ((tiers.starter ?? 0) * 24 + (tiers.pro ?? 0) * 59 + (tiers.business ?? 0) * 129);

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>

      {!stats ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="MRR (est.)" value={`$${mrr.toLocaleString()}`} sub="from active subs" />
            <Kpi label="Plans (30d)" value={stats.plans_30d} sub="full generations" />
            <Kpi label="Previews (30d)" value={stats.previews_30d} sub="free tier" />
            <Kpi label="LLM cost (30d)" value={`$${stats.estimated_cost_usd_30d.toFixed(2)}`} sub="estimated" />
            <Kpi label="Failed jobs (7d)" value={stats.failed_jobs_7d} sub={stats.failed_jobs_7d > 0 ? "⚠ check jobs tab" : "all clear"} warn={stats.failed_jobs_7d > 0} />
            <Kpi label="New users (30d)" value={stats.new_users_30d} sub="signups" />
          </div>

          {/* Subscriptions by tier */}
          <div className="glass mt-8 rounded-xl p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Active subscriptions</h2>
            <div className="flex gap-8">
              {["free", "starter", "pro", "business"].map((t) => (
                <div key={t} className="text-center">
                  <p className="text-2xl font-bold">{tiers[t] ?? 0}</p>
                  <p className="mt-1 text-xs capitalize text-gray-500">{t}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sparkline */}
          <div className="glass mt-6 rounded-xl p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Plans / day (14d)</h2>
            <div className="relative flex items-end gap-1" style={{ height: 64 }}>
              {(() => {
                const max = Math.max(...stats.plans_per_day_14d.map((x) => x.count), 1);
                return stats.plans_per_day_14d.map((d) => {
                  const barH = Math.max(Math.round((d.count / max) * 56), 3);
                  return (
                    <div key={d.day} className="group relative flex-1 flex flex-col justify-end" style={{ height: 64 }}>
                      <div
                        className="w-full rounded-t bg-accent/60 hover:bg-accent transition-colors cursor-default"
                        style={{ height: barH }}
                        title={`${d.day.slice(5)}: ${d.count}`}
                      />
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>{stats.plans_per_day_14d[0]?.day.slice(5)}</span>
              <span>{stats.plans_per_day_14d[stats.plans_per_day_14d.length - 1]?.day.slice(5)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string | number; sub: string; warn?: boolean }) {
  return (
    <div className={`glass rounded-xl p-5 ${warn ? "border-yellow-500/40" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${warn ? "text-yellow-400" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}
