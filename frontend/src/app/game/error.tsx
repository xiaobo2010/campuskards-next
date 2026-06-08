"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Game Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">出错了 😅</h2>
        <p className="text-[var(--text-secondary)] max-w-md">
          {error.message || "页面渲染时发生了错误"}
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
