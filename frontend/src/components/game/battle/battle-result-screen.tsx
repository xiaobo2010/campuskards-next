"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Droplets, Package, ScrollText, Swords, Trophy, XCircle } from "lucide-react";
import type { BattleReportEvent, GameOverPayload } from "@/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  game_start: "对局开始",
  deploy: "部署",
  attack_face: "直击",
  attack_unit: "攻击",
  end_turn: "结束回合",
  draw: "抽牌",
};

const REASON_LABEL: Record<string, string> = {
  combat: "战斗结束",
  surrender: "投降",
  timeout: "超时",
};

interface BattleResultScreenProps {
  gameOver: GameOverPayload;
  viewer: "p1" | "p2";
  userId?: string;
  matchId?: string;
  onBackToLobby: () => void;
}

function formatEvent(ev: BattleReportEvent): string {
  const who = ev.player === "p1" ? "玩家1" : "玩家2";
  const action = ACTION_LABEL[ev.action] || ev.action;
  return `T${ev.turn ?? "?"} · ${who} · ${action}${ev.detail ? ` — ${ev.detail}` : ""}`;
}

export default function BattleResultScreen({
  gameOver,
  viewer,
  userId,
  matchId,
  onBackToLobby,
}: BattleResultScreenProps) {
  const isWin = gameOver.winner_id === userId;
  const rewards = gameOver.rewards;
  const summary = gameOver.battle_summary;
  const eventLog = gameOver.event_log ?? [];
  const myPlayer = gameOver.players?.[viewer];
  const oppKey = viewer === "p1" ? "p2" : "p1";
  const oppPlayer = gameOver.players?.[oppKey];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url(/images/lobby-bg.png)" }}
      />
      <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 flex flex-col h-full max-w-2xl mx-auto w-full p-4 sm:p-6"
      >
        {/* Header */}
        <div className="text-center pt-4 pb-6 shrink-0">
          <div
            className={cn(
              "w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4",
              isWin ? "bg-emerald-500/20 ring-2 ring-emerald-500/40" : "bg-red-500/20 ring-2 ring-red-500/40"
            )}
          >
            {isWin ? (
              <Trophy className="w-10 h-10 text-emerald-400" />
            ) : (
              <XCircle className="w-10 h-10 text-red-400" />
            )}
          </div>
          <h1 className={cn("text-3xl font-bold", isWin ? "text-emerald-300" : "text-red-300")}>
            {isWin ? "胜利！" : "战败"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {REASON_LABEL[gameOver.reason] ?? gameOver.reason}
            {gameOver.turns_played != null && ` · ${gameOver.turns_played} 回合`}
          </p>
          {gameOver.mode === "ranked" && (
            <p className="text-lg font-mono mt-2 text-zinc-200">
              ELO {gameOver.elo_change[viewer] >= 0 ? "+" : ""}
              {gameOver.elo_change[viewer]}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pb-4">
          {/* Battle stats */}
          <section className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Swords className="w-4 h-4 text-purple-400" />
              战斗数据
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-zinc-800/50 p-3">
                <p className="text-[10px] text-zinc-500 uppercase">我方剩余生命</p>
                <p className="text-xl font-mono text-emerald-300">{myPlayer?.final_hp ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-zinc-800/50 p-3">
                <p className="text-[10px] text-zinc-500 uppercase">对手剩余生命</p>
                <p className="text-xl font-mono text-red-300">{oppPlayer?.final_hp ?? "—"}</p>
              </div>
            </div>
            {summary?.action_counts && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.action_counts).map(([action, count]) => (
                  <span
                    key={action}
                    className="text-xs px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400"
                  >
                    {ACTION_LABEL[action] || action} × {count}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Rewards (winner only) */}
          {isWin && rewards && (rewards.ink > 0 || rewards.packs.length > 0) && (
            <section className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-amber-200">战斗奖励</h2>
              {rewards.ink > 0 && (
                <div className="flex items-center gap-2 text-sky-300">
                  <Droplets className="w-5 h-5" />
                  <span className="text-lg font-mono">+{rewards.ink}</span>
                  <span className="text-sm text-zinc-400">墨水</span>
                </div>
              )}
              {rewards.packs.map((pack) => (
                <div key={pack.pack_id} className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-300">
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-medium">{pack.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pack.cards.map((c) => (
                      <span
                        key={c.card_id}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded border",
                          c.is_new
                            ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-300"
                            : "border-zinc-600 bg-zinc-800/60 text-zinc-400"
                        )}
                      >
                        {c.name}
                        {c.is_new ? " NEW" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Event log */}
          {eventLog.length > 0 && (
            <section className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-4">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
                <ScrollText className="w-4 h-4 text-zinc-400" />
                战斗日志
              </h2>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto text-xs font-mono">
                {eventLog.map((ev, i) => (
                  <li key={i} className="text-zinc-400 border-l-2 border-zinc-700 pl-2 py-0.5">
                    {formatEvent(ev)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col gap-2 pt-2 pb-safe">
          {matchId && (
            <Button asChild variant="outline" className="w-full border-zinc-600 bg-zinc-900/50">
              <Link href={`/game/history/${matchId}`}>查看完整战报</Link>
            </Button>
          )}
          <Button className="w-full bg-purple-600 hover:bg-purple-500" onClick={onBackToLobby}>
            返回匹配
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
