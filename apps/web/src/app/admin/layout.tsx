import Link from "next/link";

const NAV = [
  { href: "/admin",         label: "Overview" },
  { href: "/admin/jobs",    label: "Jobs" },
  { href: "/admin/prompts", label: "Prompts" },
  { href: "/admin/corpus",  label: "Corpus" },
  { href: "/admin/users",   label: "Users" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-surface-border px-4 py-8">
        <p className="mb-6 text-xs uppercase tracking-widest text-gray-500">Admin</p>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-surface-raised hover:text-white transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400">← App</Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}
