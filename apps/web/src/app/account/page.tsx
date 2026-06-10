"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccount, getPortalUrl, type AccountResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function AccountPage() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getAccount(token)
      .then(setAccount)
      .catch((e) => setError(String(e)));
  }, []);

  async function openPortal() {
    const token = getToken();
    if (!token) return;
    setLoadingPortal(true);
    try {
      const { portal_url } = await getPortalUrl(token);
      window.location.href = portal_url;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Account</h1>

        {error && (
          <p className="mt-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        {!account ? (
          <div className="glass mt-8 animate-pulse rounded-xl p-6">
            <div className="h-4 w-1/3 rounded bg-surface-border" />
            <div className="mt-3 h-4 w-1/2 rounded bg-surface-border" />
          </div>
        ) : (
          <div className="glass mt-8 rounded-xl p-6 space-y-4">
            <Row label="Plan" value={capitalize(account.tier)} />
            <Row label="Status" value={capitalize(account.status)} />
            <Row
              label="Plans this period"
              value={`${account.plans_used} / ${account.plans_limit === 0 ? "—" : account.plans_limit}`}
            />
            {account.plans_limit > 0 && (
              <Row label="Plans remaining" value={String(account.plans_remaining)} />
            )}
            {account.current_period_end && (
              <Row
                label="Renews"
                value={new Date(account.current_period_end).toLocaleDateString()}
              />
            )}

            <div className="pt-4 flex gap-3">
              {account.tier === "free" ? (
                <Link
                  href="/pricing"
                  className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
                >
                  Upgrade
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={loadingPortal}
                  onClick={openPortal}
                  className="glass rounded-lg px-6 py-2 text-sm font-medium hover:border-accent/50 disabled:opacity-50"
                >
                  {loadingPortal ? "Opening portal…" : "Manage billing"}
                </button>
              )}
              <Link href="/create" className="glass rounded-lg px-6 py-2 text-sm font-medium hover:border-accent/50">
                Create plan
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
