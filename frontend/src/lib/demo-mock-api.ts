import type {
  Announcement,
  Card,
  DeckListItem,
  DeckListOut,
  MatchDetail,
  MatchHistoryItem,
  MatchQueueResponse,
  MatchQueueStatus,
  MatchStats,
  PaginatedResponse,
  UserCardOwnership,
  PackDefinition,
  PackOpenResult,
} from "@/types";
import { DEMO_USER } from "./demo-mode";

const MOCK_DECKS: DeckListOut[] = [
  {
    id: "d1",
    name: "重点班速攻",
    faction_code: "key_class",
    cards: [],
    card_count: 30,
    created_at: "2026-05-20T08:00:00Z",
  },
  {
    id: "d2",
    name: "艺术控场",
    faction_code: "art_club",
    cards: [],
    card_count: 28,
    created_at: "2026-05-25T10:00:00Z",
  },
];

const MOCK_CARDS: Card[] = [
  {
    id: "c1",
    name: "学霸小明",
    faction_code: "key_class",
    card_type: "unit",
    cost: 3,
    power: 4,
    spirit: 5,
    grit: 3,
    rarity: "rare",
    is_token: false,
  },
  {
    id: "c2",
    name: "画社小红",
    faction_code: "art_club",
    card_type: "unit",
    cost: 2,
    power: 2,
    spirit: 3,
    grit: 5,
    rarity: "uncommon",
    is_token: false,
  },
  {
    id: "c3",
    name: "体育小刚",
    faction_code: "sports",
    card_type: "unit",
    cost: 4,
    power: 6,
    spirit: 4,
    grit: 2,
    rarity: "epic",
    is_token: false,
  },
  {
    id: "c4",
    name: "学生会小雨",
    faction_code: "student_council",
    card_type: "unit",
    cost: 5,
    power: 3,
    spirit: 6,
    grit: 4,
    rarity: "legendary",
    is_token: false,
  },
  {
    id: "c5",
    name: "科学社小智",
    faction_code: "science",
    card_type: "unit",
    cost: 1,
    power: 2,
    spirit: 2,
    grit: 2,
    rarity: "common",
    is_token: false,
  },
];

const MOCK_OWNERSHIP: UserCardOwnership[] = [
  { card_id: "c1", count: 2, level: 2, fragments: 3 },
  { card_id: "c3", count: 1, level: 1, fragments: 0 },
  { card_id: "c5", count: 3, level: 1, fragments: 1 },
];

const MOCK_STATS: MatchStats = {
  total_matches: 32,
  wins: 20,
  losses: 11,
  draws: 1,
  win_rate: 0.625,
  ranked_matches: 18,
  quick_matches: 14,
  current_elo: 1185,
  elo_delta_7d: 32,
  elo_timeline_7d: [
    { match_id: "m1", ended_at: "2026-06-02T10:00:00Z", delta: 18, cumulative: 18 },
    { match_id: "m2", ended_at: "2026-06-03T12:00:00Z", delta: -12, cumulative: 6 },
    { match_id: "m3", ended_at: "2026-06-04T14:00:00Z", delta: 22, cumulative: 28 },
    { match_id: "m4", ended_at: "2026-06-05T16:00:00Z", delta: 8, cumulative: 36 },
    { match_id: "m5", ended_at: "2026-06-07T18:00:00Z", delta: -4, cumulative: 32 },
  ],
};

const MOCK_HISTORY: MatchHistoryItem[] = [
  {
    id: "m1",
    mode: "ranked",
    opponent: { id: "u2", username: "风之旅人", elo: 1120 },
    result: "win",
    my_elo_change: 24,
    end_reason: "combat",
    turns_played: 12,
    ended_at: "2026-06-07T18:30:00Z",
  },
  {
    id: "m2",
    mode: "quick",
    opponent: { id: "u3", username: "星辰大海", elo: 1080 },
    result: "loss",
    my_elo_change: 0,
    end_reason: "surrender",
    turns_played: 8,
    ended_at: "2026-06-07T16:00:00Z",
  },
  {
    id: "m3",
    mode: "ranked",
    opponent: { id: "u4", username: "书生意气", elo: 1200 },
    result: "win",
    my_elo_change: 22,
    end_reason: "combat",
    turns_played: 15,
    ended_at: "2026-06-05T14:00:00Z",
  },
];

