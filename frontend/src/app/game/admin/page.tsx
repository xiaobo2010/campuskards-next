"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, ApiError } from "@/lib/api";
import type { AdminStats } from "@/types";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = stats
    ? [
        {
          title: "用户总数",
          value: stats.users.toLocaleString(),
          href: "/game/admin/users",
          color: "text-blue-400",
        },
        {
          title: "卡牌总数",
          value: stats.cards.toLocaleString(),
          href: "/game/admin/cards",
          color: "text-emerald-400",
        },
        {
          title: "发布公告数",
          value: stats.announcements.toLocaleString(),
          href: "/game/admin/announcements",
          color: "text-amber-400",
        },
        {
          title: "总墨水流通量",
          value: stats.total_ink.toLocaleString(),
          href: "/game/admin/users",
          color: "text-purple-400",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200">数据概览</h2>
        <Button
          onClick={loadStats}
          variant="outline"
          size="sm"
          disabled={loading}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button
            onClick={loadStats}
            variant="outline"
            size="sm"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            重试
          </Button>
        </div>
      )}

      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c) => (
            <Link key={c.title} href={c.href}>
              <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-400">{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/game/admin/users">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
            <CardContent className="py-6 text-center">
              <p className="text-zinc-300 font-medium">👥 用户管理</p>
              <p className="text-xs text-zinc-500 mt-1">墨水、ELO、角色、封禁、PassKey</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/game/admin/cards">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
            <CardContent className="py-6 text-center">
              <p className="text-zinc-300 font-medium">🃏 卡牌管理</p>
              <p className="text-xs text-zinc-500 mt-1">编辑卡牌属性与效果</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/game/admin/announcements">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
            <CardContent className="py-6 text-center">
              <p className="text-zinc-300 font-medium">📢 公告管理</p>
              <p className="text-xs text-zinc-500 mt-1">发布、置顶与删除公告</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
