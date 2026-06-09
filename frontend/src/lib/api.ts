import { API_BASE } from "./config";
import type {
  User,
  Card,
  Deck,
  DeckListItem,
  DeckCreateRequest,
  Announcement,
  AnnouncementCreateIn,
  AnnouncementUpdateIn,
  TokenResponse,
  LoginRequest,
  RegisterRequest,
  SetCookieRequest,
  PaginatedResponse,
  AdminUser,
  AdminStats,
  ResetKeyResponse,
  CardUpdateIn,
  UserCardOwnership,
  UpgradeResult,
  MatchQueueResponse,
  PveMatchResponse,
  MatchQueueStatus,
  MatchMode,
  MatchStats,
  MatchHistoryItem,
  MatchDetail,
  PackDefinition,
  PackOpenCard,
  PackOpenResult,
} from "@/types";

export type { PackDefinition, PackOpenCard, PackOpenResult };

// ---------- Error ----------
import { ApiError } from "./api-error";
export { ApiError } from "./api-error";

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  return "请求失败";
}

// ---------- Token helpers ----------

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function getToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ---------- Core fetch ----------

/** Singleton refresh lock – concurrent 401s share one refresh call */
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Backend accepts refresh via httpOnly cookie (credentials: include)
      // or via body refresh_token fallback.
      const rt = getToken(REFRESH_KEY);
      const body: Record<string, string> = {};
      if (rt) body.refresh_token = rt;

      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json().catch(() => null);
        if (data?.access_token) {
          setTokens(data.access_token, data.refresh_token || rt || "");
          return true;
        }
        // Cookie-only refresh: backend may set new access_token in cookie
        // and return it in response
        if (data?.token) {
          setTokens(data.token, rt || "");
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  const at = getToken(ACCESS_KEY);
  if (at) {
    headers["Authorization"] = `Bearer ${at}`;
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  // ---- 401: attempt token refresh (skip for auth endpoints to avoid loops) ----
  if (res.status === 401 && !headers["X-Retry"] && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request with refreshed token
      const newAt = getToken(ACCESS_KEY);
      if (newAt) {
        headers["Authorization"] = `Bearer ${newAt}`;
      }
      headers["X-Retry"] = "1";
      return apiFetch<T>(path, { ...options, headers });
    }
    // Refresh failed – clear tokens (middleware handles redirect)
    clearTokens();
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ? formatApiDetail(body.detail) : body.message || message;
      throw new ApiError(res.status, message, body);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, message);
    }
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const text = await res.text();
    if (!text.trim()) return undefined as T;
    return JSON.parse(text) as T;
  }
  return undefined as T;
}

/** Normalize paginated API payloads (handles legacy bare-array responses). */
function normalizePaginated<T>(
  raw: PaginatedResponse<T> | T[] | null | undefined,
): PaginatedResponse<T> {
  if (!raw) {
    return { items: [], total: 0, page: 1, page_size: 0 };
  }
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length, page: 1, page_size: raw.length };
  }
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    items,
    total: typeof raw.total === "number" ? raw.total : items.length,
    page: raw.page ?? 1,
    page_size: raw.page_size ?? items.length,
  };
}

// ---------- Auth API ----------

