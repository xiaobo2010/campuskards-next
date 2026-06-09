"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sparkles,
  Crown,
} from "lucide-react";
import type { BattleReport, BattleReportEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildReplayAnnotations,
  computeMvpScores,
  getMvpPlayer,
  type EventAnnotation,
} from "@/lib/replay-highlights";

const ACTION_LABEL: Record<string, string> = {
  game_start: "对局开始",
  deploy: "部署",
  deploy_advisor: "部署顾问",
  attack_face: "直击",
  attack_unit: "攻击",
  overflow_damage: "溢出伤害",
  end_turn: "结束回合",
  draw: "抽牌",
  play_spell: "法术",
  set_trap: "设陷阱",
  victory: "胜利",
  fatigue: "疲劳",
  corridor_bonus: "走廊加成",
  combat_phase: "进入战斗",
  draw_phase: "抽牌阶段",
};

const BASE_INTERVAL_MS = 900;

function formatEventRow(event: BattleReportEvent, index: number) {
  const actionLabel = ACTION_LABEL[event.action] || event.action;
  return { actionLabel, index };
}

interface BattleReplayPlayerProps {
  events: BattleReportEvent[];
  players?: BattleReport["players"];
  mySlot?: "p1" | "p2";
  compact?: boolean;
  className?: string;
}

