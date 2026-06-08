// ---------- Auth ----------

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SetCookieRequest {
  access_token: string;
  refresh_token: string;
  remember: boolean;
}

// ---------- User ----------

export interface User {
  id: string;
  username: string;
  email: string;
  elo?: number;
  ink?: number;
  role: "player" | "admin";
  avatar_url?: string | null;
}

// ---------- Card ----------

export interface Card {
  id: string;
  name: string;
  name_en?: string | null;
  faction_code: string;
  card_type: string;
  unit_type?: string | null;
  cost: number;
  power?: number | null;
  grit?: number | null;
  spirit?: number | null;
  effect_text?: string | null;
  effect_code?: string | null;
  rarity?: string | null;
  flavor_text?: string | null;
  artist?: string | null;
  image_url?: string | null;
  is_token?: boolean;
  set_code?: string | null;
}

// ---------- Deck ----------

export interface DeckCardEntry {
  card_id: string;
  quantity: number;
  card?: Card;
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  faction_code: string;
  is_default?: boolean;
  created_at?: string | null;
  entries: DeckCardEntry[];
}

export interface DeckListItem {
  id: string;
  name: string;
  faction_code: string;
  card_count?: number;
  created_at?: string | null;
}

export interface DeckCreateRequest {
  name: string;
  faction_code?: string;
  cards?: { card_id: string; quantity: number }[];
}

export interface DeckListOut {
  id: string;
  name: string;
  faction_code: string;
  cards: DeckCardEntry[];
  card_count?: number;
  created_at?: string | null;
}

// ---------- Announcement ----------

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: "update" | "event" | "maintenance" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  is_pinned?: boolean;
  author?: { username: string };
  created_at?: string | null;
}

export interface AnnouncementCreateIn {
  title: string;
  content: string;
  category?: "update" | "event" | "maintenance" | "general";
  priority?: "low" | "normal" | "high" | "urgent";
  is_pinned?: boolean;
}

export interface AnnouncementUpdateIn {
  title?: string;
  content?: string;
  category?: "update" | "event" | "maintenance" | "general";
  priority?: "low" | "normal" | "high" | "urgent";
  is_pinned?: boolean;
}

// ---------- Admin ----------

export interface AdminStats {
  users: number;
  cards: number;
  announcements: number;
  total_ink: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  elo: number;
  ink: number;
  role: "player" | "admin";
  is_active: boolean;
  created_at: string | null;
}

export interface ResetKeyResponse {
  message: string;
  user_id: string;
}

export interface CardUpdateIn {
  name?: string;
  name_en?: string | null;
  faction_code?: string;
  card_type?: string;
  unit_type?: string | null;
  cost?: number;
  power?: number | null;
  grit?: number | null;
  spirit?: number | null;
  effect_text?: string | null;
  effect_code?: string | null;
  rarity?: string | null;
  flavor_text?: string | null;
  artist?: string | null;
  image_url?: string | null;
  is_token?: boolean;
  set_code?: string | null;
}

// ---------- Collection ----------

export interface UserCardOwnership {
  card_id: string;
  count: number;
  level?: number;
  fragments?: number;
  card?: Card | null;
}

// ---------- Upgrade ----------

export interface UpgradeResult {
  card_id: string;
  new_level: number;
  power: number;
  grit: number;
  spirit: number;
  fragments_remaining: number;
  ink_remaining: number;
}

// ---------- Pagination ----------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
