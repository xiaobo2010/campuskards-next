"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { matchApi, ApiError } from "@/lib/api";
import type { MatchHistoryItem, MatchStats } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  History,
  TrendingUp,
  TrendingDown,
  Trophy,
  Swords,
  ChevronRight,
  Loader2,
  PlayCircle,
  ChevronDown,
} from "lucide-react";
import MatchReplaySection from "@/components/game/match-replay-section";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ResultFilter = "all" | "win" | "loss" | "draw";

const RESULT_LABEL: Record<string, string> = {
  win: "胜利",
  loss: "失败",
  draw: "平局",
};

const MODE_LABEL: Record<string, string> = {
  quick: "快速",
  ranked: "排位",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EloChart({ timeline }: { timeline: MatchStats["elo_timeline_7d"] }) {
  if (timeline.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">近 7 天暂无排位对战记录</p>
    );
  }

  const maxAbs = Math.max(...timeline.map((p) => Math.abs(p.cumulative)), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-32 px-2">
        {timeline.map((point, i) => {
          const height = Math.max(8, (Math.abs(point.cumulative) / maxAbs) * 100);
          const positive = point.cumulative >= 0;
          return (
            <div key={point.match_id} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
              <span
                className={cn(
                  "text-[10px] font-mono",
                  positive ? "text-emerald-400" : "text-red-400"
                )}
              >
                {point.cumulative > 0 ? "+" : ""}
                {point.cumulative}
              </span>
              <div
                className={cn(
                  "w-full rounded-t transition-all",
                  positive ? "bg-emerald-500/70" : "bg-red-500/70"
                )}
                style={{ height: `${height}%` }}
                title={`${formatDate(point.ended_at)}: ${point.delta > 0 ? "+" : ""}${point.delta}`}
              />
              <span className="text-[9px] text-zinc-600 truncate w-full text-center">
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 text-center">近 7 天排位 ELO 累计变化（按对局顺序）</p>
    </div>
  );
}

export default function MatchHistoryPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [items, setItems] = useState<MatchHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [expandedReplayId, setExpandedReplayId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await matchApi.stats();
      setStats(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载统计数据失败");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await matchApi.history({
        page,
        page_size: 15,
        result: filter === "all" ? undefined : filter,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载对战记录失败");
    } finally {
      setListLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadStats();
      setLoading(false);
    })();
  }, [loadStats]);

  useEffect(() => {
    loadHistory();
  }, [page, filter, loadHistory]);

  const totalPages = Math.max(1, Math.ceil(total / 15));
  const winRatePct = stats ? Math.round(stats.win_rate * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <History className="w-7 h-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">对战历史</h1>
            <p className="text-sm text-zinc-500">{user?.username} 的战绩与战报</p>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500">胜率</p>
                <p className="text-2xl font-bold text-zinc-100">{winRatePct}%</p>
                <p className="text-[10px] text-zinc-600">
                  {stats.wins}胜 {stats.losses}负 {stats.draws}平
                </p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500">总场次</p>
                <p className="text-2xl font-bold text-zinc-100">{stats.total_matches}</p>
                <p className="text-[10px] text-zinc-600">
                  排位 {stats.ranked_matches} · 快速 {stats.quick_matches}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500">当前 ELO</p>
                <p className="text-2xl font-bold text-amber-400">{stats.current_elo}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500">近 7 天 ELO</p>
                <p
                  className={cn(
                    "text-2xl font-bold flex items-center gap-1",
                    stats.elo_delta_7d >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {stats.elo_delta_7d >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  {stats.elo_delta_7d > 0 ? "+" : ""}
                  {stats.elo_delta_7d}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ELO 走势 */}
        {stats && (
          <Card className="bg-zinc-900/80 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-zinc-200">近 7 天排位 ELO 走势</CardTitle>
            </CardHeader>
            <CardContent>
              <EloChart timeline={stats.elo_timeline_7d} />
            </CardContent>
          </Card>
        )}

        {/* 筛选 */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "win", "loss", "draw"] as ResultFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className={cn(
                filter === f
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "border-zinc-700 text-zinc-400"
              )}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {f === "all" ? "全部" : RESULT_LABEL[f]}
            </Button>
          ))}
        </div>

        {/* 对战列表 */}
        <Card className="bg-zinc-900/80 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
              <Swords className="w-4 h-4" />
              对战记录
              <span className="text-xs font-normal text-zinc-500">共 {total} 场</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {listLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-zinc-500 py-10">暂无对战记录，去匹配一场吧！</p>
            ) : (
              items.map((m) => {
                const replayOpen = expandedReplayId === m.id;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg border border-zinc-800 bg-zinc-950/50 transition-colors",
                      replayOpen && "border-purple-500/40 bg-zinc-900"
                    )}
                  >
                    <div className="flex items-center justify-between p-3 gap-2">
                      <Link
                        href={`/game/history/${m.id}`}
                        className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                            m.result === "win" && "bg-emerald-500/20 text-emerald-400",
                            m.result === "loss" && "bg-red-500/20 text-red-400",
                            m.result === "draw" && "bg-zinc-700/50 text-zinc-400"
                          )}
                        >
                          {m.result === "win" ? (
                            <Trophy className="w-4 h-4" />
                          ) : (
                            RESULT_LABEL[m.result]?.[0]
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">
                            vs {m.opponent.username}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {MODE_LABEL[m.mode]} · {formatDate(m.ended_at || m.started_at)}
                            {m.turns_played != null && ` · ${m.turns_played} 回合`}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.mode === "ranked" && m.my_elo_change !== 0 && (
                          <span
                            className={cn(
                              "text-sm font-mono font-medium hidden sm:inline",
                              m.my_elo_change > 0 ? "text-emerald-400" : "text-red-400"
                            )}
                          >
                            {m.my_elo_change > 0 ? "+" : ""}
                            {m.my_elo_change}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full hidden sm:inline",
                            m.result === "win" && "bg-emerald-500/15 text-emerald-400",
                            m.result === "loss" && "bg-red-500/15 text-red-400",
                            m.result === "draw" && "bg-zinc-700/50 text-zinc-400"
                          )}
                        >
                          {RESULT_LABEL[m.result]}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={replayOpen ? "default" : "outline"}
                          className={cn(
                            "h-8 text-xs gap-1",
                            replayOpen
                              ? "bg-purple-600 hover:bg-purple-500"
                              : "border-zinc-700 text-zinc-400"
                          )}
                          onClick={() =>
                            setExpandedReplayId(replayOpen ? null : m.id)
                          }
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          回放
                          <ChevronDown
                            className={cn(
                              "w-3 h-3 transition-transform",
                              replayOpen && "rotate-180"
                            )}
                          />
                        </Button>
                        <Link
                          href={`/game/history/${m.id}`}
                          className="text-zinc-600 hover:text-purple-400 p-1"
                          aria-label="查看战报详情"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                    {replayOpen && (
                      <div className="px-3 pb-3 pt-0 border-t border-zinc-800/80">
                        <MatchReplaySection
                          matchId={m.id}
                          myUserId={user?.id}
                          compact
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <span className="text-sm text-zinc-500 self-center">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
