"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface Job {
  job_id: string;
  email: string;
  status: string;
  stage: string | null;
  is_preview: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  industry: string | null;
}

interface JobDetail extends Job {
  input: Record<string, unknown>;
  tokens_by_stage: Record<string, number>;
  estimated_cost_usd: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400",
  failed:    "text-red-400",
  running:   "text-yellow-400",
  reserved:  "text-gray-400",
};

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const q = filter ? `?status=${filter}` : "";
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/jobs${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(console.error);
  }, [filter]);

  async function loadDetail(jobId: string) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/jobs?job_id=${jobId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setDetail(await res.json());
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <div className="flex gap-2">
          {["", "failed", "completed", "running"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                filter === s ? "bg-accent text-white" : "glass hover:border-accent/50"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass h-12 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job_id} className="border-b border-surface-border hover:bg-surface-raised">
                  <td className={`px-4 py-3 font-medium ${STATUS_COLORS[j.status] ?? ""}`}>
                    {j.status}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{j.email}</td>
                  <td className="px-4 py-3 text-gray-400">{j.industry ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{j.is_preview ? "preview" : "full"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{j.stage ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{j.created_at.slice(0, 16)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => loadDetail(j.job_id)}
                      className="text-xs text-accent-glow hover:underline"
                    >
                      Debug
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-y-0 right-0 w-96 overflow-y-auto border-l border-surface-border bg-surface-raised p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Job detail</h2>
            <button type="button" onClick={() => setDetail(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <dl className="space-y-3 text-sm">
            <Dt label="Status" value={<span className={STATUS_COLORS[detail.status]}>{detail.status}</span>} />
            <Dt label="Stage" value={detail.stage ?? "—"} />
            <Dt label="User" value={detail.email} />
            <Dt label="Est. cost" value={detail.estimated_cost_usd != null ? `$${detail.estimated_cost_usd.toFixed(4)}` : "—"} />
            {detail.error_message && (
              <div className="rounded-lg bg-red-900/20 p-3 text-xs text-red-300">
                {detail.error_message}
              </div>
            )}
          </dl>
          {Object.keys(detail.tokens_by_stage ?? {}).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Tokens by stage</p>
              {Object.entries(detail.tokens_by_stage).map(([stage, tokens]) => (
                <div key={stage} className="flex justify-between text-xs py-1 border-b border-surface-border">
                  <span className="text-gray-400">{stage}</span>
                  <span>{tokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Input</p>
            <pre className="rounded bg-surface p-3 text-xs text-gray-400 overflow-x-auto">
              {JSON.stringify(detail.input, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Dt({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
