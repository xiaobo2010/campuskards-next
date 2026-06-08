"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Card, UserCardOwnership, UpgradeResult } from "@/types";

interface CardUpgradePanelProps {
  card: Card;
  ownership: UserCardOwnership;
  onUpgradeSuccess: (result: UpgradeResult) => void;
}

// Upgrade costs matching backend constants
const UPGRADE_COSTS: Record<string, Record<number, { fragments: number; ink: number }>> = {
  common: {
    1: { fragments: 2, ink: 50 },
    2: { fragments: 3, ink: 100 },
    3: { fragments: 4, ink: 150 },
    4: { fragments: 5, ink: 200 },
    5: { fragments: 6, ink: 300 },
    6: { fragments: 8, ink: 400 },
    7: { fragments: 10, ink: 500 },
    8: { fragments: 12, ink: 650 },
    9: { fragments: 15, ink: 800 },
  },
  uncommon: {
    1: { fragments: 3, ink: 80 },
    2: { fragments: 4, ink: 150 },
    3: { fragments: 5, ink: 220 },
    4: { fragments: 7, ink: 300 },
    5: { fragments: 9, ink: 420 },
    6: { fragments: 11, ink: 560 },
    7: { fragments: 14, ink: 720 },
    8: { fragments: 17, ink: 900 },
    9: { fragments: 20, ink: 1100 },
  },
  rare: {
    1: { fragments: 4, ink: 120 },
    2: { fragments: 6, ink: 220 },
    3: { fragments: 8, ink: 340 },
    4: { fragments: 10, ink: 480 },
    5: { fragments: 13, ink: 650 },
    6: { fragments: 16, ink: 840 },
    7: { fragments: 20, ink: 1060 },
    8: { fragments: 24, ink: 1300 },
    9: { fragments: 28, ink: 1600 },
  },
  epic: {
    1: { fragments: 6, ink: 200 },
    2: { fragments: 8, ink: 360 },
    3: { fragments: 11, ink: 540 },
    4: { fragments: 14, ink: 750 },
    5: { fragments: 18, ink: 1000 },
    6: { fragments: 22, ink: 1280 },
    7: { fragments: 27, ink: 1600 },
    8: { fragments: 32, ink: 1960 },
    9: { fragments: 38, ink: 2400 },
  },
  legendary: {
    1: { fragments: 6, ink: 200 },
    2: { fragments: 8, ink: 360 },
    3: { fragments: 11, ink: 540 },
    4: { fragments: 14, ink: 750 },
    5: { fragments: 18, ink: 1000 },
    6: { fragments: 22, ink: 1280 },
    7: { fragments: 27, ink: 1600 },
    8: { fragments: 32, ink: 1960 },
    9: { fragments: 38, ink: 2400 },
  },
};

// Stat growth by unit_type
const STAT_GROWTH: Record<string, { power: number; grit: number; spirit: number }> = {
  INFANTRY: { power: 1, grit: 0, spirit: 1 },
  TANK: { power: 0, grit: 1, spirit: 2 },
  ARTILLERY: { power: 1, grit: 0, spirit: 0 },
  FIGHTER: { power: 1, grit: 0, spirit: 1 },
  BOMBER: { power: 1, grit: 0, spirit: 0 },
};

const MAX_LEVEL = 10;

