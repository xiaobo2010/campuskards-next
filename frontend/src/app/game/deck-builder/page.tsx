"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collectionApi, decksApi } from "@/lib/api";
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
import { DeckDropZone, DeckLibraryCard } from "@/components/game/deck-drop-zone";

const DECK_SIZE = 30;
const UNIT_MAX = 22;
const EFFECT_MAX = 20;
const COUNTER_MAX = 10;
const MAX_COPIES = 3;

type TypeFilter = "all" | "Unit" | "Effect" | "Counter";

function getCategory(cardType: string): "Unit" | "Effect" | "Counter" {
  const t = cardType.toLowerCase();
  if (t === "counter") return "Counter";
  if (t === "command" || t === "buff" || t === "effect" || t === "spell") return "Effect";
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

  const [cards, setCards] = useState<Card[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [creating, setCreating] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const cardMap = useMemo(() => {
    const map: Record<string, Card> = {};
    cards.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [cards]);

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

  const copyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedCardIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [selectedCardIds]);

  const deckSize = selectedCardIds.length;
  const warnings: string[] = [];
  if (deckSize > 0 && deckSize < DECK_SIZE)
    warnings.push(`卡组需要 ${DECK_SIZE} 张牌，当前 ${deckSize} 张`);
  if (deckSize > DECK_SIZE) warnings.push(`卡组不能超过 ${DECK_SIZE} 张`);
  if (categoryCounts.unit > UNIT_MAX)
    warnings.push(`生物牌超过 ${UNIT_MAX} 张上限`);
  if (categoryCounts.effect > EFFECT_MAX)
    warnings.push(`效果牌超过 ${EFFECT_MAX} 张上限`);
  if (categoryCounts.counter > COUNTER_MAX)
    warnings.push(`反击牌超过 ${COUNTER_MAX} 张上限`);

  const loadCards = useCallback(() => {
    setCardsLoading(true);
    setCardsError(null);
    collectionApi
      .list()
      .then((items) => {
        const cardList = (items ?? []).map((uc: UserCardOwnership) => ({
          id: uc.card?.id ?? uc.card_id,
          name: uc.card?.name ?? "未知",
          card_type: uc.card?.card_type ?? "unit",
          faction_code: uc.card?.faction_code ?? "neutral",
          cost: uc.card?.cost ?? 0,
          power: uc.card?.power ?? null,
          grit: uc.card?.grit ?? null,
          spirit: uc.card?.spirit ?? null,
          effect_text: uc.card?.effect_text ?? null,
          rarity: uc.card?.rarity ?? "common",
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

  const filteredCards = useMemo(() => {
    if (typeFilter === "all") return cards;
    return cards.filter((c) => getCategory(c.card_type) === typeFilter);
  }, [cards, typeFilter]);

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const copyCount = prev.filter((id) => id === cardId).length;
      if (copyCount > 0) {
        const idx = prev.lastIndexOf(cardId);
        return prev.filter((_, i) => i !== idx);
      }
      const card = cardMap[cardId];
      if (!card) return prev;
      if (prev.length >= DECK_SIZE) {
        toast.error(`卡组已满（${DECK_SIZE} 张）`);
        return prev;
      }
      if (copyCount >= MAX_COPIES) {
        toast.error(`单卡最多 ${MAX_COPIES} 张`);
        return prev;
      }
      const cat = getCategory(card.card_type);
      const catKey = cat === "Unit" ? "unit" : cat === "Effect" ? "effect" : "counter";
      const limit = catKey === "unit" ? UNIT_MAX : catKey === "effect" ? EFFECT_MAX : COUNTER_MAX;
      const current = prev.filter((id) => cardMap[id] && getCategory(cardMap[id].card_type) === cat).length;
      if (current >= limit) {
        const catName = cat === "Unit" ? "生物" : cat === "Effect" ? "效果" : "反击";
        toast.error(`${catName}牌已达上限 (${limit})`);
        return prev;
      }
      return [...prev, cardId];
    });
  };

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
      await decksApi.create(req);
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
    <div className="space-y-4">
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

      <DeckDropZone
        selectedCardIds={selectedCardIds}
        cardMap={cardMap}
        maxCards={DECK_SIZE}
        limits={{ unit: UNIT_MAX, effect: EFFECT_MAX, counter: COUNTER_MAX }}
        counts={categoryCounts}
        onChange={setSelectedCardIds}
      >
        {warnings.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-amber-900/20 border border-amber-900/50 mt-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex flex-wrap gap-2 text-sm text-amber-300">
              {warnings.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
          </div>
        )}

        <CardComponent className="mt-4">
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
                  <RefreshCw className={cn("h-3 w-3", cardsLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              拖拽或点击添加卡牌（单卡最多 {MAX_COPIES} 张）· 生物 {categoryCounts.unit}/{UNIT_MAX} ·
              效果 {categoryCounts.effect}/{EFFECT_MAX} · 反击 {categoryCounts.counter}/{COUNTER_MAX}
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
                {filteredCards.map((card) => (
                  <DeckLibraryCard
                    key={card.id}
                    card={card}
                    isSelected={(copyCounts[card.id] ?? 0) > 0}
                    copyCount={copyCounts[card.id] ?? 0}
                    onClick={() => toggleCard(card.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CardComponent>
      </DeckDropZone>
    </div>
  );
}
