"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { storyApi, decksApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useMatchStore } from "@/store/useMatchStore";
import type { StoryLevelDetail, DeckListItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Star, Swords, Coins, Gift, AlertTriangle, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/lib/story-constants";

export default function PreBattlePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentGame } = useMatchStore();

  const chapterId = params.chapterId as string;
  const levelId = params.levelId as string;

  const [level, setLevel] = useState<StoryLevelDetail | null>(null);
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [levelId]);

  async function loadData() {
    setLoading(true);
    try {
      const [levelData, deckList] = await Promise.all([
        storyApi.getLevelDetail(levelId),
        decksApi.list(),
      ]);
      setLevel(levelData);
      setDecks(deckList);
      if (deckList.length > 0) {
        setSelectedDeckId(deckList[0].id);
      }
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    if (!selectedDeckId) return;
    setStarting(true);
    setError(null);
    try {
      const result = await storyApi.startLevel(selectedDeckId, levelId);
      setCurrentGame(result.match_id, {
        id: "bot",
        username: result.enemy_name,
        elo: (user?.elo ?? 1000),
      });
      router.push(`/game/play?matchId=${result.match_id}&mode=story&levelId=${levelId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "创建对局失败");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error && !level) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={() => router.push(`/game/story/${chapterId}`)} variant="outline">返回</Button>
      </div>
    );
  }

  if (!level) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        {/* Back */}
        <Link href={`/game/story/${chapterId}`} className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回关卡列表
        </Link>

        {/* Enemy card */}
        <Card className="border-zinc-800 bg-zinc-900/70 overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-5 py-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
              <Swords className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-zinc-100">{level.enemy_name}</p>
              <p className="text-sm text-zinc-400">
                关{level.level_num}: {level.title}
              </p>
            </div>
            <span className={cn("ml-auto px-2.5 py-1 rounded-full text-xs font-medium border", DIFFICULTY_COLORS[level.difficulty])}>
              {DIFFICULTY_LABELS[level.difficulty]}
            </span>
          </div>
        </Card>

        {/* Star conditions */}
        {level.star_conditions && level.star_conditions.length > 0 && (
          <Card className="border-zinc-800 bg-zinc-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                星级条件
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {level.star_conditions.map((sc, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                      idx === 0 ? "bg-amber-500/20 text-amber-400" :
                      idx === 1 ? "bg-zinc-700 text-zinc-400" :
                      "bg-orange-500/20 text-orange-400",
                    )}>
                      {idx + 1}
                    </span>
                    <span>{sc.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Special rules */}
        {level.special_rules && Object.values(level.special_rules).some(v => v) && (
          <Card className="border-orange-500/20 bg-orange-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                特殊规则
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs text-orange-300/80">
                {level.special_rules.starting_ink && level.special_rules.starting_ink > 1 && (
                  <p>· 初始墨水: {level.special_rules.starting_ink}</p>
                )}
                {level.special_rules.enemy_ink_bonus && level.special_rules.enemy_ink_bonus > 0 && (
                  <p>· 敌方额外墨水 +{level.special_rules.enemy_ink_bonus}</p>
                )}
                {level.special_rules.enemy_hq_hp_bonus && level.special_rules.enemy_hq_hp_bonus > 0 && (
                  <p>· 敌方HQ额外生命 +{level.special_rules.enemy_hq_hp_bonus}</p>
                )}
                {level.special_rules.banned_factions && level.special_rules.banned_factions.length > 0 && (
                  <p>· 禁用势力: {level.special_rules.banned_factions.join(", ")}</p>
                )}
                {level.special_rules.passive_effects?.player && (
                  <p>· 玩家: {level.special_rules.passive_effects.player}</p>
                )}
                {level.special_rules.passive_effects?.enemy && (
                  <p>· 敌方: {level.special_rules.passive_effects.enemy}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rewards preview */}
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" />
              首通奖励
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Coins className="w-3.5 h-3.5" />
                <span>{level.rewards.ink} 墨水</span>
              </div>
              {level.rewards.cards.length > 0 && (
                <div className="flex items-center gap-1.5 text-purple-300">
                  <Gift className="w-3.5 h-3.5" />
                  <span>+{level.rewards.cards.length} 张卡牌</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deck selection */}
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              选择出战卡组
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decks.length === 0 ? (
              <p className="text-sm text-zinc-500">暂无可用卡组，请先创建卡组</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => setSelectedDeckId(deck.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                      selectedDeckId === deck.id
                        ? "border-amber-400 bg-amber-950/30 text-amber-300"
                        : "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500",
                    )}
                  >
                    {deck.name} ({deck.card_count ?? 0})
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start button */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button
          onClick={handleStart}
          disabled={!selectedDeckId || starting}
          className="w-full py-6 text-base font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
        >
          {starting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Swords className="w-5 h-5 mr-2" />
          )}
          {starting ? "正在创建对局..." : "开始挑战"}
        </Button>
      </div>
    </div>
  );
}
