"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">⚠</p>
      <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-gray-400">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-glow"
      >
        Try again
      </button>
    </main>
  );
}
