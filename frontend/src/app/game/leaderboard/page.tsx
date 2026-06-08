"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leaderboardApi } from "@/lib/api";
import { Trophy, Medal } from "lucide-react";

interface LeaderboardEntry {
  username: string;
  elo: number;
  rank: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const data = await leaderboardApi.get();
        setLeaderboard(data);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-zinc-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-zinc-500 font-mono text-sm w-6 text-center">#{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30";
    if (rank === 2) return "bg-gradient-to-r from-zinc-700/30 to-zinc-800/30 border-zinc-500/30";
    if (rank === 3) return "bg-gradient-to-r from-amber-700/10 to-orange-700/10 border-amber-700/30";
    return "bg-zinc-900 border-zinc-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Card className="border-zinc-800 bg-zinc-900/70">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-400" />
              天梯排行榜
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                暂无排行数据
              </div>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-4 rounded-lg border ${getRankStyle(
                    entry.rank
                  )} transition-all hover:scale-[1.01]`}
                >
                  <div className="flex items-center gap-4">
                    {getRankIcon(entry.rank)}
                    <div>
                      <p className="text-zinc-100 font-medium">{entry.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-400">{entry.elo}</p>
                    <p className="text-xs text-zinc-500">ELO</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
