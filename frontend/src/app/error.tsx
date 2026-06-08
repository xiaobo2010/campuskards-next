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
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">💀 糟糕</h2>
        <p className="text-zinc-400 max-w-md">
          {error.message || "应用发生了未预期的错误"}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}
