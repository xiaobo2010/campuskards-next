"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store as StoreIcon, ShoppingBag, Sparkles, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { shopApi, authApi, type PackDefinition, type PackOpenResult } from "@/lib/api";
import {
  PackOpeningAnimation,
  type PackResultCard,
  type SelectorModeProps,
} from "@/components/game/pack-opening-animation";
import { CheckInBanner } from "@/components/game/checkin-banner";

/** UI-only metadata keyed by pack id from backend */
const PACK_DISPLAY: Record<
  string,
  { icon: string; gradient: string; border: string; needsFaction?: boolean }
> = {
  basic: {
    icon: "📦",
    gradient: "from-blue-500/20 to-purple-500/20",
    border: "border-blue-500/30",
  },
  advanced: {
    icon: "✨",
    gradient: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-500/30",
  },
  selector: {
    icon: "🎯",
    gradient: "from-amber-500/20 to-red-500/20",
    border: "border-amber-500/30",
  },
  faction: {
    icon: "⚔️",
    gradient: "from-green-500/20 to-teal-500/20",
    border: "border-green-500/30",
    needsFaction: true,
  },
  prestige: {
    icon: "👑",
    gradient: "from-yellow-500/20 to-orange-500/20",
    border: "border-yellow-500/30",
  },
};

type ShopPack = PackDefinition & {
  type: string;
  cards: number;
  cost: number;
  costType?: "elo";
  icon: string;
  gradient: string;
  border: string;
  needsFaction?: boolean;
  requiresElo?: number;
};

function toShopPack(pack: PackDefinition): ShopPack {
  const display = PACK_DISPLAY[pack.id] ?? {
    icon: "📦",
    gradient: "from-zinc-500/20 to-zinc-600/20",
    border: "border-zinc-500/30",
  };
  const isElo = pack.cost_type === "elo";
  return {
    ...pack,
    type: pack.id,
    cards: pack.cards_count,
    cost: isElo ? (pack.price_elo ?? 0) : pack.price_ink,
    costType: isElo ? "elo" : undefined,
    requiresElo: pack.min_elo,
    ...display,
  };
}

interface AnimationState {
  cards: PackResultCard[];
  packName: string;
  rerollToken?: string;
  canReroll?: boolean;
}

function toResultCards(data: PackOpenResult): PackResultCard[] {
  return (
    data.cards?.map((c, i) => ({
      name: c.name || `卡牌 #${c.card_id}`,
      rarity: c.rarity || "common",
      faction: c.faction_code || "unknown",
      id: c.card_id,
      faction_code: c.faction_code,
      slot_index: c.slot_index ?? i,
      is_new: c.is_new,
    })) ?? []
  );
}

function invalidateShopQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["me"] });
  queryClient.invalidateQueries({ queryKey: ["balance"] });
  queryClient.invalidateQueries({ queryKey: ["cards", "owned"] });
  queryClient.invalidateQueries({ queryKey: ["collection"] });
}

