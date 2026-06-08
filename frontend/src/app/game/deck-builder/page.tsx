"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  collectionApi,
  decksApi,
} from "@/lib/api";
import type { Card, DeckCreateRequest, UserCardOwnership } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card as CardComponent,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Package, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeckDropZone } from "@/components/game/deck-drop-zone";

const DECK_SIZE = 30;
const UNIT_MAX = 22;
const EFFECT_MAX = 20;
const COUNTER_MAX = 10;

type TypeFilter = "all" | "Unit" | "Effect" | "Counter";

function getCategory(cardType: string): "Unit" | "Effect" | "Counter" {
  const t = cardType.toLowerCase();
  if (t === "counter") return "Counter";
  if (t === "command" || t === "buff") return "Effect";
  return "Unit";
}

function inferFactionCode(cardIds: string[], cardMap: Record<string, Card>): string {
  const counts: Record<string, number> = {};
  for (const id of cardIds) {
    const code = cardMap[id]?.faction_code;
    if (code) counts[code] = (counts[code] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "key_class";
}

export default function DeckBuilderPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Card library state
  const [cards, setCards] = useState<Card[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // Deck creation state
  const [newDeckName, setNewDeckName] = useState("");
  const [creating, setCreating] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Drag state
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  // Selection state: array of card IDs (in selection order)
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  // DndKit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Card map for DeckDropZone
  const cardMap = useMemo(() => {
    const map: Record<string, Card> = {};
    cards.forEach((c) => { map[c.id] = c; });
    return map;
  }, [cards]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { unit: 0, effect: 0, counter: 0 };
    selectedCardIds.forEach((id) => {
      const card = cardMap[id];
      if (card) {
        const cat = getCategory(card.card_type);
        if (cat === "Unit") counts.unit++;
        else if (cat === "Effect") counts.effect++;
        else counts.counter++;
      }
    });
    return counts;
  }, [selectedCardIds, cardMap]);

  const deckSize = selectedCardIds.length;
  const warnings: string[] = [];
  if (deckSize > 0 && deckSize < DECK_SIZE)
    warnings.push(`卡组需要 ${DECK_SIZE} 张牌，当前 ${deckSize} 张`);
  if (deckSize > DECK_SIZE)
    warnings.push(`卡组不能超过 ${DECK_SIZE} 张`);
  if (categoryCounts.unit > UNIT_MAX)
    warnings.push(`生物牌超过 ${UNIT_MAX} 张上限`);
  if (categoryCounts.effect > EFFECT_MAX)
    warnings.push(`效果牌超过 ${EFFECT_MAX} 张上限`);
  if (categoryCounts.counter > COUNTER_MAX)
    warnings.push(`反击牌超过 ${COUNTER_MAX} 张上限`);

  // Load user's collection
  const loadCards = useCallback(() => {
    setCardsLoading(true);
    setCardsError(null);
    collectionApi
      .list()
      .then((items) => {
        const cardList = (items ?? []).map((uc: UserCardOwnership) => ({
          id: uc.card?.id ?? uc.card_id,
          name: uc.card?.name ?? "未知",
          card_type: uc.card?.card_type ?? "Unit",
          faction_code: uc.card?.faction_code ?? "neutral",
          cost: uc.card?.cost ?? 0,
          power: uc.card?.power ?? null,
          grit: uc.card?.grit ?? null,
          spirit: uc.card?.spirit ?? null,
          effect_text: uc.card?.effect_text ?? null,
          rarity: uc.card?.rarity ?? "Common",
          image_url: uc.card?.image_url ?? null,
        }));
        setCards(cardList);
      })
      .catch((err) => setCardsError(err.message || "加载卡牌失败"))
      .finally(() => setCardsLoading(false));
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Type filter
  const filteredCards = useMemo(() => {
    if (typeFilter === "all") return cards;
    return cards.filter((c) => getCategory(c.card_type) === typeFilter);
  }, [cards, typeFilter]);

  // DndKit handlers
  const handleDragStart = (event: DragStartEvent) => {
    const cardId = event.active.id as string;
    const card = cardMap[cardId];
    if (card) setActiveCard(card);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const draggedCardId = active.id as string;
    const card = cardMap[draggedCardId];
    if (!card) return;

    // If dragged over the drop zone area (over.id starts with "deck-slot" or "deck-drop-zone")
    const overId = String(over.id);

    // Card is from library (not already in deck) → add to deck
    if (!selectedCardIds.includes(draggedCardId)) {
      // Validate category limit
      const cat = getCategory(card.card_type);
      const catKey = cat === "Unit" ? "unit" : cat === "Effect" ? "effect" : "counter";
      const limit = catKey === "unit" ? UNIT_MAX : catKey === "effect" ? EFFECT_MAX : COUNTER_MAX;

      if (categoryCounts[catKey] >= limit) {
        const catName = cat === "Unit" ? "生物" : cat === "Effect" ? "效果" : "反击";
        toast.error(`${catName}牌已达上限 (${limit})`);
        return;
      }

      setSelectedCardIds((prev) => [...prev, draggedCardId]);
    }
  };

  // Deck card change handler from DeckDropZone
  const handleDeckChange = (newIds: string[]) => {
    setSelectedCardIds(newIds);
  };

  // Toggle card selection (click fallback)
  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      const card = cardMap[cardId];
      if (!card) return prev;
      const cat = getCategory(card.card_type);
      const catKey = cat === "Unit" ? "unit" : cat === "Effect" ? "effect" : "counter";
      const limit = catKey === "unit" ? UNIT_MAX : catKey === "effect" ? EFFECT_MAX : COUNTER_MAX;
      if (categoryCounts[catKey] >= limit) {
        const catName = cat === "Unit" ? "生物" : cat === "Effect" ? "效果" : "反击";
        toast.error(`${catName}牌已达上限 (${limit})`);
        return prev;
      }
      return [...prev, cardId];
    });
  };

  // Create deck
  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      toast.error("请输入卡组名称");
      return;
    }
    if (selectedCardIds.length !== DECK_SIZE) {
      toast.error(`卡组必须恰好 ${DECK_SIZE} 张卡牌`);
      return;
    }

    setCreating(true);
    try {
      const counts: Record<string, number> = {};
      for (const id of selectedCardIds) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
      const req: DeckCreateRequest = {
        name: newDeckName.trim(),
        faction_code: inferFactionCode(selectedCardIds, cardMap),
        cards: Object.entries(counts).map(([card_id, quantity]) => ({ card_id, quantity })),
      };
      const created = await decksApi.create(req);
      toast.success("卡组创建成功！");
      setNewDeckName("");
      setSelectedCardIds([]);
      router.push("/game/decks");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建失败";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  if (!user) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Top bar: deck name input + confirm button */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="输入卡组名称..."
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="flex-1 bg-zinc-900 border-zinc-700"
          />
          <Button onClick={handleCreateDeck} disabled={creating}>
            {creating ? "创建中..." : "确认创建"}
          </Button>
        </div>

        {/* Drop Zone: selected cards area */}
        <DeckDropZone
          selectedCardIds={selectedCardIds}
          cardMap={cardMap}
          maxCards={DECK_SIZE}
          limits={{ unit: UNIT_MAX, effect: EFFECT_MAX, counter: COUNTER_MAX }}
          counts={categoryCounts}
          onChange={handleDeckChange}
        />

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-amber-900/20 border border-amber-900/50">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex flex-wrap gap-2 text-sm text-amber-300">
              {warnings.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Card Library */}
        <CardComponent>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">卡牌库</CardTitle>
                <span
                  className={cn(
                    "text-xs font-mono px-1.5 rounded",
                    deckSize < DECK_SIZE
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-emerald-900 text-emerald-300"
                  )}
                >
                  已选 {deckSize}/{DECK_SIZE}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {(["all", "Unit", "Effect", "Counter"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={typeFilter === f ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTypeFilter(f)}
                    className="h-7 text-xs px-2"
                  >
                    {f === "all"
                      ? "全部"
                      : f === "Unit"
                        ? "生物"
                        : f === "Effect"
                          ? "效果"
                          : "反击"}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1"
                  onClick={loadCards}
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3",
                      cardsLoading && "animate-spin"
                    )}
                  />
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              拖拽或点击添加卡牌 · 生物 {categoryCounts.unit}/{UNIT_MAX} ·
              效果 {categoryCounts.effect}/{EFFECT_MAX} · 反击{" "}
              {categoryCounts.counter}/{COUNTER_MAX}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            {cardsLoading && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            )}

            {cardsError && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {cardsError}
              </div>
            )}

            {!cardsLoading && !cardsError && cards.length === 0 && (
              <div className="text-center py-6 text-zinc-500 text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>你还没有任何卡牌</p>
                <p className="text-xs mt-1">去卡包商店抽一些吧！</p>
              </div>
            )}

            {!cardsLoading && !cardsError && cards.length > 0 && filteredCards.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">没有匹配的卡牌</p>
            )}

            {!cardsLoading && !cardsError && cards.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {filteredCards.slice(0, 24).map((card) => {
                  const isSelected = selectedCardIds.includes(card.id);
                  const cat = getCategory(card.card_type);
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setActiveCard(card)}
                      onDragEnd={() => setActiveCard(null)}
                      onClick={() => toggleCard(card.id)}
                      className={cn(
                        "relative p-2 rounded-lg border cursor-pointer transition-all select-none",
                        cat === "Unit"
                          ? "bg-emerald-950/30"
                          : cat === "Effect"
                            ? "bg-blue-950/30"
                            : "bg-amber-950/30",
                        isSelected
                          ? "border-emerald-500 ring-1 ring-emerald-500/50"
                          : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-500"
                      )}
                      data-dnd-draggable-id={card.id}
                    >
                      <p className="text-xs font-medium text-zinc-200 truncate">
                        {card.name}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {cat === "Unit" ? "🐾" : cat === "Effect" ? "✨" : "🛡️"}{" "}
                        {card.faction_code} · 💰{card.cost}
                      </p>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <span className="text-white text-[8px]">✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredCards.length > 24 && (
                  <p className="text-xs text-zinc-500 flex items-center justify-center">
                    还有 {filteredCards.length - 24} 张...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </CardComponent>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCard ? (
          <div className="w-20 p-2 rounded-lg border border-zinc-500 bg-zinc-800 shadow-xl opacity-90">
            <p className="text-xs font-medium text-zinc-200 truncate">
              {activeCard.name}
            </p>
            <p className="text-[10px] text-zinc-400">💰{activeCard.cost}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
