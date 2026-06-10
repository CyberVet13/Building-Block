"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, getCurrentUser, setRoleCookie } from "@/lib/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      // Fetch user to set role cookie for middleware admin guard
      const user = await getCurrentUser();
      if (user) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/account`, {
          headers: { Authorization: `Bearer ${(await import("@/lib/auth")).getToken() ?? ""}` },
        }).then((r) => r.json()).catch(() => ({}));
        if (res.role === "admin") setRoleCookie("admin");
      }
      const next = new URLSearchParams(window.location.search).get("next") ?? "/create";
      router.push(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Back</Link>
        <h1 className="mt-4 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-gray-400">
          New?{" "}
          <Link href="/signup" className="text-accent-glow hover:underline">
            Create an account
          </Link>
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-900/20 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white hover:bg-accent-glow disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
