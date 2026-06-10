"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPlan, exportPlan, APIError, type PlanDetail } from "@/lib/api";
import { getToken } from "@/lib/auth";

const SECTION_LABELS: Record<string, string> = {
  preview:               "Executive Summary Preview",
  executive_summary:     "Executive Summary",
  market_analysis:       "Market Analysis",
  competitive_landscape: "Competitive Landscape",
  operations:            "Operations Plan",
  financials:            "Financial Projections",
  consistency:           "Summary",
};

const SECTION_ORDER = [
  "executive_summary",
  "market_analysis",
  "competitive_landscape",
  "operations",
  "financials",
  "consistency",
  "preview",
];

// ── Editable section component ────────────────────────────────────────────────

function EditableSection({
  sectionKey,
  label,
  content,
  isPreview,
  onSave,
}: {
  sectionKey: string;
  label: string;
  content: string;
  isPreview: boolean;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    if (isPreview) return;
    setDraft(content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancel() {
    setDraft(content);
    setEditing(false);
  }

  async function save() {
    if (draft === content) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(sectionKey, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id={sectionKey} className="glass mb-6 scroll-mt-6 rounded-xl p-6 group">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">{label}</h2>
        {!isPreview && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="hidden group-hover:block text-xs text-gray-500 hover:text-accent-glow transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(8, draft.split("\n").length + 2)}
            className="w-full rounded-lg border border-accent/40 bg-surface p-3 font-sans text-sm leading-relaxed text-gray-200 focus:border-accent focus:outline-none resize-none"
          />
          <div className="mt-3 flex gap-3 justify-end">
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-glow disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-300 ${!isPreview ? "cursor-text" : ""}`}
          onClick={startEdit}
          title={isPreview ? undefined : "Click to edit"}
        >
          {content}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan]           = useState<PlanDetail | null>(null);
  const [sections, setSections]   = useState<Record<string, string>>({});
  const [error, setError]         = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg]     = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token || !planId) return;
    getPlan(planId, token)
      .then((p) => {
        setPlan(p);
        setSections(p.content?.sections ?? {});
      })
      .catch((e) => setError(e instanceof APIError ? e.message : String(e)));
  }, [planId]);

  async function handleSave(key: string, value: string) {
    const token = getToken();
    if (!token || !planId) return;

    const updated = { ...sections, [key]: value };
    setSections(updated);
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(null), 2000);

    // Persist to API (best-effort — demo mode stores in memory on server)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plans/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sections: updated }),
      });
    } catch {
      // Non-fatal in demo mode
    }
  }

  async function download(format: "pdf" | "docx") {
    const token = getToken();
    if (!token || !planId) return;
    setExporting(format);
    setExportError(null);
    try {
      const { download_url, filename } = await exportPlan(planId, format, token);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      a.click();
    } catch (err) {
      setExportError(
        err instanceof APIError && err.status === 402
          ? "Upgrade to export."
          : String(err),
      );
    } finally {
      setExporting(null);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <div className="glass max-w-sm rounded-xl p-8 text-center">
          <p className="text-red-400">{error}</p>
          <Link href="/plans" className="mt-4 block text-sm text-accent-glow hover:underline">
            ← Back to plans
          </Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-surface-border border-t-accent" />
      </div>
    );
  }

  const orderedKeys = [
    ...SECTION_ORDER.filter((k) => k in sections),
    ...Object.keys(sections).filter((k) => !SECTION_ORDER.includes(k)),
  ];

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      <div className="mx-auto max-w-3xl">

        {/* Breadcrumb */}
        <div className="mb-2 flex items-center gap-3 text-sm text-gray-500">
          <Link href="/plans" className="hover:text-gray-300">My Plans</Link>
          <span>/</span>
          <span className="text-gray-300 truncate max-w-xs">{plan.title}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{plan.title}</h1>
            <p className="mt-1 text-xs text-gray-500 capitalize">
              {plan.industry} · {new Date(plan.created_at).toLocaleDateString()}
              {plan.is_preview && (
                <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-accent-glow">preview</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {saveMsg && (
              <span className="text-xs text-green-400">{saveMsg}</span>
            )}
            {exportError && (
              <span className="text-xs text-red-400">
                {exportError}{" "}
                <Link href="/pricing" className="underline">Upgrade</Link>
              </span>
            )}
            {!plan.is_preview && (
              <>
                <button
                  type="button"
                  disabled={exporting === "pdf"}
                  onClick={() => download("pdf")}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-glow disabled:opacity-50"
                >
                  {exporting === "pdf" ? "…" : "PDF"}
                </button>
                <button
                  type="button"
                  disabled={exporting === "docx"}
                  onClick={() => download("docx")}
                  className="glass rounded-lg px-4 py-1.5 text-sm font-medium hover:border-accent/50 disabled:opacity-50"
                >
                  {exporting === "docx" ? "…" : "DOCX"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section nav */}
        {orderedKeys.length > 1 && (
          <nav className="glass mb-6 flex flex-wrap gap-2 rounded-xl px-4 py-3">
            {orderedKeys.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="text-xs text-gray-400 hover:text-white capitalize transition-colors"
              >
                {SECTION_LABELS[key] ?? key.replace(/_/g, " ")}
              </a>
            ))}
            {!plan.is_preview && (
              <span className="ml-auto text-xs text-gray-600">Click any section to edit</span>
            )}
          </nav>
        )}

        {/* Sections */}
        {orderedKeys.map((key) => (
          <EditableSection
            key={key}
            sectionKey={key}
            label={SECTION_LABELS[key] ?? key.replace(/_/g, " ")}
            content={sections[key] as string}
            isPreview={plan.is_preview}
            onSave={handleSave}
          />
        ))}

        {plan.is_preview && (
          <div className="glass rounded-xl border-accent/40 p-6 text-center">
            <p className="mb-4 text-gray-300">
              This is a preview. Subscribe to generate and edit the full plan.
            </p>
            <Link
              href="/pricing"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-white hover:bg-accent-glow"
            >
              Unlock full plan
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
