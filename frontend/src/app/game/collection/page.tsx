"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cardsApi, collectionApi, ApiError } from "@/lib/api";
import { CardDetailModal } from "@/components/game/card-detail-modal";
import CardPlaceholder from "@/components/game/card-placeholder";
import { useAuth } from "@/lib/auth-context";
import type { Card, UserCardOwnership, UpgradeResult } from "@/types";
import { cn } from "@/lib/utils";
import { FACTION_LABEL } from "@/lib/faction-labels";

const RARITY_COLORS: Record<string, string> = {
  common: "border-zinc-500/40",
  uncommon: "border-green-500/40",
  rare: "border-blue-500/40",
  epic: "border-purple-500/40",
  legendary: "border-yellow-500/40",
};

const RARITY_BG: Record<string, string> = {
  common: "from-zinc-800/50 to-zinc-900/80",
  uncommon: "from-green-900/30 to-green-950/60",
  rare: "from-blue-900/30 to-blue-950/60",
  epic: "from-purple-900/30 to-purple-950/60",
  legendary: "from-yellow-900/30 to-amber-950/60",
};

const RARITY_GLOW: Record<string, string> = {
  common: "",
  uncommon: "shadow-green-500/10",
  rare: "shadow-blue-500/20",
  epic: "shadow-purple-500/30",
  legendary: "shadow-yellow-500/40",
};

const PAGE_SIZE = 12;

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

const RARITY_EMOJI: Record<string, string> = {
  legendary: "👑",
  epic: "🔮",
  rare: "💎",
  uncommon: "✨",
  common: "⚪",
};

/** Merge catalog cards with nested card objects from the user's collection. */
function buildCollectionState(
  catalog: Card[],
  owned: UserCardOwnership[],
): {
  cards: Card[];
  ownedSet: Set<string>;
  ownedMap: Map<string, UserCardOwnership>;
} {
  const byId = new Map<string, Card>();
  for (const card of catalog) {
    byId.set(String(card.id), card);
  }

  const ownedSet = new Set<string>();
  const ownedMap = new Map<string, UserCardOwnership>();
  for (const entry of owned) {
    const id = String(entry.card_id);
    ownedSet.add(id);
    ownedMap.set(id, entry);
    if (entry.card) {
      const cardId = String(entry.card.id ?? entry.card_id);
      if (!byId.has(cardId)) {
        byId.set(cardId, entry.card);
      }
    }
  }

  return { cards: Array.from(byId.values()), ownedSet, ownedMap };
}

function matchesCardType(cardType: string, filter: string): boolean {
  if (!filter) return true;
  const normalized = cardType.toLowerCase();
  const aliases: Record<string, string[]> = {
    unit: ["unit", "character"],
    spell: ["spell", "event", "command", "buff"],
    building: ["building"],
    counter: ["counter", "snitch"],
  };
  const allowed = aliases[filter] ?? [filter];
  return allowed.includes(normalized);
}

