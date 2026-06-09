"use client";

import { useState, useEffect } from "react";
import { DEMO_MODE_ENABLED } from "@/lib/demo-mode";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Swords,
  Shield,
  Flag,
  Droplets,
  Clock,
  Wifi,
  TrendingUp,
  TrendingDown,
  Trophy,
  SkipForward,
  AlertTriangle,
  Zap,
  X,
  Loader2,
  BarChart3,
  ScrollText,
  User,
  History,
  Medal,
  ShoppingBag,
  Briefcase,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import BattleCard, { CardBackStack, EmptyBattleSlot } from "@/components/game/battle/battle-card";
import BattleResultScreen from "@/components/game/battle/battle-result-screen";
import BattleTurnTimer, { MatchElapsedClock } from "@/components/game/battle/battle-turn-timer";
import BattleTimerWarning from "@/components/game/battle/battle-timer-warning";
import {
  PackOpeningAnimation,
  type PackResultCard,
  type SelectorModeProps,
} from "@/components/game/pack-opening-animation";
import { cn } from "@/lib/utils";
import type {
  BattleUnit,
  PlayerBattleView,
  GameStatePayload,
  GameOverPayload,
  MatchHistoryItem,
  MatchStats,
  EloTimelinePoint,
  MatchDetail,
  BattleReportEvent,
  DeckListOut,
} from "@/types";

/* ================================================================
   MOCK DATA — all data lives here, no API calls
   ================================================================ */

const MOCK_UNITS: BattleUnit[] = [
  { uid: "a1", card_id: "key_001", name: "学霸小明", cost: 3, power: 4, spirit: 5, grit: 3, can_attack: true, faction: "key_class", card_type: "character" },
  { uid: "a2", card_id: "art_002", name: "画社小红", cost: 2, power: 2, spirit: 3, grit: 5, can_attack: false, faction: "art_club", card_type: "character" },
  { uid: "a3", card_id: "spr_003", name: "体育小刚", cost: 4, power: 6, spirit: 4, grit: 2, can_attack: true, faction: "sports", card_type: "character" },
  { uid: "a4", card_id: "stu_004", name: "学生会小雨", cost: 5, power: 3, spirit: 6, grit: 4, can_attack: false, faction: "student_council", card_type: "character" },
  { uid: "a5", card_id: "sci_005", name: "科学社小智", cost: 1, power: 2, spirit: 2, grit: 2, can_attack: true, faction: "science", card_type: "character" },
];

const MOCK_GAME_STATE: GameStatePayload = {
  turn: 6,
  phase: "main",
  current_player: "p1",
  timer: 100,
  timer_remaining: 74,
  match_elapsed: 342,
  game_over: false,
  winner: null,
  viewer: "p1",
  opponent: "p2",
  players: {
    p1: {
      hp: 25, max_hp: 30, ink: 8, max_ink: 10,
      front_line: MOCK_UNITS.slice(0, 2),
      support_line: MOCK_UNITS.slice(3, 4),
      hand: MOCK_UNITS,
      deck_count: 12, pen_count: 2,
    },
    p2: {
      hp: 22, max_hp: 30, ink: 6, max_ink: 8,
      front_line: MOCK_UNITS.slice(2, 4),
      support_line: MOCK_UNITS.slice(4, 5),
      deck_count: 15, pen_count: 1, hand_count: 4,
    },
  },
};

const MOCK_STATS: MatchStats = {
  total_matches: 32, wins: 20, losses: 11, draws: 1, win_rate: 0.625,
  ranked_matches: 18, quick_matches: 14, current_elo: 1185, elo_delta_7d: 32,
  elo_timeline_7d: [
    { match_id: "m1", ended_at: "2026-06-02T10:00:00Z", delta: 18, cumulative: 18 },
    { match_id: "m2", ended_at: "2026-06-03T12:00:00Z", delta: -12, cumulative: 6 },
    { match_id: "m3", ended_at: "2026-06-04T14:00:00Z", delta: 22, cumulative: 28 },
    { match_id: "m4", ended_at: "2026-06-05T16:00:00Z", delta: 8, cumulative: 36 },
    { match_id: "m5", ended_at: "2026-06-07T18:00:00Z", delta: -4, cumulative: 32 },
  ],
};

const MOCK_HISTORY: MatchHistoryItem[] = [
  { id: "m1", mode: "ranked", opponent: { id: "u2", username: "风之旅人", elo: 1120 }, result: "win", my_elo_change: 24, end_reason: "combat", turns_played: 12, ended_at: "2026-06-07T18:30:00Z" },
  { id: "m2", mode: "quick", opponent: { id: "u3", username: "星辰大海", elo: 1080 }, result: "loss", my_elo_change: 0, end_reason: "surrender", turns_played: 8, ended_at: "2026-06-07T16:00:00Z" },
  { id: "m3", mode: "ranked", opponent: { id: "u4", username: "书生意气", elo: 1200 }, result: "win", my_elo_change: 22, end_reason: "combat", turns_played: 15, ended_at: "2026-06-05T14:00:00Z" },
  { id: "m4", mode: "ranked", opponent: { id: "u5", username: "青灯古卷", elo: 1150 }, result: "loss", my_elo_change: -18, end_reason: "combat", turns_played: 10, ended_at: "2026-06-04T11:00:00Z" },
  { id: "m5", mode: "quick", opponent: { id: "u6", username: "浮生若梦", elo: 990 }, result: "win", my_elo_change: 0, end_reason: "surrender", turns_played: 6, ended_at: "2026-06-03T09:00:00Z" },
];

