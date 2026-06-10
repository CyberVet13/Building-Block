"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface CorpusDoc {
  doc_id: string;
  s3_key: string;
  doc_type: string;
  section: string;
  industry: string;
  tier_gate: string;
  version: string;
  is_active: boolean;
  chunk_count: number;
  ingested_at: string | null;
}

interface CorpusData {
  documents: CorpusDoc[];
  total_documents: number;
  total_chunks: number;
  active_documents: number;
}

export default function AdminCorpus() {
  const [data, setData] = useState<CorpusData | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/corpus`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setData(await res.json());
  }

  async function toggle(docId: string, isActive: boolean) {
    const token = getToken();
    if (!token) return;
    const action = isActive ? "deactivate" : "activate";
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/corpus/${docId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function reingest(docIds: string[]) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/corpus/reingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ doc_ids: docIds }),
    });
    const d = await res.json();
    setMessage(d.message ?? "Queued");
  }

  if (!data) return <div className="glass h-64 animate-pulse rounded-xl" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corpus</h1>
          <p className="text-sm text-gray-400">
            {data.active_documents} active docs · {data.total_chunks.toLocaleString()} chunks
          </p>
        </div>
        <button
          type="button"
          onClick={() => reingest(data.documents.filter((d) => d.is_active).map((d) => d.doc_id))}
          className="glass rounded-lg px-4 py-2 text-sm hover:border-accent/50"
        >
          Re-ingest all active
        </button>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-green-900/20 px-3 py-2 text-xs text-green-400">{message}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Ver</th>
              <th className="px-4 py-3">Chunks</th>
              <th className="px-4 py-3">Ingested</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr key={doc.doc_id} className={`border-b border-surface-border ${!doc.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium">{doc.section}</td>
                <td className="px-4 py-3 text-gray-400">{doc.industry}</td>
                <td className="px-4 py-3 text-gray-400">{doc.doc_type}</td>
                <td className="px-4 py-3 text-gray-400">{doc.tier_gate}</td>
                <td className="px-4 py-3 text-gray-500">{doc.version}</td>
                <td className="px-4 py-3 text-gray-400">{doc.chunk_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {doc.ingested_at ? doc.ingested_at.slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${doc.is_active ? "text-green-400" : "text-gray-500"}`}>
                    {doc.is_active ? "✓" : "✗"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(doc.doc_id, doc.is_active)}
                    className="text-xs text-accent-glow hover:underline"
                  >
                    {doc.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => reingest([doc.doc_id])}
                    className="text-xs text-gray-400 hover:text-white hover:underline"
                  >
                    Re-ingest
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
