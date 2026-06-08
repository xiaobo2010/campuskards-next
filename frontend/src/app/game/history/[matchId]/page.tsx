"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { matchApi, ApiError } from "@/lib/api";
import type { BattleReportEvent, MatchDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Swords,
  ScrollText,
  BarChart3,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatFaction } from "@/lib/faction-labels";

const RESULT_LABEL: Record<string, string> = {
  win: "胜利",
  loss: "失败",
  draw: "平局",
};

const MODE_LABEL: Record<string, string> = {
  quick: "快速匹配",
  ranked: "排位赛",
};

const END_REASON_LABEL: Record<string, string> = {
  combat: "正常结算",
  surrender: "投降",
};

const ACTION_LABEL: Record<string, string> = {
  game_start: "对局开始",
  deploy: "部署",
  attack_face: "直击",
  attack_unit: "攻击",
  end_turn: "结束回合",
  draw: "抽牌",
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN");
}

function EventLogRow({ event, index }: { event: BattleReportEvent; index: number }) {
  const actionLabel = ACTION_LABEL[event.action] || event.action;
  return (
    <div className="flex gap-3 py-2 border-b border-zinc-800/80 last:border-0 text-sm">
      <span className="text-zinc-600 font-mono text-xs w-8 shrink-0 pt-0.5">
        #{index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded font-medium",
              event.player === "p1" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"
            )}
          >
            {event.player.toUpperCase()}
          </span>
          <span className="text-xs text-zinc-500">{event.phase}</span>
          {event.turn != null && (
            <span className="text-xs text-zinc-600">T{event.turn}</span>
          )}
          <span className="text-zinc-300 font-medium">{actionLabel}</span>
        </div>
        {event.detail && (
          <p className="text-xs text-zinc-500 mt-0.5 break-words">{event.detail}</p>
        )}
      </div>
    </div>
  );
}

export default function MatchReportPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { user } = useAuth();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    matchApi
      .getMatch(matchId)
      .then(setMatch)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "加载战报失败");
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!match || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950">
        <p className="text-zinc-500">战报不存在或无权查看</p>
        <Button asChild variant="outline">
          <Link href="/game/history">返回对战历史</Link>
        </Button>
      </div>
    );
  }

  const isP1 = match.p1.id === user.id;
  const me = isP1 ? match.p1 : match.p2;
  const opp = isP1 ? match.p2 : match.p1;
  const mySlot = isP1 ? "p1" : "p2";

  let result: "win" | "loss" | "draw" = "draw";
  if (match.winner_id === user.id) result = "win";
  else if (match.winner_id) result = "loss";

  const report = match.replay_data;
  const myEloChange =
    match.mode === "ranked" && report?.elo_changes
      ? report.elo_changes[mySlot as "p1" | "p2"] ?? 0
      : 0;

  const oppSlot = isP1 ? "p2" : "p1";
  const snapshot = report?.final_snapshot as
    | { player1?: { spirit_total?: number }; player2?: { spirit_total?: number } }
    | undefined;
  const finalHp =
    report?.players?.[mySlot]?.final_hp ??
    (isP1 ? snapshot?.player1?.spirit_total : snapshot?.player2?.spirit_total);
  const oppFinalHp =
    report?.players?.[oppSlot]?.final_hp ??
    (isP1 ? snapshot?.player2?.spirit_total : snapshot?.player1?.spirit_total);

  const events = report?.event_log ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-zinc-400 -ml-2">
            <Link href="/game/history">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
        </div>

        {/* 概览 */}
        <Card
          className={cn(
            "border-2 bg-zinc-900/80",
            result === "win" && "border-emerald-500/40",
            result === "loss" && "border-red-500/40",
            result === "draw" && "border-zinc-700"
          )}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-zinc-100 flex items-center gap-2">
                  <Swords className="w-5 h-5" />
                  对战战报
                </CardTitle>
                <p className="text-sm text-zinc-500 mt-1">
                  {MODE_LABEL[match.mode]} · {formatDateTime(match.ended_at || match.started_at)}
                </p>
              </div>
              <span
                className={cn(
                  "text-lg font-bold px-3 py-1 rounded-lg",
                  result === "win" && "bg-emerald-500/20 text-emerald-400",
                  result === "loss" && "bg-red-500/20 text-red-400",
                  result === "draw" && "bg-zinc-700/50 text-zinc-400"
                )}
              >
                {RESULT_LABEL[result]}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                  <User className="w-3 h-3" /> 你
                </div>
                <p className="font-medium text-zinc-100">{me.username}</p>
                <p className="text-xs text-zinc-500">
                  {formatFaction(me.deck_faction)} · ELO {me.elo}
                  {finalHp != null && ` · 终局 HP ${finalHp}`}
                </p>
                {match.mode === "ranked" && myEloChange !== 0 && (
                  <p
                    className={cn(
                      "text-sm font-mono font-bold mt-1",
                      myEloChange > 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    ELO {myEloChange > 0 ? "+" : ""}
                    {myEloChange}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                  <User className="w-3 h-3" /> 对手
                </div>
                <p className="font-medium text-zinc-100">{opp.username}</p>
                <p className="text-xs text-zinc-500">
                  {formatFaction(opp.deck_faction)} · ELO {opp.elo}
                  {oppFinalHp != null && ` · 终局 HP ${oppFinalHp}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
              {match.turns_played != null && <span>共 {match.turns_played} 回合</span>}
              {match.end_reason && (
                <span>结束方式：{END_REASON_LABEL[match.end_reason] || match.end_reason}</span>
              )}
              {report?.summary && (
                <span>事件 {report.summary.total_events} 条</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 动作统计 */}
        {report?.summary?.action_counts && (
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                动作统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.summary.action_counts).map(([action, count]) => (
                  <span
                    key={action}
                    className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {ACTION_LABEL[action] || action} × {count}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 事件日志 */}
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              对局日志
              <span className="text-xs font-normal text-zinc-500">({events.length} 条)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">
                {match.status === "active"
                  ? "对局进行中，暂无完整战报"
                  : "暂无事件日志（可能是较早版本的对局）"}
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto pr-1">
                {events.map((ev, i) => (
                  <EventLogRow key={i} event={ev} index={i} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