const MOCK_MATCH_DETAIL_PREVIEW = {
  summary: { total_events: 48, action_counts: { deploy: 16, attack_unit: 8, attack_face: 5, end_turn: 12, draw: 7 } },
  players: {
    p1: { id: "u1", username: "我", deck_id: "d1", faction: "key_class", final_hp: 25 },
    p2: { id: "u2", username: "风之旅人", deck_id: "d2", faction: "sports", final_hp: 0 },
  },
  event_log: [
    { turn: 1, phase: "main", player: "p1", action: "deploy", detail: "部署 学霸小明 到前线" },
    { turn: 1, phase: "end", player: "p1", action: "end_turn", detail: "结束回合" },
    { turn: 2, phase: "main", player: "p2", action: "deploy", detail: "部署 体育小刚 到支援" },
    { turn: 3, phase: "combat", player: "p1", action: "attack_face", detail: "学霸小明 直击对手 (+4)" },
    { turn: 12, phase: "combat", player: "p1", action: "attack_face", detail: "学生会小雨 直击对手 (+3) — 对手 HP 归零" },
  ],
};

const MOCK_GAME_OVER_WIN: GameOverPayload = {
  winner_id: "u1",
  elo_change: { p1: 24, p2: -20 },
  reason: "combat",
  mode: "ranked",
  battle_report_id: "m1",
  rewards: {
    ink: 312,
    packs: [
      {
        pack_id: "basic",
        name: "基础卡包",
        cards: [
          { card_id: "c1", name: "学霸小明", rarity: "common", is_new: false },
          { card_id: "c2", name: "艺术少女", rarity: "rare", is_new: true },
        ],
      },
    ],
  },
  battle_summary: MOCK_MATCH_DETAIL_PREVIEW.summary,
  turns_played: 12,
  players: MOCK_MATCH_DETAIL_PREVIEW.players,
  event_log: MOCK_MATCH_DETAIL_PREVIEW.event_log,
};

const MOCK_GAME_OVER_LOSS: GameOverPayload = {
  winner_id: "u2",
  elo_change: { p1: -20, p2: 24 },
  reason: "surrender",
  mode: "ranked",
  rewards: { ink: 0, packs: [] },
  battle_summary: { total_events: 20, action_counts: { deploy: 6, end_turn: 5 } },
  turns_played: 6,
  players: {
    p1: { id: "u1", username: "我", deck_id: "d1", faction: "key_class", final_hp: 12 },
    p2: { id: "u2", username: "风之旅人", deck_id: "d2", faction: "sports", final_hp: 22 },
  },
  event_log: [
    { turn: 1, phase: "main", player: "p1", action: "deploy", detail: "部署 学霸小明 到前线" },
    { turn: 6, phase: "main", player: "p1", action: "end_turn", detail: "投降" },
  ],
};

const MOCK_MATCH_DETAIL: MatchDetail = {
  id: "m1",
  status: "finished",
  mode: "ranked",
  end_reason: "combat",
  p1: { id: "u1", username: "我", elo: 1185, deck_id: "d1", deck_faction: "key_class" },
  p2: { id: "u2", username: "风之旅人", elo: 1120, deck_id: "d2", deck_faction: "sports" },
  winner_id: "u1",
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
      p1: { id: "u1", username: "我", deck_id: "d1", faction: "key_class", final_hp: 25 },
      p2: { id: "u2", username: "风之旅人", deck_id: "d2", faction: "sports", final_hp: 0 },
    },
    summary: MOCK_MATCH_DETAIL_PREVIEW.summary,
    event_log: MOCK_MATCH_DETAIL_PREVIEW.event_log,
  },
};

const MOCK_DECKS: DeckListOut[] = [
  { id: "d1", name: "重点班速攻", faction_code: "key_class", cards: [], card_count: 30, created_at: "2026-05-20T08:00:00Z" },
  { id: "d2", name: "艺术控场", faction_code: "art_club", cards: [], card_count: 28, created_at: "2026-05-25T10:00:00Z" },
  { id: "d3", name: "体育快攻", faction_code: "sports", cards: [], card_count: 30, created_at: "2026-06-01T14:00:00Z" },
];

const MOCK_LEADERBOARD = [
  { username: "书生意气", elo: 1380, rank: 1 },
  { username: "星辰大海", elo: 1320, rank: 2 },
  { username: "青灯古卷", elo: 1280, rank: 3 },
  { username: "浮生若梦", elo: 1220, rank: 4 },
  { username: "我", elo: 1185, rank: 5 },
  { username: "风之旅人", elo: 1120, rank: 6 },
  { username: "云中白鹤", elo: 1080, rank: 7 },
  { username: "墨染轻衣", elo: 1020, rank: 8 },
];

