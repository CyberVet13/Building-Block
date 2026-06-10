"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, getCurrentUser, IS_DEV_MODE, type AppUser } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/create",  label: "Create"   },
  { href: "/plans",   label: "My Plans" },
  { href: "/pricing", label: "Pricing"  },
  { href: "/account", label: "Account"  },
];

export function Nav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]           = useState<AppUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/");
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        Build-Block
      </Link>

      <div className="flex items-center gap-5 text-sm text-gray-400">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`transition-colors hover:text-white ${
              pathname === l.href ? "text-white" : ""
            }`}
          >
            {l.label}
          </Link>
        ))}

        {/* Admin link — only show for admin users */}
        {(IS_DEV_MODE || user) && (
          <Link
            href="/admin"
            className={`transition-colors hover:text-white ${
              pathname.startsWith("/admin") ? "text-white" : ""
            }`}
          >
            Admin
          </Link>
        )}

        {/* Auth CTA */}
        {IS_DEV_MODE ? (
          <span className="rounded-full bg-surface-border px-3 py-1 text-xs text-gray-500">
            Dev mode
          </span>
        ) : user ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="text-gray-500 hover:text-white transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        ) : (
          <Link
            href="/signin"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-glow"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
