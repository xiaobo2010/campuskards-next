"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PackResultCard {
  name: string;
  rarity: string;
  faction: string;
  id?: string;
  image_url?: string | null;
  cost?: number;
  faction_code?: string;
  slot_index?: number;
  is_new?: boolean;
}

export interface SelectorModeProps {
  onSkip: () => Promise<void>;
  onReroll: (slotIndex: number) => Promise<void>;
}

interface PackOpeningAnimationProps {
  cards: PackResultCard[];
  packName: string;
  onClose: () => void;
  selectorMode?: SelectorModeProps;
}

type Phase = "sealed" | "drawing" | "revealed" | "selecting" | "submitting";

const rarityColors: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const rarityNames: Record<string, string> = {
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗",
  legendary: "传奇",
};

const factionColors: Record<string, string> = {
  elite: "#6366f1",
  athletic: "#f59e0b",
  normal: "#ef4444",
  international: "#10b981",
  competitive: "#8b5cf6",
};

function PackBox({
  packName,
  remaining,
  pulse,
}: {
  packName: string;
  remaining: number;
  pulse?: boolean;
}) {
  return (
    <motion.div
      className="relative flex flex-col items-center gap-3"
      animate={pulse ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <p className="text-sm font-medium text-zinc-400 text-center max-w-[140px]">{packName}</p>
      <div
        className="relative w-40 h-52 rounded-xl border-2 border-purple-500/50 flex flex-col items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
          boxShadow: "0 0 28px rgba(139,92,246,0.35)",
        }}
      >
        <span className="text-5xl mb-2">📦</span>
        <span className="text-purple-300 text-xs font-medium">卡包</span>
        {remaining > 0 && (
          <div className="absolute -top-2 -right-2 min-w-[2rem] h-8 px-2 rounded-full bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-white text-sm font-bold shadow-lg">
            {remaining}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RevealedCardFace({
  card,
  compact,
  selected,
  selectable,
  onSelect,
}: {
  card: PackResultCard;
  compact?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
}) {
  const factionKey = card.faction || card.faction_code || "unknown";
  const sizeClass = compact ? "w-28 h-40" : "w-32 h-44";

  return (
    <div
      className={`${sizeClass} rounded-xl border-2 overflow-hidden shrink-0 ${
        selectable ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-black" : ""}`}
      style={{
        borderColor: selected ? "#fbbf24" : rarityColors[card.rarity] || "#6b7280",
        background: `linear-gradient(135deg, #18181b 0%, ${factionColors[factionKey] || "#3f3f46"}22 100%)`,
      }}
      onClick={selectable && onSelect ? onSelect : undefined}
    >
      <div className="w-full h-full p-2.5 flex flex-col relative">
        {selected && (
          <div className="absolute top-1 right-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
            已选
          </div>
        )}
        <div
          className="w-full h-16 rounded-lg mb-1.5 flex items-center justify-center text-xl"
          style={{
            background: `linear-gradient(135deg, ${factionColors[factionKey] || "#3f3f46"}44, ${rarityColors[card.rarity] || "#6b7280"}44)`,
          }}
        >
          {card.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image_url} alt={card.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span>🃏</span>
          )}
        </div>
        <div className="font-bold text-white text-xs truncate">{card.name}</div>
        <div className="mt-1 flex gap-1 flex-wrap">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${rarityColors[card.rarity] || "#6b7280"}22`,
              color: rarityColors[card.rarity] || "#6b7280",
            }}
          >
            {rarityNames[card.rarity] || card.rarity}
          </span>
          {card.is_new && (
            <span className="text-[10px] font-medium px-1 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              新
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PackOpeningAnimation({
  cards,
  packName,
  onClose,
  selectorMode,
}: PackOpeningAnimationProps) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [revealedCount, setRevealedCount] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [packPulse, setPackPulse] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [displayCards] = useState<PackResultCard[]>(cards);
  const finishScheduled = useRef(false);

  const total = displayCards.length;
  const remainingInPack = total - revealedCount;
  const isDrawing = phase === "drawing";
  const allRevealed = revealedCount >= total;

  const finishDrawing = useCallback(() => {
    if (finishScheduled.current) return;
    finishScheduled.current = true;
    setPhase(selectorMode ? "selecting" : "revealed");
  }, [selectorMode]);

  const revealNext = useCallback(() => {
    if (phase !== "drawing" || isFlying || allRevealed) return;
    setPackPulse(true);
    setIsFlying(true);
    setRevealedCount((count: number) => count + 1);
    setTimeout(() => setPackPulse(false), 350);
  }, [phase, isFlying, allRevealed]);

  const startDrawing = useCallback(() => {
    if (phase === "sealed") {
      finishScheduled.current = false;
      setPhase("drawing");
    }
  }, [phase]);

  const handleAdvance = useCallback(() => {
    if (phase === "sealed") {
      startDrawing();
      return;
    }
    if (phase === "drawing") {
      revealNext();
    }
  }, [phase, startDrawing, revealNext]);

  const handleClose = useCallback(async () => {
    if (selectorMode && phase !== "submitting" && phase !== "sealed") {
      setPhase("submitting");
      try {
        await selectorMode.onSkip();
      } finally {
        onClose();
      }
      return;
    }
    if (phase !== "submitting") onClose();
  }, [selectorMode, phase, onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void handleClose();
        return;
      }
      if (phase === "submitting") return;
      if (phase === "selecting" || phase === "revealed") return;
      e.preventDefault();
      handleAdvance();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleClose, handleAdvance, phase]);

  const handleSkip = async () => {
    if (!selectorMode) return;
    setPhase("submitting");
    try {
      await selectorMode.onSkip();
      onClose();
    } catch {
      setPhase("selecting");
    }
  };

  const handleReroll = async () => {
    if (!selectorMode || selectedSlot === null) return;
    setPhase("submitting");
    try {
      await selectorMode.onReroll(selectedSlot);
      onClose();
    } catch {
      setPhase("selecting");
    }
  };

  const onFlyComplete = useCallback(() => {
    setIsFlying(false);
  }, []);

  useEffect(() => {
    if (phase === "drawing" && revealedCount >= total && !isFlying) {
      finishDrawing();
    }
  }, [phase, revealedCount, total, isFlying, finishDrawing]);

  const hintText = (() => {
    if (phase === "sealed") return "点击屏幕或按任意键开启卡包";
    if (phase === "drawing") {
      if (isFlying) return "卡牌飞出中…";
      if (allRevealed) return "开包完成";
      return `卡包剩余 ${remainingInPack} 张 · 点击或按任意键继续`;
    }
    if (phase === "selecting") return "选择一张卡牌重抽，或点「放弃」保留全部";
    if (phase === "revealed") return "全部卡牌已揭示";
    if (phase === "submitting") return "正在同步收藏…";
    return "";
  })();

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-no-advance]")) return;
    if (phase === "sealed" || phase === "drawing") handleAdvance();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 select-none"
      onClick={handleOverlayClick}
    >
      <button
        type="button"
        data-no-advance
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          void handleClose();
        }}
        disabled={phase === "submitting"}
        className="absolute top-4 right-4 text-white/50 hover:text-white z-50 disabled:opacity-30"
      >
        <X className="w-6 h-6" />
      </button>

      <AnimatePresence mode="wait">
        {phase === "sealed" && (
          <motion.div
            key="sealed"
            className="flex-1 flex flex-col items-center justify-center gap-6 cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="text-2xl font-bold text-white">{packName}</h2>
            <PackBox packName={packName} remaining={total} />
          </motion.div>
        )}

        {phase !== "sealed" && (
          <motion.div
            key="layout"
            className="flex-1 flex flex-col min-h-0 pt-12 pb-24 px-4 md:px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h2 className="text-lg md:text-xl font-bold text-white text-center mb-6 shrink-0">
              {phase === "selecting"
                ? "🎯 选择一张卡牌重抽"
                : phase === "revealed"
                  ? "🎉 开包完成"
                  : phase === "submitting"
                    ? "处理中…"
                    : packName}
            </h2>

            <div className="flex-1 flex flex-row items-center gap-6 md:gap-10 min-h-0 overflow-hidden">
              {isDrawing && (
                <div className="shrink-0 pl-2 md:pl-6 self-center">
                  <PackBox packName={packName} remaining={remainingInPack} pulse={packPulse} />
                </div>
              )}

              <div className="flex-1 flex flex-wrap content-start gap-3 overflow-y-auto py-2 pr-2 justify-start items-start min-h-[12rem]">
                <AnimatePresence mode="popLayout">
                  {displayCards.slice(0, revealedCount).map((card: PackResultCard, i: number) => {
                    const isFlyingCard = i === revealedCount - 1 && isFlying;
                    return (
                      <motion.div
                        key={`${card.id ?? "card"}-${i}`}
                        layout
                        initial={
                          isFlyingCard
                            ? { x: -280, y: 20, opacity: 0, scale: 0.45, rotate: -8 }
                            : false
                        }
                        animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 26,
                          mass: 0.85,
                        }}
                        onAnimationComplete={isFlyingCard ? onFlyComplete : undefined}
                      >
                        <RevealedCardFace
                          card={card}
                          compact
                          selected={phase === "selecting" && selectedSlot === i}
                          selectable={phase === "selecting"}
                          onSelect={() => setSelectedSlot(i)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {revealedCount === 0 && isDrawing && (
                  <div className="flex items-center justify-center w-full h-40 text-zinc-600 text-sm">
                    卡牌将从此处飞出 →
                  </div>
                )}
              </div>
            </div>

            <div data-no-advance className="shrink-0 flex flex-col items-center gap-4 mt-4">
              {phase === "revealed" && (
                <Button onClick={onClose} variant="outline">
                  确认
                </Button>
              )}
              {phase === "selecting" && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="border-zinc-600 text-zinc-300 min-w-[140px]"
                    onClick={() => void handleSkip()}
                  >
                    放弃
                  </Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 min-w-[160px]"
                    disabled={selectedSlot === null}
                    onClick={() => void handleReroll()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重抽此卡
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-0 inset-x-0 py-4 px-6 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
        <p
          className={`text-center text-sm ${
            phase === "drawing" && !isFlying && !allRevealed
              ? "text-purple-300 animate-pulse"
              : "text-zinc-500"
          }`}
        >
          {hintText}
        </p>
      </div>
    </div>
  );
}