export default function BattleReplayPlayer({
  events,
  players,
  mySlot,
  compact = false,
  className,
}: BattleReplayPlayerProps) {
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const annotations = useMemo(() => buildReplayAnnotations(events), [events]);
  const annotationByIndex = useMemo(() => {
    const map = new Map<number, EventAnnotation>();
    for (const ann of annotations) map.set(ann.index, ann);
    return map;
  }, [annotations]);

  const mvpScores = useMemo(() => computeMvpScores(annotations), [annotations]);
  const mvpPlayer = useMemo(() => getMvpPlayer(mvpScores), [mvpScores]);

  const visibleEvents = cursor < 0 ? [] : events.slice(0, cursor + 1);
  const currentEvent = cursor >= 0 ? events[cursor] : null;
  const currentAnnotation = cursor >= 0 ? annotationByIndex.get(cursor) : null;

  const playerLabel = useCallback(
    (slot: string) => {
      const info = players?.[slot];
      if (info?.username) return info.username;
      if (slot === mySlot) return "你";
      return slot.toUpperCase();
    },
    [players, mySlot]
  );

  const goTo = useCallback(
    (index: number) => {
      if (events.length === 0) return;
      setCursor(Math.max(-1, Math.min(index, events.length - 1)));
    },
    [events.length]
  );

  const stepBack = () => goTo(cursor - 1);
  const stepForward = () => goTo(cursor + 1);
  const reset = () => {
    setPlaying(false);
    setCursor(-1);
  };

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const interval = setInterval(() => {
      setCursor((prev) => {
        if (prev >= events.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, BASE_INTERVAL_MS / speed);
    return () => clearInterval(interval);
  }, [playing, speed, events.length]);

  useEffect(() => {
    if (cursor < 0) return;
    const el = rowRefs.current.get(cursor);
    if (el && listRef.current) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [cursor]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">暂无回放数据</p>
    );
  }

  const progressPct =
    events.length <= 1
      ? cursor < 0
        ? 0
        : 100
      : Math.round(((cursor + 1) / events.length) * 100);

  return (
    <div className={cn("space-y-3", className)} id="replay">
      {/* 当前动作 spotlight */}
      {!compact && (
        <div
          className={cn(
            "rounded-lg border p-4 min-h-[5.5rem] transition-colors",
            currentAnnotation?.kind === "mvp"
              ? "border-amber-500/50 bg-amber-500/10"
              : currentAnnotation
                ? "border-purple-500/40 bg-purple-500/10"
                : "border-zinc-800 bg-zinc-950/60"
          )}
        >
          {currentEvent ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {currentAnnotation && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                      currentAnnotation.kind === "mvp"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-purple-500/20 text-purple-300"
                    )}
                  >
                    {currentAnnotation.kind === "mvp" ? (
                      <Crown className="w-3 h-3" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {currentAnnotation.label}
                  </span>
                )}
                <span className="text-xs text-zinc-500">
                  #{cursor + 1} / {events.length}
                  {currentEvent.turn != null && ` · T${currentEvent.turn}`}
                </span>
              </div>
              <p className="text-sm text-zinc-100 font-medium">
                <span
                  className={cn(
                    "mr-2 text-xs px-1.5 py-0.5 rounded",
                    currentEvent.player === "p1"
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-orange-500/15 text-orange-400"
                  )}
                >
                  {playerLabel(currentEvent.player)}
                </span>
                {ACTION_LABEL[currentEvent.action] || currentEvent.action}
              </p>
              {currentEvent.detail && (
                <p className="text-xs text-zinc-400 break-words">{currentEvent.detail}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">点击播放或拖动进度条开始回放</p>
          )}
        </div>
      )}

      {/* MVP 统计 */}
      {annotations.length > 0 && !compact && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-zinc-500">高光 {annotations.length} 处</span>
          {mvpPlayer && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Crown className="w-3 h-3" />
              MVP · {playerLabel(mvpPlayer)} (+{mvpScores[mvpPlayer]} 分)
            </span>
          )}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {annotations.slice(0, 6).map((ann) => (
              <button
                key={ann.index}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  goTo(ann.index);
                }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  ann.kind === "mvp"
                    ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
                    : "border-purple-500/30 text-purple-300 hover:bg-purple-500/15"
                )}
              >
                {ann.label}
              </button>
            ))}
            {annotations.length > 6 && (
              <span className="text-[10px] text-zinc-600 self-center">
                +{annotations.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-300 h-8 px-2"
          onClick={reset}
          title="重置"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-300 h-8 px-2"
          onClick={stepBack}
          disabled={cursor < 0}
          title="上一步"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-purple-600 hover:bg-purple-500 text-white h-8 px-3"
          onClick={() => {
            if (cursor >= events.length - 1) {
              reset();
              setPlaying(true);
              setCursor(0);
              return;
            }
            if (cursor < 0) setCursor(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? (
            <>
              <Pause className="w-3.5 h-3.5 mr-1" /> 暂停
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 mr-1" /> 播放
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-300 h-8 px-2"
          onClick={stepForward}
          disabled={cursor >= events.length - 1}
          title="下一步"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </Button>

        <div className="flex-1 min-w-[8rem] flex items-center gap-2">
          <input
            type="range"
            min={-1}
            max={events.length - 1}
            value={cursor}
            onChange={(e) => {
              setPlaying(false);
              goTo(parseInt(e.target.value, 10));
            }}
            className="flex-1 h-1.5 accent-purple-500 cursor-pointer"
            aria-label="回放进度"
          />
          <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">
            {progressPct}%
          </span>
        </div>

        <div className="flex gap-1">
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border",
                speed === s
                  ? "border-purple-500/60 text-purple-300 bg-purple-500/10"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* 事件列表 */}
      <div
        ref={listRef}
        className={cn(
          "overflow-y-auto pr-1 border border-zinc-800 rounded-lg bg-zinc-950/40",
          compact ? "max-h-48" : "max-h-80"
        )}
      >
        {(compact ? visibleEvents : events).map((ev, i) => {
          const realIndex = compact ? i : i;
          const ann = annotationByIndex.get(realIndex);
          const isCurrent = realIndex === cursor;
          const isPast = realIndex <= cursor;
          const { actionLabel } = formatEventRow(ev, realIndex);

          return (
            <div
              key={realIndex}
              ref={(el) => {
                if (el) rowRefs.current.set(realIndex, el);
              }}
              onClick={() => {
                setPlaying(false);
                goTo(realIndex);
              }}
              className={cn(
                "flex gap-2 px-3 py-2 border-b border-zinc-800/60 last:border-0 text-sm cursor-pointer transition-colors",
                isCurrent && "bg-purple-500/15",
                !isCurrent && isPast && "opacity-80",
                !isPast && !compact && "opacity-40"
              )}
            >
              <span className="text-zinc-600 font-mono text-xs w-7 shrink-0 pt-0.5">
                #{realIndex + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] px-1 py-0.5 rounded font-medium",
                      ev.player === "p1"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-orange-500/15 text-orange-400"
                    )}
                  >
                    {playerLabel(ev.player)}
                  </span>
                  {ev.turn != null && (
                    <span className="text-[10px] text-zinc-600">T{ev.turn}</span>
                  )}
                  <span className="text-zinc-300 text-xs font-medium">{actionLabel}</span>
                  {ann && (
                    <span
                      className={cn(
                        "text-[10px] px-1 py-0 rounded",
                        ann.kind === "mvp"
                          ? "text-amber-400"
                          : "text-purple-400"
                      )}
                    >
                      {ann.label}
                    </span>
                  )}
                </div>
                {ev.detail && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{ev.detail}</p>
                )}
              </div>
            </div>
          );
        })}
        {compact && cursor < 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">按播放开始回放</p>
        )}
      </div>
    </div>
  );
}
