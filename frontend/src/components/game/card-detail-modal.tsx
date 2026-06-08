"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card as CardType, UserCardOwnership, UpgradeResult } from "@/types";
import CardUpgradePanel from "./card-upgrade-panel";

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
  elite: "text-indigo-400",
  arts: "text-amber-400",
  mass: "text-red-400",
  global: "text-emerald-400",
  rush: "text-violet-400",
};

const FACTION_LABELS: Record<string, string> = {
  elite: "精英",
  arts: "艺术",
  mass: "大众",
  global: "全球",
  rush: "速攻",
};

export function CardDetailModal({ card, ownership, open, onOpenChange, onUpgradeSuccess }: CardDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "upgrade">("detail");

  if (!card) return null;

  const factionCode = card.faction_code || "mass";
  const rarity = card.rarity || "common";
  const borderColor = RARITY_COLORS[rarity] || "border-zinc-500";
  const rarityLabel = RARITY_LABELS[rarity] || rarity;
  const factionColor = FACTION_COLORS[factionCode] || "text-zinc-400";
  const factionLabel = FACTION_LABELS[factionCode] || factionCode;

  const handleUpgradeSuccess = (result: UpgradeResult) => {
    setActiveTab("detail"); // Switch back to detail tab
    onUpgradeSuccess?.(result);
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
                      ? card.power! + (ownership.level - 1) * (card.unit_type === "TANK" ? 0 : 1)
                      : card.power}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-500 mb-1">坚韧</div>
                  <div className="text-lg font-bold text-green-400">
                    {ownership?.level && ownership.level > 1
                      ? card.grit! + (ownership.level - 1) * (card.unit_type === "TANK" ? 1 : 0)
                      : card.grit ?? 0}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-500 mb-1">精神</div>
                  <div className="text-lg font-bold text-purple-400">
                    {ownership?.level && ownership.level > 1
                      ? card.spirit! + (ownership.level - 1) * (card.unit_type === "TANK" ? 2 : ["INFANTRY","FIGHTER"].includes(card.unit_type || "") ? 1 : 0)
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

              {/* Combat Tips Placeholder */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 min-h-[80px]">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">💡 战斗技巧</h4>
                <div id="combat-tips" className="text-sm text-zinc-400">
                  {/* Worker will populate this */}
                  <span className="italic">战术分析加载中...</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          ownership && <CardUpgradePanel card={card} ownership={ownership} onUpgradeSuccess={handleUpgradeSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}
