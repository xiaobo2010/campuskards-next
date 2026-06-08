"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  /** 返回替换后的卡牌；动画在翻转完成后再调用 */
  onReroll: (slotIndex: number) => Promise<PackResultCard | null>;
}

export interface PackVisualTheme {
  icon: string;
  subtitle: string;
  gradient: string;
  borderColor: string;
  glowColor: string;
  accentColor: string;
  pulseGlow: string;
}

export const PACK_VISUAL_THEMES: Record<string, PackVisualTheme> = {
  basic: {
    icon: "📦",
    subtitle: "基础",
    gradient: "linear-gradient(145deg, #0c1929 0%, #1e3a8a 45%, #312e81 100%)",
    borderColor: "rgba(59,130,246,0.55)",
    glowColor: "rgba(59,130,246,0.45)",
    accentColor: "#93c5fd",
    pulseGlow: "rgba(96,165,250,0.55)",
  },
  advanced: {
    icon: "✨",
    subtitle: "进阶",
    gradient: "linear-gradient(145deg, #2e1065 0%, #6b21a8 50%, #831843 100%)",
    borderColor: "rgba(192,132,252,0.55)",
    glowColor: "rgba(168,85,247,0.5)",
    accentColor: "#e9d5ff",
    pulseGlow: "rgba(192,132,252,0.6)",
  },
  selector: {
    icon: "🎯",
    subtitle: "自选",
    gradient: "linear-gradient(145deg, #451a03 0%, #b45309 50%, #991b1b 100%)",
    borderColor: "rgba(251,191,36,0.55)",
    glowColor: "rgba(245,158,11,0.45)",
    accentColor: "#fde68a",
    pulseGlow: "rgba(251,191,36,0.55)",
  },
  faction: {
    icon: "⚔️",
    subtitle: "势力",
    gradient: "linear-gradient(145deg, #052e16 0%, #047857 50%, #0f766e 100%)",
    borderColor: "rgba(52,211,153,0.55)",
    glowColor: "rgba(16,185,129,0.45)",
    accentColor: "#6ee7b7",
    pulseGlow: "rgba(52,211,153,0.55)",
  },
  prestige: {
    icon: "👑",
    subtitle: "声望",
    gradient: "linear-gradient(145deg, #422006 0%, #b45309 50%, #c2410c 100%)",
    borderColor: "rgba(251,191,36,0.6)",
    glowColor: "rgba(234,179,8,0.5)",
    accentColor: "#fef08a",
    pulseGlow: "rgba(250,204,21,0.6)",
  },
  battle_drop: {
    icon: "🎁",
    subtitle: "战利品",
    gradient: "linear-gradient(145deg, #042f2e 0%, #0f766e 50%, #1e40af 100%)",
    borderColor: "rgba(45,212,191,0.55)",
    glowColor: "rgba(20,184,166,0.45)",
    accentColor: "#5eead4",
    pulseGlow: "rgba(45,212,191,0.55)",
  },
};

const DEFAULT_THEME = PACK_VISUAL_THEMES.basic;

const CONFIRM_BTN_CLASS =
  "bg-purple-600 hover:bg-purple-500 text-white border-0 min-w-[140px]";

type Phase = "sealed" | "drawing" | "revealed" | "selecting" | "rerolling" | "submitting";

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
  key_class: "#6366f1",
  art_club: "#ec4899",
  sports: "#f97316",
  student_council: "#eab308",
  science: "#14b8a6",
};

function resolveTheme(packId?: string): PackVisualTheme {
  if (packId && PACK_VISUAL_THEMES[packId]) return PACK_VISUAL_THEMES[packId];
  return DEFAULT_THEME;
}

interface PackOpeningAnimationProps {
  cards: PackResultCard[];
  packName: string;
  packId?: string;
  onClose: () => void;
  selectorMode?: SelectorModeProps;
}