export default function ShopPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ink, setInk] = useState(0);
  const [confirmPack, setConfirmPack] = useState<ShopPack | null>(null);
  const [faction, setFaction] = useState("");
  const [animation, setAnimation] = useState<AnimationState | null>(null);

  // Fetch real user data for ELO check
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: !!user,
  });

  const userElo = currentUser?.elo ?? 0;

  const { data: packList, isLoading: packsLoading } = useQuery({
    queryKey: ["shop-packs"],
    queryFn: () => shopApi.listPacks(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const packs: ShopPack[] = (packList ?? []).map(toShopPack);

  // Fetch ink balance
  const { data: balanceData } = useQuery({
    queryKey: ["balance"],
    queryFn: () => shopApi.getBalance(),
    enabled: !!user,
  });

  // Sync ink from balance API
  useEffect(() => {
    if (balanceData && typeof balanceData === "object" && "ink" in balanceData) {
      setInk((balanceData as { ink: number }).ink);
    }
  }, [balanceData]);

  // Buy pack mutation
  const buyPackMutation = useMutation({
    mutationFn: (params: {
      packType: string;
      faction?: string;
    }) => shopApi.openPack(params.packType, { faction_code: params.faction }),
    onSuccess: (data, variables) => {
      invalidateShopQueries(queryClient);

      if (typeof data.remaining_ink === "number") {
        setInk(data.remaining_ink);
      }

      const resultCards = toResultCards(data);

      if (resultCards.length > 0) {
        setAnimation({
          cards: resultCards,
          packName: packs.find((p) => p.type === variables?.packType)?.name ?? "卡包",
          rerollToken: data.can_reroll ? data.reroll_token ?? undefined : undefined,
          canReroll: data.can_reroll ?? false,
        });
      } else {
        toast.success("购买成功！", {
          description: `成功购买 ${packs.find((p) => p.type === variables?.packType)?.name ?? "卡包"}`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("购买失败", {
        description: error.message || "请重试",
      });
    },
  });

  const executeBuy = () => {
    if (!confirmPack) return;
    if (confirmPack.needsFaction && !faction) {
      toast.error("请选择势力");
      return;
    }
    const isElo = confirmPack.costType === "elo";
    if (isElo && userElo < confirmPack.cost) {
      toast.error("ELO 不足", {
        description: `需要 ${confirmPack.cost} ELO，当前仅有 ${userElo} ELO`,
      });
      return;
    }
    if (!isElo && ink < confirmPack.cost) {
      toast.error("墨水不足", {
        description: `需要 ${confirmPack.cost} 墨水，当前仅有 ${ink} 墨水`,
      });
      return;
    }
    buyPackMutation.mutate({
      packType: confirmPack.type,
      faction: confirmPack.needsFaction ? faction : undefined,
    });
    setConfirmPack(null);
  };

  const handleSelectorSkip = async (rerollToken: string) => {
    const data = await shopApi.selectorFinalize(rerollToken);
    invalidateShopQueries(queryClient);
    if (typeof data.remaining_ink === "number") setInk(data.remaining_ink);
    toast.success("开包完成！", { description: "已保留全部卡牌" });
  };

  const handleSelectorReroll = async (rerollToken: string, slotIndex: number) => {
    const data = await shopApi.selectorReroll(rerollToken, slotIndex);
    invalidateShopQueries(queryClient);
    if (typeof data.remaining_ink === "number") setInk(data.remaining_ink);
    const replaced = data.cards?.[slotIndex];
    toast.success("重抽成功！", {
      description: replaced?.name ? `第 ${slotIndex + 1} 张已替换为 ${replaced.name}` : undefined,
    });
  };

  const selectorMode: SelectorModeProps | undefined =
    animation?.canReroll && animation.rerollToken
      ? {
          onSkip: () => handleSelectorSkip(animation.rerollToken!),
          onReroll: (slot) => handleSelectorReroll(animation.rerollToken!, slot),
        }
      : undefined;

  return (
    <div className="p-6 space-y-6">
      {/* Check-in Banner */}
      <CheckInBanner
        onInkUpdate={(newInk) => setInk(newInk)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <StoreIcon className="w-8 h-8" />
            卡牌商店
          </h1>
          <p className="text-muted-foreground mt-1">购买卡包，扩充你的收藏</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">当前余额</div>
          <div className="text-2xl font-bold text-yellow-400">
            {ink} <span className="text-sm">墨水</span>
          </div>
          <div className="text-lg font-semibold text-cyan-400">
            {userElo} <span className="text-xs">ELO</span>
          </div>
        </div>
      </div>

      {/* Pack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packsLoading && (
          <div className="col-span-full text-center text-muted-foreground py-8">加载卡包...</div>
        )}
        {!packsLoading && packs.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">暂无可用卡包</div>
        )}
        {packs.map((pack, index) => {
          const isElo = pack.costType === "elo";
          const isLocked =
            isElo && pack.requiresElo != null && userElo < pack.requiresElo;
          const cantAfford = isElo
            ? userElo < pack.cost
            : ink < pack.cost;

          return (
            <motion.div
              key={pack.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`${pack.border} bg-gradient-to-br ${pack.gradient} hover:scale-105 transition-transform relative`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-3xl">{pack.icon}</span>
                      {pack.name}
                    </CardTitle>
                    {isElo && (
                      <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                        ELO
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                        🔒 需要 ELO≥{pack.requiresElo}
                      </span>
                    )}
                  </div>
                  <CardDescription className="leading-relaxed">
                    {pack.description}
                  </CardDescription>
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
                        className={`font-bold ${isElo ? "text-cyan-400" : "text-yellow-400"}`}
                      >
                        {pack.cost} {isElo ? "ELO" : "墨水"}
                      </span>
                    </div>
                    {isLocked ? (
                      <Button className="w-full" variant="outline" disabled>
                        🔒 ELO 不足（需≥{pack.requiresElo}）
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setConfirmPack(pack)}
                        disabled={cantAfford || buyPackMutation.isPending}
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        {cantAfford
                          ? isElo
                            ? "ELO 不足"
                            : "墨水不足"
                          : "购买"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog open={!!confirmPack} onOpenChange={() => setConfirmPack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认购买</DialogTitle>
            <DialogDescription>请确认以下购买信息</DialogDescription>
          </DialogHeader>
          {confirmPack && (() => {
            const isElo = confirmPack.costType === "elo";
            const currency = isElo ? "ELO" : "墨水";
            const currentBalance = isElo ? userElo : ink;
            const afterBalance = currentBalance - confirmPack.cost;
            return (
              <div className="space-y-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">卡包</span>
                  <span className="font-medium">
                    {confirmPack.icon} {confirmPack.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">价格</span>
                  <span
                    className={`font-bold ${isElo ? "text-cyan-400" : "text-yellow-400"}`}
                  >
                    {confirmPack.cost} {currency}
                  </span>
                </div>
                {confirmPack.needsFaction && (
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">选择势力</label>
                    <select
                      value={faction}
                      onChange={(e) => setFaction(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                    >
                      <option value="">请选择势力...</option>
                      <option value="key_class">重点班</option>
                      <option value="arts_class">艺体班</option>
                      <option value="normal_class">普通班</option>
                      <option value="intl_class">国际班</option>
                      <option value="competition_class">竞赛班</option>
                    </select>
                  </div>
                )}
                <div className="border-t border-zinc-700 pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">当前余额</span>
                    <span>
                      {currentBalance} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">购买后余额</span>
                    <span
                      className={
                        afterBalance < 0
                          ? "text-red-400 font-bold"
                          : "text-green-400"
                      }
                    >
                      {afterBalance} {currency}
                    </span>
                  </div>
                </div>
                {currentBalance < confirmPack.cost && (
                  <p className="text-red-400 text-sm font-medium text-center">
                    ⚠️ {currency}不足，无法购买此卡包
                  </p>
                )}
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmPack(null)}>
              取消
            </Button>
            <Button
              onClick={executeBuy}
              disabled={
                !confirmPack ||
                buyPackMutation.isPending ||
                (confirmPack.costType === "elo"
                  ? userElo < confirmPack.cost
                  : ink < confirmPack.cost)
              }
            >
              {buyPackMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  购买中...
                </>
              ) : (
                "确认购买"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pack Opening Animation */}
      {animation && (
        <PackOpeningAnimation
          cards={animation.cards}
          packName={animation.packName}
          selectorMode={selectorMode}
          onClose={() => {
            setAnimation(null);
            if (!selectorMode) {
              toast.success("开包完成！", {
                description: `获得 ${animation.cards.length} 张卡牌`,
              });
            }
          }}
        />
      )}
    </div>
  );
}
