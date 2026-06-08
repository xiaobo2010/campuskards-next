import { API_BASE } from "./config";

/** Resolve avatar path from API to a browser-loadable URL. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) {
    return API_BASE ? `${API_BASE}${url}` : url;
  }
  return url;
}
