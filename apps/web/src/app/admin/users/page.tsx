"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface AdminUser {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  tier: string;
  sub_status: string;
  period_end: string | null;
  total_plans: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { load(""); }, []);

  async function load(q: string) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  async function action(userId: string, act: string, body?: object) {
    const token = getToken();
    if (!token) return;
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${userId}/${act}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body ?? {}),
      },
    );
    const d = await res.json();
    setMessage(d.message ?? act);
    await load(search);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <input
          className="glass flex-1 max-w-xs rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
        <button
          type="button"
          onClick={() => load(search)}
          className="glass rounded-lg px-4 py-2 text-sm hover:border-accent/50"
        >
          Search
        </button>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-green-900/20 px-3 py-2 text-xs text-green-400">{message}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plans</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-surface-border">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-surface-border" />
                    </td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr key={u.user_id} className="border-b border-surface-border hover:bg-surface-raised">
                    <td className="px-4 py-3">
                      <span className="font-medium">{u.email}</span>
                      {u.role === "admin" && (
                        <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent-glow">admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-300">{u.tier}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${u.sub_status === "active" ? "text-green-400" : "text-gray-500"}`}>
                        {u.sub_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{u.total_plans}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{u.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        <select
                          className="glass rounded px-2 py-1 text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              action(u.user_id, "grant", { tier: e.target.value });
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="" disabled>Grant tier…</option>
                          {["starter", "pro", "business"].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => { if (confirm(`Suspend ${u.email}?`)) action(u.user_id, "suspend"); }}
                          className="text-red-400 hover:underline"
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