export const authApi = {
  login(login: string, password: string, remember = false): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password, remember }),
    });
  },

  register(username: string, email: string, password: string, remember = true): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password, remember }),
    });
  },

  me(): Promise<User> {
    return apiFetch<User>("/api/auth/me");
  },

  updateMe(data: {
    email?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<User> {
    return apiFetch<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  resetPassword(params: { username: string; new_password: string; reset_key: string }): Promise<void> {
    return apiFetch<void>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async logout(): Promise<void> {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore - cookies cleared server-side anyway
    }
    clearTokens();
  },

  setCookie(tokens: SetCookieRequest): Promise<void> {
    return apiFetch<void>("/api/auth/set-cookie", {
      method: "POST",
      body: JSON.stringify(tokens),
    });
  },
};

// ---------- Cards API ----------

export const cardsApi = {
  async list(params?: {
    page?: number;
    page_size?: number;
    faction_code?: string;
    /** When true, fetches all pages (use sparingly — prefer single-page queries). */
    fetchAll?: boolean;
  }): Promise<PaginatedResponse<Card>> {
    const { fetchAll = false, ...rest } = params ?? {};
    const pageSize = rest.page_size ?? 100;
    const merged = { page_size: pageSize, ...rest };
    const query =
      "?" +
      new URLSearchParams(
        Object.entries(merged)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();

    const first = normalizePaginated(
      await apiFetch<PaginatedResponse<Card> | Card[]>(`/api/cards${query}`),
    );
    if (!fetchAll) return first;
    if (first.items.length >= first.total) return first;

    const allItems = [...first.items];
    const totalPages = Math.ceil(first.total / pageSize);
    for (let p = 2; p <= totalPages; p++) {
      const pageQuery =
        "?" +
        new URLSearchParams(
          Object.entries({ ...merged, page: p })
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString();
      const page = normalizePaginated(
        await apiFetch<PaginatedResponse<Card> | Card[]>(`/api/cards${pageQuery}`),
      );
      if (page.items.length > 0) {
        allItems.push(...page.items);
      } else {
        break;
      }
    }

    return { ...first, items: allItems, page: 1, page_size: allItems.length };
  },

  get(cardId: string): Promise<Card> {
    return apiFetch<Card>(`/api/cards/${cardId}`);
  },

  owned(): Promise<UserCardOwnership[]> {
    return apiFetch<UserCardOwnership[]>("/api/collection");
  },

  upgrade(cardId: string): Promise<UpgradeResult> {
    return apiFetch<UpgradeResult>(`/api/collection/${cardId}/upgrade`, {
      method: "POST",
    });
  },
};

// ---------- User API ----------

export const userApi = {
  getProfile(): Promise<User> {
    return apiFetch<User>("/api/user/profile");
  },

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const formData = new FormData();
    formData.append("avatar", file);
    const res = await fetch(`${API_BASE}/api/user/avatar`, {
      method: "PUT",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      let detail = "上传失败";
      try {
        const errData = await res.json();
        detail = errData?.detail || detail;
      } catch {
        // ignore parse error
      }
      throw new ApiError(res.status, detail, null);
    }
    return (await res.json()) as { avatar_url: string };
  },
};

// ---------- Decks API ----------

export const decksApi = {
  list(): Promise<DeckListItem[]> {
    return apiFetch<DeckListItem[]>("/api/decks");
  },

  get(deckId: string): Promise<Deck> {
    return apiFetch<Deck>(`/api/decks/${deckId}`);
  },

  create(data: DeckCreateRequest): Promise<Deck> {
    return apiFetch<Deck>("/api/decks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(deckId: string, data: Partial<DeckCreateRequest>): Promise<Deck> {
    return apiFetch<Deck>(`/api/decks/${deckId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  validate(deckId: string): Promise<{ valid: boolean; errors: string[] }> {
    return apiFetch<{ valid: boolean; errors: string[] }>(`/api/decks/${deckId}/validate`);
  },

  delete(deckId: string): Promise<void> {
    return apiFetch<void>(`/api/decks/${deckId}`, { method: "DELETE" });
  },
};

// ---------- Announcements API ----------

/** Public read-only announcements (writes go through adminApi). */
export const announcementsApi = {
  list(params?: {
    page?: number;
    page_size?: number;
    category?: string;
  }): Promise<PaginatedResponse<Announcement>> {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return apiFetch<PaginatedResponse<Announcement>>(`/api/announcements${query}`);
  },

  get(id: string): Promise<Announcement> {
    return apiFetch<Announcement>(`/api/announcements/${id}`);
  },
};

// ---------- Admin API ----------

export const adminApi = {
  // Stats
  stats(): Promise<AdminStats> {
    return apiFetch<AdminStats>("/api/admin/stats");
  },

  // Users
  listUsers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<PaginatedResponse<AdminUser>> {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return apiFetch<PaginatedResponse<AdminUser>>(`/api/admin/users${query}`);
  },

  updateUser(
    userId: string,
    data: Partial<Pick<AdminUser, "role" | "is_active"> & { ink?: number; elo?: number }>,
  ): Promise<AdminUser> {
    return apiFetch<AdminUser>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  setUserResetKey(userId: string, resetKey: string): Promise<ResetKeyResponse> {
    return apiFetch<ResetKeyResponse>(`/api/admin/users/${userId}/reset-key`, {
      method: "POST",
      body: JSON.stringify({ reset_key: resetKey }),
    });
  },

  // Cards (admin)
  listCards(params?: {
    page?: number;
    page_size?: number;
    faction_code?: string;
    card_type?: string;
    rarity?: string;
  }): Promise<PaginatedResponse<Card>> {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return apiFetch<PaginatedResponse<Card>>(`/api/admin/cards${query}`);
  },

  updateCard(cardId: string, data: CardUpdateIn): Promise<Card> {
    return apiFetch<Card>(`/api/admin/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Announcements (admin)
  listAnnouncements(params?: {
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Announcement>> {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return apiFetch<PaginatedResponse<Announcement>>(`/api/admin/announcements${query}`);
  },

  createAnnouncement(data: AnnouncementCreateIn): Promise<Announcement> {
    return apiFetch<Announcement>("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAnnouncement(id: string, data: AnnouncementUpdateIn): Promise<Announcement> {
    return apiFetch<Announcement>(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAnnouncement(id: string): Promise<void> {
    return apiFetch<void>(`/api/admin/announcements/${id}`, { method: "DELETE" });
  },

  togglePinAnnouncement(id: string, is_pinned: boolean): Promise<Announcement> {
    return apiFetch<Announcement>(`/api/admin/announcements/${id}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ is_pinned }),
    });
  },
};

// ---------- Collection API ----------

export const collectionApi = {
  list(): Promise<UserCardOwnership[]> {
    return apiFetch<UserCardOwnership[]>("/api/collection");
  },
};

// ---------- Shop API ----------

export const shopApi = {
  listPacks(): Promise<PackDefinition[]> {
    return apiFetch<PackDefinition[]>("/api/shop/packs");
  },

  getBalance(): Promise<{ ink: number }> {
    return apiFetch<{ ink: number }>("/api/auth/me").then((me) => ({
      ink: me.ink ?? 0,
    }));
  },

  openPack(
    packId: string,
    options?: { faction_code?: string; quantity?: number },
  ): Promise<PackOpenResult> {
    return apiFetch<PackOpenResult>(`/api/shop/packs/${packId}/open`, {
      method: "POST",
      body: JSON.stringify({
        quantity: options?.quantity ?? 1,
        faction_code: options?.faction_code,
      }),
    });
  },

  selectorFinalize(rerollToken: string): Promise<PackOpenResult> {
    return apiFetch<PackOpenResult>("/api/shop/packs/selector/finalize", {
      method: "POST",
      body: JSON.stringify({ reroll_token: rerollToken }),
    });
  },

  selectorReroll(rerollToken: string, slotIndex: number): Promise<PackOpenResult> {
    return apiFetch<PackOpenResult>("/api/shop/packs/selector/reroll", {
      method: "POST",
      body: JSON.stringify({ reroll_token: rerollToken, slot_index: slotIndex }),
    });
  },
};

// ---------- Checkin API ----------

export interface CheckinStatus {
  checked_in_today: boolean;
  streak: number;
  total_checkins: number;
  next_reward: { day: number; ink: number; fragments?: number };
}

export interface CheckinResult {
  streak: number;
  reward: { ink: number; fragments?: number };
  total_checkins: number;
}

export const checkinApi = {
  status(): Promise<CheckinStatus> {
    return apiFetch<CheckinStatus>("/api/checkin/status");
  },

  checkin(): Promise<CheckinResult> {
    return apiFetch<CheckinResult>("/api/checkin", { method: "POST" });
  },
};

// ---------- Generic API (convenience wrapper) ----------

export const api = {
  get<T>(path: string): Promise<T> {
    return apiFetch<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: "DELETE" });
  },
};

// ---------- Match API ----------

export const matchApi = {
  joinQueue(deckId: string, mode: MatchMode = "quick"): Promise<MatchQueueResponse> {
    return apiFetch<MatchQueueResponse>("/api/match/queue", {
      method: "POST",
      body: JSON.stringify({ deck_id: deckId, mode }),
    });
  },

  startPve(deckId: string): Promise<PveMatchResponse> {
    return apiFetch<PveMatchResponse>("/api/match/pve", {
      method: "POST",
      body: JSON.stringify({ deck_id: deckId }),
    });
  },

  leaveQueue(mode?: MatchMode): Promise<{ status: string }> {
    const qs = mode ? `?mode=${mode}` : "";
    return apiFetch<{ status: string }>(`/api/match/queue${qs}`, { method: "DELETE" });
  },

  queueStatus(): Promise<MatchQueueStatus> {
    return apiFetch<MatchQueueStatus>("/api/match/queue/status");
  },

  surrender(matchId: string): Promise<{ result: string; elo_change: number }> {
    return apiFetch<{ result: string; elo_change: number }>(
      `/api/match/${matchId}/surrender`,
      { method: "POST" }
    );
  },

  stats(): Promise<MatchStats> {
    return apiFetch<MatchStats>("/api/match/stats");
  },

  history(params?: {
    page?: number;
    page_size?: number;
    result?: "win" | "loss" | "draw";
  }): Promise<PaginatedResponse<MatchHistoryItem>> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.result) qs.set("result", params.result);
    const query = qs.toString();
    return apiFetch<PaginatedResponse<MatchHistoryItem>>(
      `/api/match/history${query ? `?${query}` : ""}`
    );
  },

  getMatch(matchId: string): Promise<MatchDetail> {
    return apiFetch<MatchDetail>(`/api/match/${matchId}`);
  },
};

// ---------- Leaderboard API ----------

export const leaderboardApi = {
  get<T = Array<{ username: string; elo: number; rank: number }>>(): Promise<T> {
    return apiFetch<T>("/api/leaderboard");
  },
};

// ---------- Re-exports ----------

export { setTokens, clearTokens, getToken };
export { apiFetch };