const SHOP_PACKS = [
  { id: "basic", name: "基础卡包", icon: "📦", cards: 5, cost: 100, costType: "ink" as const, gradient: "from-blue-500/20 to-purple-500/20", border: "border-blue-500/30", desc: "5张随机卡牌，适合新手起步" },
  { id: "advanced", name: "进阶卡包", icon: "✨", cards: 6, cost: 300, costType: "ink" as const, gradient: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30", desc: "更高稀有度概率" },
  { id: "selector", name: "自选卡包", icon: "🎯", cards: 5, cost: 500, costType: "ink" as const, gradient: "from-amber-500/20 to-red-500/20", border: "border-amber-500/30", desc: "可选择1张卡牌替换", hasSelector: true },
  { id: "faction", name: "阵营卡包", icon: "⚔️", cards: 5, cost: 400, costType: "ink" as const, gradient: "from-green-500/20 to-teal-500/20", border: "border-green-500/30", desc: "限定制势力的卡牌" },
  { id: "prestige", name: "荣耀卡包", icon: "👑", cards: 5, cost: 300, costType: "elo" as const, gradient: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30", desc: "需要 ELO≥1200，保底传说品质" },
  { id: "battle_drop", name: "战斗奖励", icon: "🎁", cards: 5, cost: 0, costType: "ink" as const, gradient: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-500/30", desc: "胜利后掉落的卡包（演示用）" },
];

const COLLECTION_CARDS = [
  { id: "c1", name: "学霸小明", faction_code: "key_class", rarity: "rare", cost: 3, card_type: "unit", is_token: false },
  { id: "c2", name: "画社小红", faction_code: "art_club", rarity: "uncommon", cost: 2, card_type: "unit", is_token: false },
  { id: "c3", name: "体育小刚", faction_code: "sports", rarity: "epic", cost: 4, card_type: "unit", is_token: false },
  { id: "c4", name: "学生会小雨", faction_code: "student_council", rarity: "legendary", cost: 5, card_type: "unit", is_token: false },
  { id: "c5", name: "科学社小智", faction_code: "science", rarity: "common", cost: 1, card_type: "unit", is_token: false },
  { id: "c6", name: "图书馆员", faction_code: "key_class", rarity: "common", cost: 2, card_type: "unit", is_token: false },
  { id: "c7", name: "灵感火花", faction_code: "art_club", rarity: "rare", cost: 3, card_type: "spell", is_token: false },
  { id: "c8", name: "课间冲刺", faction_code: "sports", rarity: "common", cost: 1, card_type: "spell", is_token: false },
];

function toPackResultCard(
  card: (typeof COLLECTION_CARDS)[number],
  index: number,
  isNew?: boolean
): PackResultCard {
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    faction: card.faction_code,
    faction_code: card.faction_code,
    slot_index: index,
    is_new: isNew,
    cost: card.cost,
  };
}

/** 各卡包类型的演示开包结果 */
const MOCK_OPEN_BY_PACK: Record<string, PackResultCard[]> = {
  basic: [
    toPackResultCard(COLLECTION_CARDS[4], 0),
    toPackResultCard(COLLECTION_CARDS[5], 1, true),
    toPackResultCard(COLLECTION_CARDS[7], 2),
    toPackResultCard(COLLECTION_CARDS[0], 3),
    toPackResultCard(COLLECTION_CARDS[1], 4, true),
  ],
  advanced: [
    toPackResultCard(COLLECTION_CARDS[4], 0),
    toPackResultCard(COLLECTION_CARDS[1], 1),
    toPackResultCard(COLLECTION_CARDS[2], 2, true),
    toPackResultCard(COLLECTION_CARDS[6], 3),
    toPackResultCard(COLLECTION_CARDS[0], 4),
    toPackResultCard(COLLECTION_CARDS[3], 5, true),
  ],
  selector: [
    toPackResultCard(COLLECTION_CARDS[4], 0),
    toPackResultCard(COLLECTION_CARDS[5], 1),
    toPackResultCard(COLLECTION_CARDS[2], 2),
    toPackResultCard(COLLECTION_CARDS[7], 3, true),
    toPackResultCard(COLLECTION_CARDS[1], 4),
  ],
  faction: [
    toPackResultCard(COLLECTION_CARDS[0], 0),
    toPackResultCard(COLLECTION_CARDS[5], 1),
    toPackResultCard(COLLECTION_CARDS[6], 2, true),
    toPackResultCard(COLLECTION_CARDS[4], 3),
    toPackResultCard(COLLECTION_CARDS[0], 4),
  ],
  prestige: [
    toPackResultCard(COLLECTION_CARDS[3], 0, true),
    toPackResultCard(COLLECTION_CARDS[2], 1),
    toPackResultCard(COLLECTION_CARDS[2], 2),
    toPackResultCard(COLLECTION_CARDS[6], 3),
    toPackResultCard(COLLECTION_CARDS[1], 4),
  ],
  battle_drop: [
    toPackResultCard(COLLECTION_CARDS[0], 0),
    toPackResultCard(COLLECTION_CARDS[1], 1, true),
    toPackResultCard(COLLECTION_CARDS[4], 2),
    toPackResultCard(COLLECTION_CARDS[7], 3),
    toPackResultCard(COLLECTION_CARDS[5], 4),
  ],
};

const RARITY_COLORS: Record<string, string> = {
  common: "border-zinc-500/40", uncommon: "border-green-500/40", rare: "border-blue-500/40",
  epic: "border-purple-500/40", legendary: "border-yellow-500/40",
};
const RARITY_BG: Record<string, string> = {
  common: "from-zinc-800/50 to-zinc-900/80", uncommon: "from-green-900/30 to-green-950/60",
  rare: "from-blue-900/30 to-blue-950/60", epic: "from-purple-900/30 to-purple-950/60",
  legendary: "from-yellow-900/30 to-amber-950/60",
};
const RARITY_LABEL: Record<string, string> = {
  common: "普通", uncommon: "稀有", rare: "史诗", epic: "传说", legendary: "传奇",
};
const FACTION_LABEL: Record<string, string> = {
  key_class: "重点班", art_club: "艺体班", sports: "体育", student_council: "学生会", science: "科学",
};
const RESULT_LABEL: Record<string, string> = { win: "胜利", loss: "失败", draw: "平局" };
const MODE_LABEL: Record<string, string> = { quick: "快速", ranked: "排位" };
const ACTION_LABEL: Record<string, string> = { deploy: "部署", attack_face: "直击", attack_unit: "攻击", end_turn: "结束回合", draw: "抽牌", game_start: "对局开始" };
const END_REASON_LABEL: Record<string, string> = { combat: "正常结算", surrender: "投降" };

/* ================================================================
   NAV TABS
   ================================================================ */
type TabId = "battle" | "matchmaking" | "history" | "report" | "shop" | "collection" | "decks" | "leaderboard";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "battle", label: "对战", icon: <Swords className="w-4 h-4" /> },
  { id: "matchmaking", label: "匹配", icon: <Zap className="w-4 h-4" /> },
  { id: "history", label: "历史", icon: <History className="w-4 h-4" /> },
  { id: "report", label: "战报", icon: <ScrollText className="w-4 h-4" /> },
  { id: "shop", label: "商店", icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "collection", label: "收藏", icon: <Sparkles className="w-4 h-4" /> },
  { id: "decks", label: "卡组", icon: <Briefcase className="w-4 h-4" /> },
  { id: "leaderboard", label: "排行榜", icon: <Trophy className="w-4 h-4" /> },
];

