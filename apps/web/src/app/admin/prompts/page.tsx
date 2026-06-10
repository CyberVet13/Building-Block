"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface StagePrompt {
  stage_id: string;
  display_name: string;
  sort_order: number;
  default_model: string;
  active_prompt: {
    prompt_id: string | null;
    version: number | null;
    template_text: string | null;
  } | null;
  versions: { version: number; is_active: boolean; created_at: string }[];
}

export default function AdminPrompts() {
  const [stages, setStages] = useState<StagePrompt[]>([]);
  const [selected, setSelected] = useState<StagePrompt | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/prompts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setStages(data.stages ?? []);
  }

  function select(stage: StagePrompt) {
    setSelected(stage);
    setDraft(stage.active_prompt?.template_text ?? "");
    setMessage(null);
  }

  async function save() {
    if (!selected) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage_id: selected.stage_id, template_text: draft, activate: true }),
      });
      const data = await res.json();
      setMessage(data.message ?? "Saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Stage list */}
      <div className="w-52 shrink-0">
        <h1 className="mb-4 text-2xl font-bold">Prompts</h1>
        <div className="space-y-1">
          {stages.map((s) => (
            <button
              key={s.stage_id}
              type="button"
              onClick={() => select(s)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                selected?.stage_id === s.stage_id
                  ? "bg-accent/20 text-white"
                  : "text-gray-400 hover:bg-surface-raised hover:text-white"
              }`}
            >
              <span className="block">{s.display_name}</span>
              {s.active_prompt?.version != null && (
                <span className="text-xs text-gray-500">v{s.active_prompt.version}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {!selected ? (
          <p className="mt-12 text-center text-gray-500">Select a stage to edit its prompt</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.display_name}</h2>
                <p className="text-xs text-gray-500">
                  Model: {selected.default_model}
                  {selected.active_prompt?.version != null && ` · Active: v${selected.active_prompt.version}`}
                </p>
              </div>
              <button
                type="button"
                disabled={saving || draft === selected.active_prompt?.template_text}
                onClick={save}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-glow disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save & activate"}
              </button>
            </div>

            {message && (
              <p className="mb-3 rounded-lg bg-green-900/20 px-3 py-2 text-xs text-green-400">{message}</p>
            )}

            <textarea
              className="w-full rounded-xl border border-surface-border bg-surface p-4 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-accent focus:outline-none"
              rows={22}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter prompt template. Use {{business_idea}}, {{industry}}, {{target_market}}, {{retrieved_context}}."
            />

            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Version history</p>
              <div className="flex gap-2 flex-wrap">
                {selected.versions.map((v) => (
                  <span
                    key={v.version}
                    className={`rounded-full px-3 py-1 text-xs ${v.is_active ? "bg-accent/20 text-accent-glow" : "glass text-gray-500"}`}
                  >
                    v{v.version}{v.is_active ? " ✓" : ""}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
