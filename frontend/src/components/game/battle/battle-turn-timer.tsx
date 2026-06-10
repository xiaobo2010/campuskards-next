"use client";

import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface BattleTurnTimerProps {
  secondsLeft: number;
  turnLimit: number;
  isMyTurn: boolean;
  warningAt: number;
}

export default function BattleTurnTimer({
  secondsLeft,
  turnLimit,
  isMyTurn,
  warningAt,
}: BattleTurnTimerProps) {
  const pct = turnLimit > 0 ? Math.max(0, Math.min(100, (secondsLeft / turnLimit) * 100)) : 0;
  const urgent = isMyTurn && secondsLeft <= warningAt;
  const critical = isMyTurn && secondsLeft <= 5;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-11 h-11 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-zinc-800"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct} 100`}
            className={cn(
              "transition-all duration-300",
              !isMyTurn && "stroke-zinc-600",
              isMyTurn && !urgent && "stroke-emerald-500",
              urgent && !critical && "stroke-amber-500",
              critical && "stroke-red-500 animate-pulse"
            )}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-bold font-mono",
            critical ? "text-red-400" : urgent ? "text-amber-400" : "text-zinc-200"
          )}
        >
          {secondsLeft}
        </span>
      </div>
      <div className="hidden sm:block">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">回合计时</p>
        <p
          className={cn(
            "text-xs font-medium",
            isMyTurn ? (urgent ? "text-amber-400" : "text-emerald-400") : "text-zinc-500"
          )}
        >
          {isMyTurn ? "你的回合" : "对手回合"}
        </p>
      </div>
    </div>
  );
}

export function MatchElapsedClock({ elapsed }: { elapsed: number }) {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
      <Clock className="w-3.5 h-3.5" />
      <span className="font-mono">
        {m}:{s.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