export default function CardUpgradePanel({ card, ownership, onUpgradeSuccess }: CardUpgradePanelProps) {
  const [upgrading, setUpgrading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { userInk, setUserInk } = useAuth();

  const currentLevel = ownership.level ?? 1;
  const currentFragments = ownership.fragments ?? 0;
  const isMaxLevel = currentLevel >= MAX_LEVEL;

  // Get upgrade cost for current level
  const rarity = card.rarity || "common";
  const levelCost = UPGRADE_COSTS[rarity]?.[currentLevel];
  const fragmentsNeeded = levelCost?.fragments ?? 0;
  const inkNeeded = levelCost?.ink ?? 0;

  // Check if can upgrade
  const hasEnoughFragments = currentFragments >= fragmentsNeeded;
  const hasEnoughInk = (userInk ?? 0) >= inkNeeded;
  const canUpgrade = !isMaxLevel && hasEnoughFragments && hasEnoughInk;

  // Calculate current and next stats
  const unitType = (card.unit_type || "INFANTRY").toUpperCase();
  const growth = STAT_GROWTH[unitType] ?? { power: 1, grit: 0, spirit: 1 };

  const basePower = card.power ?? 0;
  const baseGrit = card.grit ?? 0;
  const baseSpirit = card.spirit ?? 0;

  const currentStats = {
    power: basePower + (currentLevel - 1) * growth.power,
    grit: baseGrit + (currentLevel - 1) * growth.grit,
    spirit: baseSpirit + (currentLevel - 1) * growth.spirit,
  };

  const nextStats = {
    power: basePower + currentLevel * growth.power,
    grit: baseGrit + currentLevel * growth.grit,
    spirit: baseSpirit + currentLevel * growth.spirit,
  };

  const handleUpgrade = async () => {
    if (!canUpgrade) return;

    setUpgrading(true);
    try {
      const result = await cardsApi.upgrade(card.id);
      setUserInk(result.ink_remaining);
      setShowSuccess(true);

      // Trigger success animation
      setTimeout(() => {
        setShowSuccess(false);
        onUpgradeSuccess(result);
      }, 1500);
    } catch (error) {
      console.error("Upgrade failed:", error);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="relative p-6 space-y-6">
      {/* Success animation overlay */}
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-2"
          >
            <Sparkles className="w-16 h-16 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-300">升级成功！</span>
          </motion.div>
        </motion.div>
      )}

      {/* Level display */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-full">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-lg font-bold">
            {isMaxLevel ? "已满级 ✦" : `等级 ${currentLevel} / ${MAX_LEVEL}`}
          </span>
        </div>
      </div>

      {/* Stats comparison */}
      {!isMaxLevel && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400">属性提升</h3>
          <div className="grid grid-cols-3 gap-3">
            {/* Power */}
            <div className="p-3 bg-gray-800/50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">战力</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{currentStats.power}</span>
                {nextStats.power > currentStats.power && (
                  <>
                    <ArrowUp className="w-4 h-4 text-green-400" />
                    <span className="text-lg font-bold text-green-400">{nextStats.power}</span>
                  </>
                )}
              </div>
            </div>

            {/* Grit */}
            <div className="p-3 bg-gray-800/50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">坚韧</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{currentStats.grit}</span>
                {nextStats.grit > currentStats.grit && (
                  <>
                    <ArrowUp className="w-4 h-4 text-green-400" />
                    <span className="text-lg font-bold text-green-400">{nextStats.grit}</span>
                  </>
                )}
              </div>
            </div>

            {/* Spirit */}
            <div className="p-3 bg-gray-800/50 rounded-lg text-center">
              <div className="text-xs text-gray-500 mb-1">精神</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{currentStats.spirit}</span>
                {nextStats.spirit > currentStats.spirit && (
                  <>
                    <ArrowUp className="w-4 h-4 text-green-400" />
                    <span className="text-lg font-bold text-green-400">{nextStats.spirit}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource requirements */}
      {!isMaxLevel && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400">升级消耗</h3>

          {/* Fragments */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
                <span className="text-sm">🔷</span>
              </div>
              <span className="font-medium">碎片</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasEnoughFragments ? "text-green-400" : "text-red-400"}>
                {currentFragments}
              </span>
              <span className="text-gray-500">/</span>
              <span className="font-bold">{fragmentsNeeded}</span>
            </div>
          </div>

          {/* Ink */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                <span className="text-sm">💧</span>
              </div>
              <span className="font-medium">墨水</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasEnoughInk ? "text-green-400" : "text-red-400"}>
                {userInk}
              </span>
              <span className="text-gray-500">/</span>
              <span className="font-bold">{inkNeeded}</span>
            </div>
          </div>

          {/* Insufficient resources hint */}
          {!canUpgrade && (
            <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
              <p className="text-sm text-red-300">
                {!hasEnoughFragments && !hasEnoughInk
                  ? "碎片和墨水都不足"
                  : !hasEnoughFragments
                  ? `碎片不足，还差 ${fragmentsNeeded - currentFragments} 个`
                  : `墨水不足，还差 ${inkNeeded - (userInk ?? 0)} 点`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upgrade button */}
      {!isMaxLevel ? (
        <Button
          onClick={handleUpgrade}
          disabled={!canUpgrade || upgrading}
          className="w-full h-12 text-lg font-bold"
          size="lg"
        >
          {upgrading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
            />
          ) : (
            <ArrowUp className="w-5 h-5 mr-2" />
          )}
          {upgrading ? "升级中..." : "升级"}
        </Button>
      ) : (
        <div className="text-center p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg">
          <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-yellow-300">已达满级</p>
          <p className="text-sm text-gray-400 mt-1">这张卡牌已发挥全部潜力</p>
        </div>
      )}
    </div>
  );
}
