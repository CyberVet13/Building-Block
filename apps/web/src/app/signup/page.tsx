"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { signUp, confirmSignUp } from "aws-amplify/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<"signup" | "confirm">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setStep("confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      await signIn(email, password);
      router.push("/create");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Back</Link>
        <h1 className="mt-4 text-2xl font-bold">
          {step === "signup" ? "Create account" : "Verify email"}
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          {step === "signup" ? (
            <>
              Have an account?{" "}
              <Link href="/signin" className="text-accent-glow hover:underline">Sign in</Link>
            </>
          ) : (
            `We sent a code to ${email}`
          )}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-900/20 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {step === "signup" ? (
          <form onSubmit={handleSignUp} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Password (10+ characters)</label>
              <input
                type="password"
                required
                minLength={10}
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Verification code</label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-center text-2xl tracking-widest focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white hover:bg-accent-glow disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify and sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