const MOCK_MATCH_DETAIL: MatchDetail = {
  id: "m1",
  status: "finished",
  mode: "ranked",
  end_reason: "combat",
  p1: { id: "demo-user", username: DEMO_USER.username, elo: 1185, deck_id: "d1", deck_faction: "key_class" },
  p2: { id: "u2", username: "风之旅人", elo: 1120, deck_id: "d2", deck_faction: "sports" },
  winner_id: "demo-user",
  turns_played: 12,
  started_at: "2026-06-07T18:00:00Z",
  ended_at: "2026-06-07T18:30:00Z",
  replay_data: {
    match_id: "m1",
    mode: "ranked",
    turns_played: 12,
    winner: "p1",
    end_reason: "combat",
    elo_changes: { p1: 24, p2: -20 },
    players: {
      p1: { id: "demo-user", username: DEMO_USER.username, deck_id: "d1", faction: "key_class", final_hp: 25 },
      p2: { id: "u2", username: "风之旅人", deck_id: "d2", faction: "sports", final_hp: 0 },
    },
    summary: {
      total_events: 48,
      action_counts: { deploy: 16, attack_unit: 8, attack_face: 5, end_turn: 12, draw: 7 },
    },
    event_log: [
      { turn: 1, phase: "main", player: "p1", action: "deploy", detail: "部署 学霸小明 到前线" },
      { turn: 1, phase: "end", player: "p1", action: "end_turn", detail: "结束回合" },
      { turn: 3, phase: "combat", player: "p1", action: "attack_face", detail: "学霸小明 直击对手 (+4)" },
    ],
  },
};

const MOCK_PACKS: PackDefinition[] = [
  { id: "basic", name: "基础卡包", description: "5张随机卡牌", price_ink: 100, cards_count: 5 },
  { id: "advanced", name: "进阶卡包", description: "至少1张稀有", price_ink: 300, cards_count: 5 },
  { id: "selector", name: "自选卡包", description: "可重抽1张", price_ink: 500, cards_count: 5 },
];

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    title: "演示模式公告",
    content: "当前为 UI 审核演示环境，数据均为模拟。",
    category: "general",
    priority: "normal",
    is_pinned: true,
    created_at: new Date().toISOString(),
  },
];

let queueState: MatchQueueStatus = { status: "idle" };
let queuePollCount = 0;

function parseQuery(path: string): URLSearchParams {
  const idx = path.indexOf("?");
  if (idx < 0) return new URLSearchParams();
  return new URLSearchParams(path.slice(idx + 1));
}

function pathOnly(path: string): string {
  const idx = path.indexOf("?");
  return idx < 0 ? path : path.slice(0, idx);
}

/**
 * Returns mock API payload when demo session is active, or null to use real backend.
 */