/* ================================================================
   SUB-PAGES (pure UI, mock data only)
   ================================================================ */

function HpBar({ hp, maxHp, compact }: { hp: number; maxHp: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className={cn("space-y-0.5", compact && "space-y-0")}>
      <div className="flex items-center gap-1.5">
        <Heart className={cn("text-red-500 fill-red-500", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
        <span className={cn("font-mono text-zinc-300", compact ? "text-[10px]" : "text-xs")}>{hp}/{maxHp}</span>
      </div>
      <div className={cn("w-full max-w-[8rem] rounded-full bg-zinc-800 overflow-hidden", compact ? "h-1" : "h-1.5")}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", pct > 50 ? "bg-red-500" : pct > 25 ? "bg-amber-500" : "bg-red-600 animate-pulse")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InkBadge({ ink, max }: { ink: number; max: number }) {
  return (
    <div className="flex items-center gap-1 text-xs text-zinc-400">
      <Droplets className="w-3.5 h-3.5 text-sky-400" />
      <span className="font-mono text-sky-300">{ink}/{max}</span>
      <span className="text-zinc-600 text-[10px]">墨水</span>
    </div>
  );
}

function LineRow({ label, icon, units, onUnitClick, selectedUid, interactive }: {
  label: string; icon?: React.ReactNode; units: BattleUnit[];
  onUnitClick?: (u: BattleUnit) => void; selectedUid?: string | null; interactive?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">{icon}{label}</div>
      <div className="flex gap-2 min-h-[8rem] flex-wrap justify-center items-end">
        {units.length === 0 ? <EmptyBattleSlot /> : units.map(u => (
          <BattleCard key={u.uid} unit={u} variant="field" selected={selectedUid === u.uid} onClick={interactive ? () => onUnitClick?.(u) : undefined} disabled={!interactive} />
        ))}
      </div>
    </div>
  );
}

/* --- Battle Page Preview --- */
function BattlePreview() {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedHandUid, setSelectedHandUid] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const gs = MOCK_GAME_STATE;
  const me = gs.players.p1;
  const opp = gs.players.p2;
  const isMyTurn = gs.current_player === "p1";
  const [deployLine, setDeployLine] = useState<"front" | "support">("front");

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-foreground flex flex-col select-none">
      <BattleTimerWarning open={showWarning} secondsLeft={18} onDismiss={() => setShowWarning(false)} />
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <MatchElapsedClock elapsed={342} />
          <span className="text-xs text-zinc-500 hidden sm:inline">·</span>
          <span className="text-xs text-zinc-500 hidden sm:inline">回合 {gs.turn}</span>
        </div>
        <BattleTurnTimer secondsLeft={74} turnLimit={100} isMyTurn={isMyTurn} warningAt={20} />
        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 shrink-0">投降</Button>
      </header>

      <div className="flex-1 flex flex-col p-3 gap-3 max-w-4xl mx-auto w-full">
        {/* Opponent */}
        <section className="rounded-2xl border border-red-900/30 bg-gradient-to-b from-red-950/20 to-zinc-900/40 p-3 shadow-inner">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-9 h-9 border border-red-800/50"><AvatarFallback className="bg-red-950 text-red-300 text-xs">对手</AvatarFallback></Avatar>
              <div><p className="font-semibold text-sm text-zinc-100 truncate">风之旅人</p><p className="text-[10px] text-zinc-500">ELO 1120</p></div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <CardBackStack count={4} />
              <div className="text-right">
                <HpBar hp={opp.hp} maxHp={opp.max_hp} compact />
                <InkBadge ink={opp.ink} max={opp.max_ink} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <LineRow
              label="前线"
              icon={<Swords className="w-3 h-3" />}
              units={opp.front_line}
              onUnitClick={() => selectedUid && setSelectedUid(null)}
              interactive={!!selectedUid}
            />
            <LineRow label="支援" icon={<Shield className="w-3 h-3" />} units={opp.support_line} />
          </div>
        </section>

        {/* Center */}
        <section className="flex flex-col items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold border", isMyTurn ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "bg-zinc-800/80 border-zinc-700 text-zinc-500")}>
              {isMyTurn ? "你的回合" : "对手思考中"}
            </span>
            <span className="px-2 py-1 rounded-full text-xs bg-zinc-800/80 border border-zinc-700 text-zinc-400">主阶段</span>
          </div>
          {selectedUid && isMyTurn && (
            <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20" onClick={() => setSelectedUid(null)}>
              <Flag className="w-3.5 h-3.5" /> 直击对手
            </Button>
          )}
          <div className="flex gap-2 flex-wrap justify-center">
            <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400" onClick={() => setShowWarning(true)}>触发时间警告</Button>
            <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-400" onClick={() => setGameOver(MOCK_GAME_OVER_WIN)}>胜利结算</Button>
            <Button size="sm" variant="outline" className="border-red-500/40 text-red-400" onClick={() => setGameOver(MOCK_GAME_OVER_LOSS)}>战败结算</Button>
          </div>
        </section>

        {/* My field */}
        <section className="rounded-2xl border border-emerald-900/30 bg-gradient-to-b from-emerald-950/15 to-zinc-900/40 p-3">
          <div className="flex items-center justify-between mb-3">
            <HpBar hp={me.hp} maxHp={me.max_hp} />
            <div className="text-right text-xs text-zinc-500 space-y-0.5">
              <InkBadge ink={me.ink} max={me.max_ink} />
              <p>牌库 {me.deck_count} · 墓地 {me.pen_count}</p>
            </div>
          </div>
          <div className="space-y-3">
            <LineRow label="前线" icon={<Swords className="w-3 h-3 text-emerald-500" />} units={me.front_line} onUnitClick={u => setSelectedUid(selectedUid === u.uid ? null : u.uid)} selectedUid={selectedUid} interactive={isMyTurn} />
            <LineRow label="支援" icon={<Shield className="w-3 h-3 text-emerald-500" />} units={me.support_line} onUnitClick={u => setSelectedUid(selectedUid === u.uid ? null : u.uid)} selectedUid={selectedUid} interactive={isMyTurn} />
          </div>
        </section>

        {/* Hand */}
        <section className="rounded-2xl border border-purple-800/30 bg-gradient-to-t from-purple-950/20 to-zinc-900/60 p-3 pb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 text-center">手牌 · 点击出牌</p>
          <div className="flex gap-2 overflow-x-auto pb-2 justify-center min-h-[7.5rem] items-end">
            {me.hand?.map(card => (
              <BattleCard
                key={card.uid}
                unit={card}
                variant="hand"
                selected={selectedHandUid === card.uid}
                onClick={() => setSelectedHandUid(selectedHandUid === card.uid ? null : card.uid)}
                affordable={card.cost == null || card.cost <= me.ink}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center items-center mt-2">
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
              {(["front", "support"] as const).map(l => (
                <button key={l} type="button" onClick={() => setDeployLine(l)}
                  className={cn("px-3 py-2 transition-colors", deployLine === l ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800")}>
                  {l === "front" ? "前线" : "支援"}
                </button>
              ))}
            </div>
            <Button className="gap-2 bg-purple-600 hover:bg-purple-500"><SkipForward className="w-4 h-4" />结束回合</Button>
          </div>
        </section>
      </div>

      {gameOver && (
        <BattleResultScreen
          gameOver={gameOver}
          viewer="p1"
          userId="u1"
          matchId="m1"
          onBackToLobby={() => setGameOver(null)}
        />
      )}
    </div>
  );
}

/* --- Matchmaking Preview --- */
function MatchmakingPreview() {
  const [mode, setMode] = useState<"quick" | "ranked">("quick");
  const [state, setState] = useState<"idle" | "searching" | "found">("idle");
  const [searchTime, setSearchTime] = useState(0);

  useEffect(() => {
    if (state !== "searching") return;
    const id = setInterval(() => setSearchTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/70 pointer-events-none -z-10" />
      <div className="relative z-10 max-w-2xl w-full">
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="bg-zinc-900/90 border-purple-500/30 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-3xl text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">选择对战模式</CardTitle>
                  <CardDescription className="text-center text-zinc-400">选择卡组与匹配模式，开始卡牌对战</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">出战卡组</label>
                    <select className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 text-sm">
                      <option>重点班速攻 (key_class) · 30 张</option>
                      <option>艺术控场 (art_club) · 28 张</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(["quick", "ranked"] as const).map(m => (
                      <motion.button key={m} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setMode(m)}
                        className={cn("relative p-6 rounded-xl border-2 transition-all", mode === m ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600")}>
                        <div className="flex flex-col items-center space-y-3">
                          <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", m === "quick" ? "bg-gradient-to-br from-blue-500 to-cyan-500" : "bg-gradient-to-br from-amber-500 to-orange-500")}>
                            {m === "quick" ? <Zap className="w-8 h-8 text-white" /> : <Trophy className="w-8 h-8 text-white" />}
                          </div>
                          <div className="text-center">
                            <h3 className="text-xl font-bold text-zinc-100">{m === "quick" ? "快速匹配" : "排位赛"}</h3>
                            <p className="text-sm text-zinc-400 mt-1">{m === "quick" ? "休闲对战" : "竞技对战，影响 ELO"}</p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 text-center">快速与排位使用独立匹配队列；排位赛胜负将影响 ELO。</p>
                  <Button onClick={() => { setSearchTime(0); setState("searching"); }}
                    className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Swords className="w-5 h-5 mr-2" />开始匹配
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
          {state === "searching" && (
            <motion.div key="searching" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Card className="bg-zinc-900/90 border-purple-500/30 shadow-2xl">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 rounded-full border-4 border-purple-500/30 border-t-purple-500" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 flex items-center justify-center">
                        <Swords className="w-16 h-16 text-purple-400" />
                      </motion.div>
                    </div>
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-zinc-100">正在匹配对手...</h2>
                      <p className="text-zinc-400">{mode === "quick" ? "快速匹配" : "排位赛"} · 已等待 {searchTime} 秒</p>
                    </div>
                    <Button onClick={() => setState("idle")} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                      <X className="w-4 h-4 mr-2" />取消匹配
                    </Button>
                    <Button size="sm" variant="outline" className="border-emerald-500/50 text-emerald-400" onClick={() => setState("found")}>
                      模拟匹配成功
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          {state === "found" && (
            <motion.div key="found" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-zinc-900/90 border-emerald-500/50 shadow-2xl shadow-emerald-500/20">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                      <Swords className="w-16 h-16 text-white" />
                    </div>
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-bold text-emerald-400">匹配成功！</h2>
                      <p className="text-zinc-400">正在进入对局...</p>
                    </div>
                    <Button onClick={() => setState("idle")} variant="outline">返回</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* --- History Preview --- */
function HistoryPreview() {
  const [filter, setFilter] = useState<"all" | "win" | "loss" | "draw">("all");
  const stats = MOCK_STATS;
  const items = MOCK_HISTORY.filter(m => filter === "all" || m.result === filter);
  const winRatePct = Math.round(stats.win_rate * 100);
  const timeline = stats.elo_timeline_7d;
  const maxAbs = Math.max(...timeline.map(p => Math.abs(p.cumulative)), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <History className="w-7 h-7 text-purple-400" />
          <div><h1 className="text-2xl font-bold text-zinc-100">对战历史</h1><p className="text-sm text-zinc-500">测试用户 的战绩与战报</p></div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "胜率", value: `${winRatePct}%`, sub: `${stats.wins}胜 ${stats.losses}负 ${stats.draws}平` },
            { label: "总场次", value: String(stats.total_matches), sub: `排位 ${stats.ranked_matches} · 快速 ${stats.quick_matches}` },
            { label: "当前 ELO", value: String(stats.current_elo), accent: true },
            { label: "近 7 天 ELO", value: `${stats.elo_delta_7d > 0 ? "+" : ""}${stats.elo_delta_7d}`, trend: stats.elo_delta_7d >= 0 ? "up" as const : "down" as const },
          ].map(s => (
            <Card key={s.label} className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={cn("text-2xl font-bold flex items-center gap-1", "accent" in s && s.accent && "text-amber-400")}>
                  {"trend" in s && s.trend === "up" && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                  {"trend" in s && s.trend === "down" && <TrendingDown className="w-5 h-5 text-red-400" />}
                  {s.value}
                </p>
                {"sub" in s && s.sub && <p className="text-[10px] text-zinc-600">{s.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ELO Chart */}
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="pb-2"><CardTitle className="text-base text-zinc-200">近 7 天排位 ELO 走势</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32 px-2">
              {timeline.map((point, i) => {
                const height = Math.max(8, (Math.abs(point.cumulative) / maxAbs) * 100);
                const positive = point.cumulative >= 0;
                return (
                  <div key={point.match_id} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                    <span className={cn("text-[10px] font-mono", positive ? "text-emerald-400" : "text-red-400")}>
                      {point.cumulative > 0 ? "+" : ""}{point.cumulative}
                    </span>
                    <div className={cn("w-full rounded-t transition-all", positive ? "bg-emerald-500/70" : "bg-red-500/70")}
                      style={{ height: `${height}%` }} />
                    <span className="text-[9px] text-zinc-600 truncate w-full text-center">{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 text-center mt-3">近 7 天排位 ELO 累计变化（按对局顺序）</p>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "win", "loss", "draw"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
              className={cn(filter === f ? "bg-purple-600 hover:bg-purple-700" : "border-zinc-700 text-zinc-400")}
              onClick={() => setFilter(f)}>
              {f === "all" ? "全部" : RESULT_LABEL[f]}
            </Button>
          ))}
        </div>

        {/* List */}
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
              <Swords className="w-4 h-4" />对战记录 <span className="text-xs font-normal text-zinc-500">共 {items.length} 场</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 hover:border-purple-500/40 hover:bg-zinc-900 transition-colors group cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                    m.result === "win" && "bg-emerald-500/20 text-emerald-400",
                    m.result === "loss" && "bg-red-500/20 text-red-400",
                    m.result === "draw" && "bg-zinc-700/50 text-zinc-400")}>
                    {m.result === "win" ? <Trophy className="w-4 h-4" /> : RESULT_LABEL[m.result]?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">vs {m.opponent.username}</p>
                    <p className="text-xs text-zinc-500">{MODE_LABEL[m.mode]} · {m.turns_played} 回合</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.mode === "ranked" && m.my_elo_change !== 0 && (
                    <span className={cn("text-sm font-mono font-medium", m.my_elo_change > 0 ? "text-emerald-400" : "text-red-400")}>
                      {m.my_elo_change > 0 ? "+" : ""}{m.my_elo_change}
                    </span>
                  )}
                  <span className={cn("text-xs px-2 py-0.5 rounded-full",
                    m.result === "win" && "bg-emerald-500/15 text-emerald-400",
                    m.result === "loss" && "bg-red-500/15 text-red-400",
                    m.result === "draw" && "bg-zinc-700/50 text-zinc-400")}>
                    {RESULT_LABEL[m.result]}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Report Preview --- */
function ReportPreview() {
  const m = MOCK_MATCH_DETAIL;
  const report = m.replay_data;
  const events = report?.event_log ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className={cn("border-2 bg-zinc-900/80", "border-emerald-500/40")}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-zinc-100 flex items-center gap-2"><Swords className="w-5 h-5" /> 对战战报</CardTitle>
                <p className="text-sm text-zinc-500 mt-1">{MODE_LABEL[m.mode]} · 模拟数据</p>
              </div>
              <span className="text-lg font-bold px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400">胜利</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[{ label: "你", user: m.p1, slot: "p1" }, { label: "对手", user: m.p2, slot: "p2" }].map(({ label, user, slot }) => (
                <div key={slot} className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1"><User className="w-3 h-3" />{label}</div>
                  <p className="font-medium text-zinc-100">{user.username}</p>
                  <p className="text-xs text-zinc-500">{FACTION_LABEL[user.deck_faction ?? ""] ?? "?"} · ELO {user.elo}</p>
                  {report?.players?.[slot as "p1" | "p2"]?.final_hp != null && (
                    <p className="text-xs text-zinc-500">终局 HP {report.players[slot as "p1" | "p2"]!.final_hp}</p>
                  )}
                  {slot === "p1" && report?.elo_changes && (
                    <p className={cn("text-sm font-mono font-bold mt-1", report.elo_changes.p1 > 0 ? "text-emerald-400" : "text-red-400")}>
                      ELO {report.elo_changes.p1 > 0 ? "+" : ""}{report.elo_changes.p1}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
              <span>共 {m.turns_played} 回合</span>
              <span>结束方式：{END_REASON_LABEL[m.end_reason ?? ""] ?? m.end_reason}</span>
              {report?.summary && <span>事件 {report.summary.total_events} 条</span>}
            </div>
          </CardContent>
        </Card>

        {/* Action Stats */}
        {report?.summary?.action_counts && (
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardHeader className="pb-2"><CardTitle className="text-base text-zinc-200 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> 动作统计</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.summary.action_counts).map(([action, count]) => (
                  <span key={action} className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {ACTION_LABEL[action] || action} × {count}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Log */}
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center gap-2"><ScrollText className="w-4 h-4" /> 对局日志 <span className="text-xs font-normal text-zinc-500">({events.length} 条)</span></CardTitle>
          </CardHeader>
          <CardContent>
            {events.map((ev, i) => (
              <div key={i} className="flex gap-3 py-2 border-b border-zinc-800/80 last:border-0 text-sm">
                <span className="text-zinc-600 font-mono text-xs w-8 shrink-0 pt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", ev.player === "p1" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400")}>{ev.player.toUpperCase()}</span>
                    <span className="text-xs text-zinc-500">{ev.phase}</span>
                    {ev.turn != null && <span className="text-xs text-zinc-600">T{ev.turn}</span>}
                    <span className="text-zinc-300 font-medium">{ACTION_LABEL[ev.action] || ev.action}</span>
                  </div>
                  {ev.detail && <p className="text-xs text-zinc-500 mt-0.5 break-words">{ev.detail}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Shop Preview --- */
type ShopPackItem = (typeof SHOP_PACKS)[number];

interface MockPackAnimation {
  cards: PackResultCard[];
  packName: string;
  packId: string;
  withSelector?: boolean;
}

function startMockOpen(pack: ShopPackItem): MockPackAnimation {
  return {
    cards: MOCK_OPEN_BY_PACK[pack.id] ?? MOCK_OPEN_BY_PACK.basic,
    packName: pack.name,
    packId: pack.id,
    withSelector: "hasSelector" in pack && pack.hasSelector === true,
  };
}

function ShopPreview() {
  const [confirmPack, setConfirmPack] = useState<ShopPackItem | null>(null);
  const [animation, setAnimation] = useState<MockPackAnimation | null>(null);

  const openPack = (pack: ShopPackItem) => {
    setConfirmPack(null);
    setAnimation(startMockOpen(pack));
  };

  const selectorMode: SelectorModeProps | undefined = animation?.withSelector
    ? {
        onSkip: () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 400);
          }),
        onReroll: async (slot) =>
          toPackResultCard(COLLECTION_CARDS[3], slot, true),
      }
    : undefined;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-8 h-8" /> 卡牌商店
          </h1>
          <p className="text-muted-foreground mt-1">购买卡包，扩充你的收藏（演示模式含完整开包动画）</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">当前余额</div>
          <div className="text-2xl font-bold text-yellow-400">
            2500 <span className="text-sm">墨水</span>
          </div>
          <div className="text-lg font-semibold text-cyan-400">
            1185 <span className="text-xs">ELO</span>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900/60 border-purple-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            快速预览开包动画
          </CardTitle>
          <CardDescription className="text-xs">
            无需购买，直接播放各类型卡包的开包流程（自选包含重抽界面）
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SHOP_PACKS.map((pack) => (
            <Button
              key={pack.id}
              variant="outline"
              size="sm"
              className="border-zinc-600 text-xs"
              onClick={() => openPack(pack)}
            >
              {pack.icon} {pack.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SHOP_PACKS.filter((p) => p.id !== "battle_drop").map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className={cn(
                pack.border,
                "bg-gradient-to-br",
                pack.gradient,
                "hover:scale-105 transition-transform relative"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">{pack.icon}</span>
                    {pack.name}
                  </CardTitle>
                  {pack.costType === "elo" && (
                    <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                      ELO
                    </span>
                  )}
                </div>
                <CardDescription className="leading-relaxed">{pack.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">包含卡牌</span>
                    <span className="font-bold">{pack.cards} 张</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">价格</span>
                    <span
                      className={cn(
                        "font-bold",
                        pack.costType === "elo" ? "text-cyan-400" : "text-yellow-400"
                      )}
                    >
                      {pack.cost} {pack.costType === "elo" ? "ELO" : "墨水"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => setConfirmPack(pack)}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      购买
                    </Button>
                    <Button variant="outline" className="shrink-0" onClick={() => openPack(pack)}>
                      试开
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {confirmPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setConfirmPack(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold">确认购买</h2>
              <p className="text-sm text-zinc-400">
                {confirmPack.icon} {confirmPack.name} — {confirmPack.cost}{" "}
                {confirmPack.costType === "elo" ? "ELO" : "墨水"}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setConfirmPack(null)}>
                  取消
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-500" onClick={() => openPack(confirmPack)}>
                  确认并开包
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {animation && (
        <PackOpeningAnimation
          cards={animation.cards}
          packName={animation.packName}
          packId={animation.packId}
          selectorMode={selectorMode}
          onClose={() => setAnimation(null)}
        />
      )}
    </div>
  );
}

/* --- Collection Preview --- */
function CollectionPreview() {
  const owned = new Set(["c1", "c3", "c5", "c7"]);
  const [search, setSearch] = useState("");
  const filtered = COLLECTION_CARDS.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="text-sm text-muted-foreground">已收集 <span className="text-foreground font-semibold">{owned.size}</span> / {COLLECTION_CARDS.length}</span>
          <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full" style={{ width: `${(owned.size / COLLECTION_CARDS.length) * 100}%` }} />
          </div>
        </div>
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索卡牌..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground self-center" />
        {["全部势力", "全部稀有度", "全部费用", "全部类型", "全部"].map(label => (
          <select key={label} className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none">
            <option>{label}</option>
          </select>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-10">没有匹配的卡牌</p>
        )}
        {filtered.map(card => {
          const isOwned = owned.has(card.id);
          const r = card.rarity || "common";
          return (
            <motion.div key={card.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className={cn("relative aspect-[3/4] rounded-lg border-2 overflow-hidden bg-gradient-to-b p-3 flex flex-col justify-between cursor-pointer",
                RARITY_COLORS[r], RARITY_BG[r],
                !isOwned && "opacity-50 grayscale")}>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase">{RARITY_LABEL[r]}</p>
                <p className="text-xs font-bold text-white mt-1">{card.name}</p>
                <p className="text-[10px] text-zinc-400">{FACTION_LABEL[card.faction_code] ?? card.faction_code}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sky-300 font-mono">{card.cost}费</span>
                <span className="text-[10px] text-zinc-500">{card.card_type}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* --- Decks Preview --- */
function DecksPreview() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Briefcase className="w-7 h-7 text-blue-400" /> 我的卡组</CardTitle>
              <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> 创建新卡组</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MOCK_DECKS.map(deck => (
                <Card key={deck.id} className="border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 hover:border-blue-500/40 transition-all">
                  <CardHeader>
                    <CardTitle className="text-zinc-100 text-lg flex items-start justify-between">
                      <span className="flex items-center gap-2"><span className="text-2xl">🃏</span>{deck.name}</span>
                      <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                    </CardTitle>
                    <CardDescription className="text-zinc-400 flex items-center gap-2"><Layers className="w-4 h-4" /><span>{deck.card_count} 张卡牌</span></CardDescription>
                  </CardHeader>
                  <CardContent><Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">编辑卡组</Button></CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Leaderboard Preview --- */
function LeaderboardPreview() {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-zinc-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-zinc-500 font-mono text-sm w-6 text-center">#{rank}</span>;
  };
  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30";
    if (rank === 2) return "bg-gradient-to-r from-zinc-700/30 to-zinc-800/30 border-zinc-500/30";
    if (rank === 3) return "bg-gradient-to-r from-amber-700/10 to-orange-700/10 border-amber-700/30";
    return "bg-zinc-900 border-zinc-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader><CardTitle className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Trophy className="w-7 h-7 text-yellow-400" /> 天梯排行榜</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {MOCK_LEADERBOARD.map(entry => (
              <div key={entry.rank} className={cn("flex items-center justify-between p-4 rounded-lg border transition-all hover:scale-[1.01]", getRankStyle(entry.rank))}>
                <div className="flex items-center gap-4">{getRankIcon(entry.rank)}<p className="text-zinc-100 font-medium">{entry.username}</p></div>
                <div className="text-right"><p className="text-2xl font-bold text-emerald-400">{entry.elo}</p><p className="text-xs text-zinc-500">ELO</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function UIVerifyPage() {
  const [tab, setTab] = useState<TabId>("battle");

  if (!DEMO_MODE_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-bold text-zinc-200">UI 验证页未启用</h1>
          <p className="text-sm text-zinc-500">
            请在环境变量中设置 <code className="text-amber-400">NEXT_PUBLIC_DEMO_MODE=true</code> 后重启前端服务。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top nav bar */}
      <nav className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-lg font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              CampusKards UI 验证
            </h1>
            <span className="text-[10px] text-amber-500/80 ml-auto">演示模式 · 纯前端 Mock</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  tab === t.id ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                )}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content area */}
      <main className="flex-1">
        {tab === "battle" && <BattlePreview />}
        {tab === "matchmaking" && <MatchmakingPreview />}
        {tab === "history" && <HistoryPreview />}
        {tab === "report" && <ReportPreview />}
        {tab === "shop" && <ShopPreview />}
        {tab === "collection" && <CollectionPreview />}
        {tab === "decks" && <DecksPreview />}
        {tab === "leaderboard" && <LeaderboardPreview />}
      </main>
    </div>
  );
}
