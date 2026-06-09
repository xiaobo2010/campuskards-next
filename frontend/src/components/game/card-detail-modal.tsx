"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog as ConfirmDialog,
  DialogContent as ConfirmDialogContent,
  DialogHeader as ConfirmDialogHeader,
  DialogTitle as ConfirmDialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Card as CardType, UserCardOwnership, UpgradeResult } from "@/types";
import CardUpgradePanel from "./card-upgrade-panel";
import { FACTION_LABEL } from "@/lib/faction-labels";
import { collectionApi } from "@/lib/api";
import { getRandomTips } from "@/lib/combat-tips";
import { toast } from "sonner";

interface CardDetailModalProps {
  card: CardType | null;
  ownership?: UserCardOwnership | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgradeSuccess?: (result: UpgradeResult) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "border-zinc-500",
  uncommon: "border-green-500",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-yellow-500",
};

const RARITY_LABELS: Record<string, string> = {
  common: "普通",
  uncommon: "稀有",
  rare: "史诗",
  epic: "传说",
  legendary: "传奇",
};

const FACTION_COLORS: Record<string, string> = {
  key_class: "text-indigo-400",
  arts_class: "text-amber-400",
  normal_class: "text-red-400",
  intl_class: "text-emerald-400",
  competition_class: "text-violet-400",
  neutral: "text-zinc-400",
};