export default function CollectionPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [ownedSet, setOwnedSet] = useState<Set<string>>(new Set());
  const [ownedMap, setOwnedMap] = useState<Map<string, UserCardOwnership>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    faction: "",
    rarity: "",
    cost: "",
    type: "",
    owned: "",
  });
  const { user, setUserInk } = useAuth();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [allCardsRes, ownedRes] = await Promise.all([
        cardsApi.list({ all: true, fetchAll: true }),
        collectionApi.list(),
      ]);

      const { cards: merged, ownedSet: ids, ownedMap: map } = buildCollectionState(
        allCardsRes.items ?? [],
        ownedRes ?? [],
      );
      setCards(merged);
      setOwnedSet(ids);
      setOwnedMap(map);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "加载图鉴失败，请稍后重试";
      setFetchError(msg);
      console.error("Failed to fetch collection:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => {
        if (c.is_token) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!c.name.toLowerCase().includes(q) && !c.name_en?.toLowerCase().includes(q)) return false;
        }
        if (filters.faction && c.faction_code !== filters.faction) return false;
        if (filters.rarity && c.rarity !== filters.rarity) return false;
        if (filters.cost && c.cost !== Number(filters.cost)) return false;
        if (filters.type && !matchesCardType(c.card_type, filters.type)) return false;
        if (filters.owned === "owned" && !ownedSet.has(String(c.id))) return false;
        if (filters.owned === "unowned" && ownedSet.has(String(c.id))) return false;
        return true;
      })
      .sort((a, b) => {
        const aOwned = ownedSet.has(String(a.id)) ? 0 : 1;
        const bOwned = ownedSet.has(String(b.id)) ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        return (RARITY_ORDER[a.rarity || "common"] ?? 4) - (RARITY_ORDER[b.rarity || "common"] ?? 4);
      });
  }, [cards, ownedSet, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const pagedCards = filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setModalOpen(true);
  };

  const handleUpgradeSuccess = async (result: UpgradeResult) => {
    setUserInk(result.ink_remaining);
    // Refresh collection data
    await fetchData();
  };

  const ownedCount = ownedSet.size;
  const totalCount = cards.filter((c) => !c.is_token).length;

  return (
    <div className="min-h-screen bg-background text-foreground">

      <div className="flex">

        <main className="flex-1">
          <div className="p-6">
            {/* Stats Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-muted-foreground">
                    已收集 <span className="text-foreground font-semibold">{ownedCount}</span> / {totalCount}
                  </span>
                </div>
                {ownedCount > 0 && (
                  <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(ownedCount / totalCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索卡牌..."
                  value={filters.search}
                  onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />

              <select
                value={filters.faction}
                onChange={(e) => { setFilters((f) => ({ ...f, faction: e.target.value })); setPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              >
                <option value="">全部势力</option>
                {Object.entries(FACTION_LABEL)
                  .filter(([code]) => code.endsWith("_class") || code === "neutral")
                  .map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
              </select>

              <select
                value={filters.rarity}
                onChange={(e) => { setFilters((f) => ({ ...f, rarity: e.target.value })); setPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              >
                <option value="">全部稀有度</option>
                <option value="common">普通</option>
                <option value="uncommon">稀有</option>
                <option value="rare">史诗</option>
                <option value="epic">传说</option>
                <option value="legendary">传奇</option>
              </select>

              <select
                value={filters.cost}
                onChange={(e) => { setFilters((f) => ({ ...f, cost: e.target.value })); setPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              >
                <option value="">全部费用</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}费</option>
                ))}
              </select>

              <select
                value={filters.type}
                onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              >
                <option value="">全部类型</option>
                <option value="unit">单位</option>
                <option value="spell">法术/事件</option>
                <option value="counter">反击</option>
              </select>

              <select
                value={filters.owned}
                onChange={(e) => { setFilters((f) => ({ ...f, owned: e.target.value })); setPage(1); }}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              >
                <option value="">全部</option>
                <option value="owned">已拥有</option>
                <option value="unowned">未拥有</option>
              </select>
            </div>

            {fetchError && (
              <div className="mb-6 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300 flex items-center justify-between gap-4">
                <span>{fetchError}</span>
                <button
                  type="button"
                  onClick={fetchData}
                  className="shrink-0 px-3 py-1 rounded bg-red-900/50 hover:bg-red-900 text-red-100"
                >
                  重试
                </button>
              </div>
            )}

            {/* Card Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : pagedCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-lg text-muted-foreground">没有找到匹配的卡牌</p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.03 } },
                }}
              >
                {pagedCards.map((card) => {
                  const isOwned = ownedSet.has(String(card.id));
                  const ownership = ownedMap.get(String(card.id));
                  const rarity = card.rarity || "common";

                  return (
                    <motion.div
                      key={card.id}
                      variants={{
                        hidden: { opacity: 0, scale: 0.9 },
                        visible: { opacity: 1, scale: 1 },
                      }}
                    >
                      <CardPlaceholder
                        card={card}
                        isOwned={isOwned}
                        onClick={() => handleCardClick(card)}
                        className={cn(
                          RARITY_COLORS[rarity],
                          RARITY_BG[rarity] && `bg-gradient-to-b ${RARITY_BG[rarity]}`,
                          RARITY_GLOW[rarity] && `shadow-lg ${RARITY_GLOW[rarity]}`,
                          !isOwned && "opacity-50 grayscale"
                        )}
                      >
                        {/* Rarity emoji - top left */}
                        <div className="absolute top-1.5 left-1.5 text-lg z-10 pointer-events-none select-none">
                          {RARITY_EMOJI[rarity] ?? "⚪"}
                        </div>
                        {/* Card name overlay - bottom half */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-1.5 px-2 pointer-events-none">
                          <span className="text-[11px] font-bold text-white leading-tight line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {card.name}
                          </span>
                        </div>
                        {/* Level badge */}
                        {ownership?.level && ownership.level > 1 && (
                          <div className="absolute top-1 left-1 bg-gradient-to-r from-yellow-600 to-orange-600 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-lg z-10">
                            Lv{ownership.level}
                          </div>
                        )}
                        {/* Fragments indicator */}
                        {ownership?.fragments && ownership.fragments > 0 && (
                          <div className="absolute bottom-11 left-1 right-1 text-center z-10">
                            <span className="text-[9px] bg-purple-900/80 text-purple-200 px-1.5 py-0.5 rounded">
                              🔷{ownership.fragments}
                            </span>
                          </div>
                        )}
                        {/* Count badge for duplicates */}
                        {(ownership?.count ?? 0) > 1 && (
                          <div className="absolute top-1 right-1 bg-blue-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-lg">
                            ×{ownership!.count}
                          </div>
                        )}
                      </CardPlaceholder>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-muted border border-border disabled:opacity-30 hover:bg-accent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                    if (p === page - 3 || p === page + 3)
                      return <span key={p} className="px-1 text-muted-foreground">…</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border hover:bg-accent"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-muted border border-border disabled:opacity-30 hover:bg-accent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <CardDetailModal
            card={selectedCard}
            ownership={selectedCard ? ownedMap.get(String(selectedCard.id)) : null}
            open={modalOpen}
            onOpenChange={setModalOpen}
            onUpgradeSuccess={handleUpgradeSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
