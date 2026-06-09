const panels = [
  { title: "Template manager", desc: "Upload, tag, re-ingest proprietary templates", status: "planned" },
  { title: "Job debugger", desc: "Failed jobs, retrieved chunks, token usage", status: "planned" },
  { title: "Prompt editor", desc: "Versioned prompts per pipeline stage", status: "planned" },
  { title: "Users & billing", desc: "Plans used, tier overrides, Stripe sync", status: "planned" },
  { title: "Cost dashboard", desc: "Bedrock tokens/day, projected monthly burn", status: "planned" },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-2 text-gray-400">Solo-operator controls. Cognito admin role required.</p>

        <div className="mt-10 grid gap-4">
          {panels.map((panel) => (
            <div key={panel.title} className="glass flex items-center justify-between rounded-xl p-6">
              <div>
                <h2 className="font-semibold">{panel.title}</h2>
                <p className="mt-1 text-sm text-gray-400">{panel.desc}</p>
              </div>
              <span className="rounded-full bg-surface-border px-3 py-1 text-xs text-gray-400">
                {panel.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