export function CardDetailModal({ card, ownership, open, onOpenChange, onUpgradeSuccess }: CardDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "upgrade">("detail");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertCount, setConvertCount] = useState(1);
  const [converting, setConverting] = useState(false);
  const [tips, setTips] = useState<string[]>([]);

  useEffect(() => {
    if (card && open) {
      setTips(getRandomTips(card.unit_type, card.card_type, 2));
    }
  }, [card, open]);

  if (!card) return null;

  const factionCode = card.faction_code || "mass";
  const rarity = card.rarity || "common";
  const borderColor = RARITY_COLORS[rarity] || "border-zinc-500";
  const rarityLabel = RARITY_LABELS[rarity] || rarity;
  const factionColor = FACTION_COLORS[factionCode] || "text-zinc-400";
  const factionLabel = FACTION_LABEL[factionCode] || factionCode;
  const ownedCount = (ownership?.count ?? 0) - 1; // Extra copies beyond the first

  const handleUpgradeSuccess = (result: UpgradeResult) => {
    setActiveTab("detail");
    onUpgradeSuccess?.(result);
  };

  const handleConvert = async () => {
    if (!card || convertCount < 1) return;
    setConverting(true);
    try {
      await collectionApi.convertToFragments(card.id, convertCount);
      toast.success("转化成功", {
        description: `消耗 ${convertCount} 张重复卡牌，获得碎片`,
      });
      setShowConvertDialog(false);
      setConvertCount(1);
      onOpenChange(false);
    } catch (err) {
      toast.error("转化失败", {
        description: err instanceof Error ? err.message : "请重试",
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${borderColor} border-2`}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-2xl font-bold">{card.name}</span>
            <span className={`text-sm font-semibold ${factionColor}`}>
              {factionLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        {ownership && (
          <div className="flex gap-2 border-b border-zinc-700 pb-2 mb-4">
            <button
              onClick={() => setActiveTab("detail")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "detail"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              详情
            </button>
            <button
              onClick={() => setActiveTab("upgrade")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "upgrade"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              升级
              {ownership.level && ownership.level < 10 && (
                <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full">
                  Lv{ownership.level}
                </span>
              )}
            </button>
          </div>
        )}

        {activeTab === "detail" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Left: Card Image */}
            <div className="flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative w-64 h-80 rounded-xl overflow-hidden shadow-2xl ${borderColor} border-4`}
              >
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                    <span className="text-6xl">🎴</span>
                  </div>
                )}
                {/* Level badge */}
                {ownership?.level && ownership.level > 1 && (
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-600 to-orange-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    Lv.{ownership.level}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right: Card Details */}
            <div className="space-y-4">
              {/* Rarity Badge */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${borderColor} bg-zinc-900/50`}>
                  {rarityLabel}
                </span>
              </div>

              {/* Cost */}
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">费用</span>
                  <span className="text-2xl font-bold text-blue-400">{card.cost}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-500 mb-1">战力</div>
                  <div className="text-lg font-bold text-red-400">
                    {ownership?.level && ownership.level > 1
                      ? (card.power ?? 0) + (ownership.level - 1) * (card.unit_type === "TANK" ? 0 : 1)
                      : card.power ?? 0}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-500 mb-1">坚韧</div>
                  <div className="text-lg font-bold text-green-400">
                    {ownership?.level && ownership.level > 1
                      ? (card.grit ?? 0) + (ownership.level - 1) * (card.unit_type === "TANK" ? 1 : 0)
                      : card.grit ?? 0}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-500 mb-1">精神</div>
                  <div className="text-lg font-bold text-purple-400">
                    {ownership?.level && ownership.level > 1
                      ? (card.spirit ?? 0) + (ownership.level - 1) * (card.unit_type === "TANK" ? 2 : ["INFANTRY","FIGHTER"].includes(card.unit_type || "") ? 1 : 0)
                      : card.spirit ?? 0}
                  </div>
                </div>
              </div>

              {/* Effect Text */}
              {card.effect_text && (
                <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-2">卡牌效果</h4>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    {card.effect_text}
                  </p>
                </div>
              )}

              {/* Flavor Text */}
              {card.flavor_text && (
                <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800/50">
                  <p className="text-xs text-zinc-500 italic leading-relaxed">
                    "{card.flavor_text}"
                  </p>
                </div>
              )}

              {/* Combat Tips */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 min-h-[80px]">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">💡 战斗技巧</h4>
                {tips.length > 0 ? (
                  <ul className="space-y-2">
                    {tips.map((tip, i) => (
                      <li key={i} className="text-sm text-zinc-400 leading-relaxed flex gap-2">
                        <span className="text-zinc-600 shrink-0 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-zinc-500 italic">暂无针对该卡牌的战术分析</div>
                )}
              </div>

              {/* Convert duplicates to fragments */}
              {ownedCount > 0 && (
                <button
                  onClick={() => { setConvertCount(1); setShowConvertDialog(true); }}
                  className="w-full py-2 px-4 rounded-lg bg-purple-900/40 border border-purple-700/50 text-purple-200 text-sm font-medium hover:bg-purple-900/60 transition-colors"
                >
                  转化为碎片（多余 {ownedCount} 张）
                </button>
              )}
            </div>
          </div>
        ) : (
          ownership && <CardUpgradePanel card={card} ownership={ownership} onUpgradeSuccess={handleUpgradeSuccess} />
        )}

        {/* Convert Confirm Dialog */}
        <ConfirmDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <ConfirmDialogContent className="max-w-sm">
            <ConfirmDialogHeader>
              <ConfirmDialogTitle>转化为碎片</ConfirmDialogTitle>
              <DialogDescription>
                将多余的卡牌转化为碎片，用于升级卡牌。至少保留 1 张卡牌。
              </DialogDescription>
            </ConfirmDialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">当前持有</span>
                <span className="font-bold">{ownership?.count ?? 0} 张</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">转化数量</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConvertCount(Math.max(1, convertCount - 1))}
                    className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold">{convertCount}</span>
                  <button
                    onClick={() => setConvertCount(Math.min(ownedCount, convertCount + 1))}
                    className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>转化后剩余</span>
                <span>{(ownership?.count ?? 0) - convertCount} 张</span>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setShowConvertDialog(false)} disabled={converting}>
                取消
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-500"
                onClick={handleConvert}
                disabled={converting}
              >
                {converting ? "转化中..." : "确认转化"}
              </Button>
            </DialogFooter>
          </ConfirmDialogContent>
        </ConfirmDialog>
      </DialogContent>
    </Dialog>
  );
}
