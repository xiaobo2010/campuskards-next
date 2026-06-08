"use client";

import { Heart, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

export function HpBar({
  hp,
  maxHp,
  compact,
}: {
  hp: number;
  maxHp: number;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className={cn("space-y-0.5", compact && "space-y-0")}>
      <div className="flex items-center gap-1.5">
        <Heart
          className={cn(
            "text-red-500 fill-red-500",
            compact ? "w-3 h-3" : "w-3.5 h-3.5",
          )}
        />
        <span
          className={cn(
            "font-mono text-zinc-300",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {hp}/{maxHp}
        </span>
      </div>
      <div
        className={cn(
          "w-full max-w-[8rem] rounded-full bg-zinc-800 overflow-hidden",
          compact ? "h-1" : "h-1.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct > 50
              ? "bg-red-500"
              : pct > 25
                ? "bg-amber-500"
                : "bg-red-600 animate-pulse",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function InkBadge({ ink, max }: { ink: number; max: number }) {
  return (
    <div className="flex items-center gap-1 text-xs text-zinc-400">
      <Droplets className="w-3.5 h-3.5 text-sky-400" />
      <span className="font-mono text-sky-300">
        {ink}/{max}
      </span>
      <span className="text-zinc-600 text-[10px]">墨水</span>
    </div>
  );
}
