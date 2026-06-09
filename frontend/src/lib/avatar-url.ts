import { API_BASE } from "./config";

/** Backend origin for static assets (/uploads). Falls back to API_BASE. */
function assetBase(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ASSET_URL ||
    API_BASE;
  return (fromEnv || "").replace(/\/$/, "");
}

/** Resolve avatar path from API to a browser-loadable URL. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const pathOnly = url.split("?")[0];
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";

  if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
    return url;
  }

  if (pathOnly.startsWith("/")) {
    const base = assetBase();
    // Cross-origin deploy: always prefix API host for /uploads
    if (base) {
      return `${base}${pathOnly}${query}`;
    }
    // Same-origin: Next.js rewrites /uploads → backend
    return `${pathOnly}${query}`;
  }

  return url;
}

/** Append cache-buster so browser reloads after avatar upload. */
export function withAvatarCacheBust(
  url: string | null | undefined,
  version?: number | string,
): string | null {
  const resolved = resolveAvatarUrl(url);
  if (!resolved) return null;
  const base = resolved.split("?")[0];
  const v = version ?? Date.now();
  return `${base}?v=${v}`;
}
