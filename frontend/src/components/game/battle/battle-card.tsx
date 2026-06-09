"use client";

import { motion } from "framer-motion";
import { Swords, Droplets } from "lucide-react";
import type { BattleUnit } from "@/types";
import { cn } from "@/lib/utils";
import { synergyTagMeta } from "@/lib/synergy-labels";

const FACTION_STYLES: Record<string, string> = {
  key_class: "from-blue-700 via-blue-800 to-indigo-900 border-blue-500/40",
  art_club: "from-pink-700 via-rose-800 to-purple-900 border-pink-500/40",
  sports: "from-orange-600 via-red-700 to-red-900 border-orange-500/40",
  student_council: "from-amber-600 via-yellow-700 to-amber-900 border-amber-500/40",
  science: "from-cyan-700 via-teal-800 to-emerald-900 border-cyan-500/40",
};

function factionStyle(faction?: string | null) {
  if (faction && FACTION_STYLES[faction]) return FACTION_STYLES[faction];
  return "from-zinc-700 via-zinc-800 to-zinc-900 border-zinc-600/40";
}

interface BattleCardProps {
  unit: BattleUnit;
  variant?: "hand" | "field";
  selected?: boolean;
  disabled?: boolean;
  affordable?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDoubleClick?: () => void;
  placementPending?: boolean;
  targetHighlight?: boolean;
}

function SynergyBadges({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="absolute top-6 right-0.5 flex flex-col gap-0.5 z-[1]">
      {tags.map((tag) => {
        const meta = synergyTagMeta(tag);
        return (
          <span
            key={tag}
            title={meta.title}
            className={cn(
              "text-[8px] font-bold px-1 rounded border leading-tight",
              meta.className
            )}
          >
            {meta.short}
          </span>
        );
      })}
    </div>
  );
}

export default function BattleCard({
  unit,
  variant = "field",
  selected,
  disabled,
  affordable = true,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  placementPending,
  targetHighlight,
}: BattleCardProps) {
  const isHand = variant === "hand";

  if (unit.card_type === "hq") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "relative rounded-xl border-2 bg-gradient-to-b from-red-900 via-red-950 to-zinc-950 border-red-500/50 text-left overflow-hidden shrink-0",
          "w-20 h-28 sm:w-[5.5rem] sm:h-32",
          targetHighlight && "ring-2 ring-amber-400 border-amber-400 shadow-lg shadow-amber-500/30",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <div className="flex flex-col items-center justify-center h-full p-1 text-center gap-1">
          <span className="text-[9px] text-red-300/80">🏴 总部</span>
          <span className="text-xs font-bold text-red-200">{unit.spirit}</span>
          <span className="text-[9px] text-red-400/60">HP</span>
        </div>
      </button>
    );
  }

  const grad = factionStyle(unit.faction);

  const cardButton = (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      whileHover={!disabled ? { y: isHand ? -10 : -4, scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      className={cn(
        "relative rounded-xl border-2 bg-gradient-to-b text-left overflow-hidden transition-shadow shrink-0",
        grad,
        isHand ? "w-[4.5rem] h-[6.5rem] sm:w-20 sm:h-[7.5rem]" : "w-20 h-28 sm:w-[5.5rem] sm:h-32",
        selected && "ring-2 ring-amber-400 border-amber-400 scale-105 z-10 shadow-lg shadow-amber-500/25",
        placementPending && "ring-2 ring-purple-400 border-purple-400 animate-pulse",
        targetHighlight && "ring-2 ring-amber-400 border-amber-400 shadow-lg shadow-amber-500/30",
        disabled && "opacity-45 cursor-not-allowed grayscale-[0.3]",
        !affordable && isHand && "opacity-60",
        unit.can_attack && !disabled && !isHand && "shadow-[0_0_12px_rgba(251,191,36,0.4)]"
      )}
    >
      {/* 费用 */}
      {unit.cost != null && unit.cost > 0 && (
        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-[10px] font-bold text-sky-300">
          {unit.cost}
        </span>
      )}

      {unit.can_attack && !isHand && (
        <Swords className="absolute top-1 right-1 w-3.5 h-3.5 text-amber-300 drop-shadow" />
      )}

      {!isHand && <SynergyBadges tags={unit.synergy_tags} />}

      {!isHand && unit.immune_turns != null && unit.immune_turns > 0 && (
        <span className="absolute bottom-8 left-1 text-[8px] px-1 rounded bg-yellow-900/70 text-yellow-200 border border-yellow-500/40" title="免疫">
          免
        </span>
      )}
      {!isHand && unit.silenced_turns != null && unit.silenced_turns > 0 && (
        <span className="absolute bottom-8 right-1 text-[8px] px-1 rounded bg-zinc-800/90 text-zinc-400 border border-zinc-500/40" title="沉默">
          默
        </span>
      )}

      {unit.base_power != null && unit.base_power !== unit.power && !isHand && (
        <span
          className="absolute top-1 left-7 text-[8px] font-mono text-emerald-300 bg-black/40 px-0.5 rounded"
          title={`基础力量 ${unit.base_power}`}
        >
          +{unit.power - unit.base_power}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-1.5 pt-6">
        <p className="text-[10px] sm:text-xs font-bold text-white leading-tight line-clamp-2">
          {unit.name}
        </p>
        <div className="flex gap-1 mt-1 text-[9px] font-mono">
          <span className="px-1 rounded bg-red-900/60 text-red-200" title="力量">
            {unit.power}
          </span>
          <span className="px-1 rounded bg-blue-900/60 text-blue-200" title="精神">
            {unit.spirit}
          </span>
          <span className="px-1 rounded bg-emerald-900/60 text-emerald-200" title="韧性">
            {unit.grit}
          </span>
        </div>
      </div>

      {!affordable && isHand && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Droplets className="w-5 h-5 text-red-400" />
        </div>
      )}
    </motion.button>
  );

  if (draggable && !disabled) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="shrink-0 cursor-grab active:cursor-grabbing"
      >
        {cardButton}
      </div>
    );
  }

  return cardButton;
}

export function EmptyBattleSlot() {
  return (
    <div className="w-20 h-28 sm:w-[5.5rem] sm:h-32 rounded-xl border-2 border-dashed border-zinc-700/60 bg-zinc-900/30 flex items-center justify-center">
      <span className="text-[10px] text-zinc-600">空位</span>
    </div>
  );
}

export function PlacementSlot({
  onClick,
  active,
  lineLabel,
}: {
  onClick?: () => void;
  active?: boolean;
  lineLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-20 h-28 sm:w-[5.5rem] sm:h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all shrink-0",
        active
          ? "border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-500/20 animate-pulse cursor-pointer"
          : "border-zinc-600/80 bg-zinc-900/40 hover:border-purple-500/50 cursor-pointer"
      )}
    >
      <span className="text-[10px] text-purple-300 font-medium">放置</span>
      {lineLabel && <span className="text-[9px] text-zinc-500">{lineLabel}</span>}
    </button>
  );
}

export function CardBackStack({ count }: { count: number }) {
  return (
    <div className="relative w-8 h-11">
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <div
          key={i}
          className="absolute w-8 h-11 rounded-md bg-gradient-to-br from-purple-900 to-zinc-900 border border-purple-500/30"
          style={{ left: i * 4, top: -i * 2, zIndex: i }}
        />
      ))}
      {count > 0 && (
        <span className="absolute -bottom-1 -right-1 z-10 text-[9px] bg-zinc-800 border border-zinc-600 rounded-full w-4 h-4 flex items-center justify-center text-zinc-300">
          {count}
        </span>
      )}
    </div>
  );
}