export function resolveDemoMock<T>(path: string, options?: RequestInit): T | null {
  const method = (options?.method ?? "GET").toUpperCase();
  const p = pathOnly(path);
  const qs = parseQuery(path);

  if (p === "/api/auth/me") return { ...DEMO_USER } as T;
  if (p === "/api/auth/logout" && method === "POST") return undefined as T;
  if (p === "/api/auth/refresh" && method === "POST") {
    return { access_token: "demo_refresh", refresh_token: "demo_refresh", token_type: "bearer" } as T;
  }

  if (p === "/api/decks" && method === "GET") return MOCK_DECKS as T;

  if (p.startsWith("/api/cards") && method === "GET") {
    const page = Number(qs.get("page") ?? 1);
    const pageSize = Number(qs.get("page_size") ?? 100);
    const items = MOCK_CARDS;
    const res: PaginatedResponse<Card> = {
      items,
      total: items.length,
      page,
      page_size: pageSize,
    };
    return res as T;
  }

  if (p === "/api/collection" && method === "GET") return MOCK_OWNERSHIP as T;

  if (p === "/api/shop/packs" && method === "GET") return MOCK_PACKS as T;

  if (p.match(/^\/api\/shop\/packs\/[^/]+\/open$/) && method === "POST") {
    const result: PackOpenResult = {
      cards: MOCK_CARDS.slice(0, 3).map((c, i) => ({
        card_id: c.id,
        name: c.name,
        rarity: c.rarity ?? "common",
        faction_code: c.faction_code,
        is_new: i === 0,
        slot_index: i,
      })),
      remaining_ink: (DEMO_USER.ink ?? 0) - 100,
      can_reroll: false,
    };
    return result as T;
  }

  if (p === "/api/match/stats" && method === "GET") return MOCK_STATS as T;

  if (p === "/api/match/history" && method === "GET") {
    const page = Number(qs.get("page") ?? 1);
    const pageSize = Number(qs.get("page_size") ?? 15);
    const resultFilter = qs.get("result");
    let items = MOCK_HISTORY;
    if (resultFilter && resultFilter !== "all") {
      items = items.filter((m) => m.result === resultFilter);
    }
    const res: PaginatedResponse<MatchHistoryItem> = {
      items,
      total: items.length,
      page,
      page_size: pageSize,
    };
    return res as T;
  }

  if (p.match(/^\/api\/match\/[^/]+$/) && method === "GET" && !p.includes("history") && !p.includes("stats")) {
    const matchId = p.split("/").pop()!;
    if (matchId === "queue") return null;
    return { ...MOCK_MATCH_DETAIL, id: matchId } as T;
  }

  if (p === "/api/match/queue/status" && method === "GET") {
    if (queueState.status === "queued") {
      queuePollCount += 1;
      if (queuePollCount >= 2) {
        queueState = {
          status: "matched",
          mode: queueState.mode ?? "quick",
          match_id: "demo-match-1",
          opponent: { id: "u2", username: "风之旅人", elo: 1120 },
        };
      }
    }
    return { ...queueState } as T;
  }

  if (p === "/api/match/queue" && method === "POST") {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    queuePollCount = 0;
    queueState = {
      status: "queued",
      mode: body.mode ?? "quick",
      queue_position: 1,
      estimated_wait: 5,
    };
    const res: MatchQueueResponse = {
      status: "queued",
      mode: body.mode ?? "quick",
      queue_position: 1,
      estimated_wait: 5,
    };
    return res as T;
  }

  if (p.startsWith("/api/match/queue") && method === "DELETE") {
    queueState = { status: "idle" };
    queuePollCount = 0;
    return { status: "left" } as T;
  }

  if (p === "/api/leaderboard" && method === "GET") {
    return [
      { username: "书生意气", elo: 1380, rank: 1 },
      { username: "星辰大海", elo: 1320, rank: 2 },
      { username: DEMO_USER.username, elo: DEMO_USER.elo ?? 1185, rank: 5 },
    ] as T;
  }

  if (p === "/api/checkin/status" && method === "GET") {
    return {
      checked_in_today: false,
      streak: 3,
      total_checkins: 10,
      next_reward: { day: 4, ink: 200 },
    } as T;
  }

  if (p === "/api/checkin" && method === "POST") {
    return {
      streak: 4,
      reward: { ink: 200 },
      total_checkins: 11,
    } as T;
  }

  if (p.startsWith("/api/announcements") && method === "GET") {
    const res: PaginatedResponse<Announcement> = {
      items: MOCK_ANNOUNCEMENTS,
      total: MOCK_ANNOUNCEMENTS.length,
      page: 1,
      page_size: 20,
    };
    return res as T;
  }

  if (p === "/api/user/profile" && method === "GET") return { ...DEMO_USER } as T;

  // Unhandled — let caller fall through to real fetch (will fail gracefully in demo)
  return null;
}
