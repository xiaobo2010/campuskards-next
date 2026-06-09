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

// ---------- Match / Game ----------

export interface OpponentInfo {
  id: string;
  username: string;
  elo: number;
}

export type MatchMode = "quick" | "ranked" | "pve";

export interface MatchQueueResponse {
  status: string;
  mode: MatchMode;
  queue_position: number;
  estimated_wait: number;
  match_id?: string | null;
}

export interface MatchQueueStatus {
  status: "idle" | "queued" | "matched";
  mode?: MatchMode | null;
  match_id?: string | null;
  opponent?: OpponentInfo | null;
  queue_position?: number | null;
  estimated_wait?: number | null;
}

export interface PveMatchResponse {
  status: string;
  mode: MatchMode;
  match_id: string;
  opponent: OpponentInfo;
}

export interface BattleUnit {
  uid: string;
  card_id: string;
  name: string;
  cost?: number;
  power: number;
  spirit: number;
  grit: number;
  can_attack: boolean;
  faction?: string | null;
  card_type?: string | null;
  synergy_tags?: string[];
  base_power?: number;
  unit_type?: string | null;
  keywords?: string[];
  immune_turns?: number;
  silenced_turns?: number;
  controlled?: boolean;
}

export interface EffectChoiceOption {
  id: string;
  label: string;
  branch_text: string;
}

export interface PendingChoicePayload {
  source_uid: string;
  source_name: string;
  context: "spell" | "deploy_battlecry" | "ability" | "discard";
  target_uid?: string | null;
  options: EffectChoiceOption[];
  discard_count?: number;
}

export interface PlayerBattleView {
  hp: number;
  max_hp: number;
  ink: number;
  max_ink: number;
  front_line: BattleUnit[];
  support_line: BattleUnit[];
  deck_count: number;
  pen_count: number;
  hand?: BattleUnit[];
  hand_count?: number;
  traps?: { uid: string; card_id: string; name: string; cost?: number }[];
  advisor_units?: BattleUnit[];
}

export interface GameStatePayload {
  turn: number;
  phase: "draw" | "main" | "combat" | "end";
  current_player: "p1" | "p2";
  timer: number;
  timer_remaining?: number;
  turn_deadline_ts?: number | null;
  match_elapsed?: number;
  game_over: boolean;
  winner: "p1" | "p2" | null;
  viewer: "p1" | "p2";
  opponent: "p1" | "p2";
  players: {
    p1: PlayerBattleView;
    p2: PlayerBattleView;
  };
  pending_choice?: PendingChoicePayload | null;
  corridor_controller?: "p1" | "p2" | null;
}

export interface BattlePackDrop {
  pack_id: string;
  name: string;
  cards: {
    card_id: string;
    name: string;
    rarity: string;
    faction_code?: string;
    is_new?: boolean;
  }[];
}

export interface BattleRewards {
  ink: number;
  packs: BattlePackDrop[];
}

export interface GameOverPayload {
  winner_id: string;
  elo_change: { p1: number; p2: number };
  reason: string;
  mode?: MatchMode;
  battle_report_id?: string;
  rewards?: BattleRewards;
  battle_summary?: {
    total_events: number;
    action_counts: Record<string, number>;
  };
  turns_played?: number;
  players?: BattleReport["players"];
  event_log?: BattleReportEvent[];
}

export interface MatchHistoryItem {
  id: string;
  mode: MatchMode;
  opponent: OpponentInfo;
  result: "win" | "loss" | "draw";
  my_elo_change: number;
  end_reason?: string | null;
  my_deck_faction?: string | null;
  opponent_deck_faction?: string | null;
  turns_played?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface EloTimelinePoint {
  match_id: string;
  ended_at: string;
  delta: number;
  cumulative: number;
}

export interface MatchStats {
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  ranked_matches: number;
  quick_matches: number;
  current_elo: number;
  elo_delta_7d: number;
  elo_timeline_7d: EloTimelinePoint[];
}

export interface MatchUserInfo {
  id: string;
  username: string;
  elo: number;
  deck_id: string;
  deck_faction?: string | null;
}

export interface BattleReportEvent {
  turn?: number;
  phase: string;
  player: string;
  action: string;
  detail: string;
}

export interface BattleReport {
  match_id?: string;
  mode?: MatchMode;
  game_id?: string;
  turns_played?: number;
  winner?: string | null;
  winner_id?: string | null;
  end_reason?: string;
  elo_changes?: { p1: number; p2: number };
  players?: Record<
    string,
    {
      id: string;
      username: string;
      deck_id: string;
      faction?: string | null;
      final_hp?: number;
    }
  >;
  summary?: {
    total_events: number;
    action_counts: Record<string, number>;
  };
  event_log?: BattleReportEvent[];
  final_snapshot?: Record<string, unknown>;
}

export interface MatchDetail {
  id: string;
  status: "active" | "finished";
  mode: MatchMode;
  end_reason?: string | null;
  p1: MatchUserInfo;
  p2: MatchUserInfo;
  winner_id?: string | null;
  turns_played?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  replay_data?: BattleReport | null;
}

// ---------- Shop ----------

export interface PackDefinition {
  id: string;
  name: string;
  description: string;
  price_ink: number;
  cards_count: number;
  cost_type?: string;
  price_elo?: number;
  min_elo?: number;
}

export interface PackOpenCard {
  card_id: string;
  name?: string;
  rarity?: string;
  faction_code?: string;
  is_new?: boolean;
  slot_index?: number;
}

export interface PackOpenResult {
  pack_id?: string;
  cards: PackOpenCard[];
  new?: string[];
  fragments?: Record<string, number>;
  remaining_ink?: number;
  remaining_elo?: number;
  can_reroll?: boolean;
  reroll_token?: string | null;
}

// ---------- Pagination ----------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
