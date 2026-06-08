"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body style={{ 
        margin: 0, 
        padding: 40, 
        fontFamily: "system-ui, sans-serif",
        background: "#0a0a0f", 
        color: "#ef4444" 
      }}>
        <h2>🚨 全局错误</h2>
        <pre style={{ 
          whiteSpace: "pre-wrap", 
          background: "#1a1a2e", 
          padding: 20, 
          borderRadius: 8,
          fontSize: 13,
          color: "#f87171"
        }}>
          {error.message}
        </pre>
        {error.digest && (
          <p style={{ color: "#666" }}>Digest: {error.digest}</p>
        )}
        {error.stack && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "#a78bfa" }}>
              完整堆栈
            </summary>
            <pre style={{ 
              whiteSpace: "pre-wrap", 
              fontSize: 11, 
              color: "#94a3b8",
              maxHeight: 400,
              overflow: "auto"
            }}>
              {error.stack}
            </pre>
          </details>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 20,
            padding: "10px 24px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          重试
        </button>
      </body>
    </html>
  );
}