function PackBox({
  packName,
  remaining,
  pulse,
  theme,
}: {
  packName: string;
  remaining: number;
  pulse?: boolean;
  theme: PackVisualTheme;
}) {
  return (
    <motion.div
      className="relative flex flex-col items-center gap-3"
      animate={pulse ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <p className="text-sm font-medium text-zinc-400 text-center max-w-[140px]">{packName}</p>
      <div className="relative">
        {/* 外圈光晕 */}
        <div
          className="absolute -inset-3 rounded-2xl blur-xl opacity-70"
          style={{ background: theme.pulseGlow }}
        />
        <div
          className="relative w-40 h-52 rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: theme.gradient,
            borderColor: theme.borderColor,
            boxShadow: `0 0 32px ${theme.glowColor}, inset 0 1px 0 rgba(255,255,255,0.12)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${theme.accentColor}55, transparent 55%)`,
            }}
          />
          <span className="text-5xl mb-2 relative z-10 drop-shadow-lg">{theme.icon}</span>
          <span className="text-xs font-semibold relative z-10" style={{ color: theme.accentColor }}>
            {theme.subtitle}卡包
          </span>
          {remaining > 0 && (
            <div
              className="absolute -top-2 -right-2 min-w-[2rem] h-8 px-2 rounded-full border-2 flex items-center justify-center text-white text-sm font-bold shadow-lg z-20"
              style={{
                background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.borderColor})`,
                borderColor: theme.accentColor,
              }}
            >
              {remaining}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CardBack({ compact }: { compact?: boolean }) {
  const sizeClass = compact ? "w-28 h-40" : "w-32 h-44";
  return (
    <div
      className={cn(
        sizeClass,
        "rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-indigo-950 via-purple-950 to-zinc-900 flex items-center justify-center"
      )}
    >
      <span className="text-3xl opacity-80">🃏</span>
    </div>
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
      className={cn(
        sizeClass,
        "rounded-xl border-2 overflow-hidden shrink-0",
        selectable && "cursor-pointer",
        selected && "ring-2 ring-amber-400 ring-offset-2 ring-offset-black"
      )}
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

function FlippableRevealedCard({
  card,
  compact,
  selected,
  selectable,
  onSelect,
  flipY,
  isRerolling,
}: {
  card: PackResultCard;
  compact?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  flipY: number;
  isRerolling?: boolean;
}) {
  const sizeClass = compact ? "w-28 h-40" : "w-32 h-44";

  return (
    <div className={cn(sizeClass, "relative shrink-0")} style={{ perspective: 1000 }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipY }}
        transition={{ duration: isRerolling ? 0.55 : 0.5, ease: "easeInOut" }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <RevealedCardFace
            card={card}
            compact={compact}
            selected={selected}
            selectable={selectable && !isRerolling}
            onSelect={onSelect}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <CardBack compact={compact} />
        </div>
      </motion.div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function PackOpeningAnimation({
  cards,
  packName,
  packId,
  onClose,
  selectorMode,
}: PackOpeningAnimationProps) {
  const theme = resolveTheme(packId);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [revealedCount, setRevealedCount] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [packPulse, setPackPulse] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [displayCards, setDisplayCards] = useState<PackResultCard[]>(cards);
  const [flipAngles, setFlipAngles] = useState<Record<number, number>>({});
  const [rerollingSlot, setRerollingSlot] = useState<number | null>(null);
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
    if (selectorMode && phase !== "submitting" && phase !== "sealed" && phase !== "rerolling") {
      setPhase("submitting");
      try {
        await selectorMode.onSkip();
      } finally {
        onClose();
      }
      return;
    }
    if (phase !== "submitting" && phase !== "rerolling") onClose();
  }, [selectorMode, phase, onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (phase !== "rerolling") void handleClose();
        return;
      }
      if (phase === "submitting" || phase === "rerolling") return;
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
    if (!selectorMode || selectedSlot === null || phase === "rerolling") return;
    const slot = selectedSlot;
    setRerollingSlot(slot);
    setPhase("rerolling");

    setFlipAngles((prev) => ({ ...prev, [slot]: 180 }));
    await delay(550);
    await delay(2000);

    setPhase("submitting");
    try {
      const newCard = await selectorMode.onReroll(slot);
      if (newCard) {
        setDisplayCards((prev) => {
          const next = [...prev];
          next[slot] = newCard;
          return next;
        });
      }
      setFlipAngles((prev) => ({ ...prev, [slot]: 0 }));
      await delay(550);
      setRerollingSlot(null);
      setSelectedSlot(null);
      setPhase("revealed");
    } catch {
      setFlipAngles((prev) => ({ ...prev, [slot]: 0 }));
      setRerollingSlot(null);
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
    if (phase === "rerolling") return "正在替换卡牌…";
    if (phase === "revealed") return "全部卡牌已揭示";
    if (phase === "submitting") return "正在同步收藏…";
    return "";
  })();

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-no-advance]")) return;
    if (phase === "sealed" || phase === "drawing") handleAdvance();
  };

  const showPackOnLeft = isDrawing || phase === "selecting" || phase === "rerolling" || phase === "revealed";

  return (
    <div className="fixed inset-0 z-50 flex flex-col select-none" onClick={handleOverlayClick}>
      {/* 模糊背景层 */}
      <div className="absolute inset-0 backdrop-blur-xl bg-zinc-950/75" />

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <button
          type="button"
          data-no-advance
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            if (phase !== "rerolling") void handleClose();
          }}
          disabled={phase === "submitting" || phase === "rerolling"}
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
              <PackBox packName={packName} remaining={total} theme={theme} />
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
                  : phase === "rerolling"
                    ? "🔄 替换卡牌中"
                    : phase === "revealed"
                      ? "🎉 开包完成"
                      : phase === "submitting"
                        ? "处理中…"
                        : packName}
              </h2>

              <div className="flex-1 flex flex-row items-center gap-6 md:gap-10 min-h-0 overflow-hidden">
                {showPackOnLeft && (
                  <div className="shrink-0 pl-2 md:pl-6 self-center">
                    <PackBox
                      packName={packName}
                      remaining={phase === "drawing" ? remainingInPack : 0}
                      pulse={packPulse}
                      theme={theme}
                    />
                  </div>
                )}

                <div className="flex-1 flex flex-wrap content-start gap-3 overflow-y-auto py-2 pr-2 justify-start items-start min-h-[12rem]">
                  <AnimatePresence mode="popLayout">
                    {displayCards.slice(0, revealedCount).map((card: PackResultCard, i: number) => {
                      const isFlyingCard = i === revealedCount - 1 && isFlying;
                      const isSlotRerolling = rerollingSlot === i;
                      const flipY = flipAngles[i] ?? 0;

                      return (
                        <motion.div
                          key={`${card.id ?? "card"}-${i}-${card.name}`}
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
                          <FlippableRevealedCard
                            card={card}
                            compact
                            selected={phase === "selecting" && selectedSlot === i}
                            selectable={phase === "selecting"}
                            onSelect={() => setSelectedSlot(i)}
                            flipY={flipY}
                            isRerolling={isSlotRerolling}
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {revealedCount === 0 && isDrawing && (
                    <div className="flex items-center justify-center w-full h-40 text-zinc-500 text-sm">
                      卡牌将从此处飞出 →
                    </div>
                  )}
                </div>
              </div>

              <div data-no-advance className="shrink-0 flex flex-col items-center gap-4 mt-4">
                {phase === "revealed" && (
                  <Button onClick={onClose} className={CONFIRM_BTN_CLASS}>
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
                      className={cn(CONFIRM_BTN_CLASS, "min-w-[160px]")}
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

        <div className="absolute bottom-0 inset-x-0 py-4 px-6 bg-gradient-to-t from-zinc-950/90 via-zinc-950/60 to-transparent pointer-events-none">
          <p
            className={cn(
              "text-center text-sm",
              phase === "drawing" && !isFlying && !allRevealed
                ? "animate-pulse"
                : "text-zinc-500"
            )}
            style={
              phase === "drawing" && !isFlying && !allRevealed
                ? { color: theme.accentColor }
                : undefined
            }
          >
            {hintText}
          </p>
        </div>
      </div>
    </div>
  );
}
