import { API_BASE } from "./config";

/** Resolve avatar path from API to a browser-loadable URL. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Strip cache-buster query before resolving base path
  const pathOnly = url.split("?")[0];

  if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
    return url;
  }

  if (pathOnly.startsWith("/")) {
    // Same-origin: Next.js rewrites /uploads → backend when API_BASE is empty
    // Cross-origin: prefix with API host from NEXT_PUBLIC_API_URL
    const base = API_BASE.replace(/\/$/, "");
    return base ? `${base}${pathOnly}` : pathOnly;
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
