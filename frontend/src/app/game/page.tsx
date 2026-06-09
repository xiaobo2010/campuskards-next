"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Briefcase, Swords, Store, Shield, History } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { AnnouncementBoard } from "@/components/game/announcement-board";

interface ActionCard {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  emoji: string;
  action?: () => void;
}

export default function GameLobbyPage() {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const actionCards = useMemo<ActionCard[]>(() => {
    const cards: ActionCard[] = [
      {
        href: "/game/decks",
        icon: Briefcase,
        title: "我的卡组",
        emoji: "🃏",
        description: "查看、编辑和管理你的卡组",
        gradient: "from-blue-500/10 to-cyan-500/10",
      },
      {
        href: "/game/matchmaking",
        icon: Swords,
        title: "开始对战",
        emoji: "⚔️",
        description: "匹配对手进行卡牌对战",
        gradient: "from-red-500/10 to-orange-500/10",
      },
      {
        href: "/game/shop",
        icon: Store,
        title: "商店",
        emoji: "🏪",
        description: "购买卡包，扩充你的收藏",
        gradient: "from-purple-500/10 to-pink-500/10",
      },
      {
        href: "/game/collection",
        icon: BookOpen,
        title: "卡牌图鉴",
        emoji: "📖",
        description: "浏览你的卡牌收藏",
        gradient: "from-green-500/10 to-emerald-500/10",
      },
      {
        href: "/game/history",
        icon: History,
        title: "对战历史",
        emoji: "📜",
        description: "查看战绩、ELO 走势与战报",
        gradient: "from-indigo-500/10 to-violet-500/10",
      },
    ];
    if (user?.role === "admin") {
      cards.push({
        href: "/game/admin",
        icon: Shield,
        title: "管理游戏",
        emoji: "🔧",
        description: "用户、卡牌、公告与 PassKey 管理",
        gradient: "from-yellow-500/10 to-amber-500/10",
      });
    }
    return cards;
  }, [user?.role]);

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 p-6 space-y-8 max-w-5xl mx-auto">
        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-purple-900/20 border border-zinc-800 rounded-2xl p-6"
        >
          <h1 className="text-3xl font-bold text-zinc-100">
            欢迎回来, {user?.username}!
          </h1>
          <p className="mt-2 text-zinc-400">
            ELO: <span className="text-yellow-400 font-semibold">{user?.elo ?? 0}</span>
            {" · "}
            墨水: <span className="text-purple-400 font-semibold">💧{user?.ink ?? 0}</span>
          </p>
        </motion.div>

        {/* Action cards grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {actionCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.3, duration: 0.4 }}
              >
                {card.href ? (
                  <Link href={card.href} className="block h-full">
                  <Card className="h-full bg-zinc-900 border-zinc-800 hover:border-purple-500/50 transition-all duration-200 cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-lg mb-2 border border-zinc-700/50 group-hover:border-purple-500/30 transition-colors`}
                      >
                        {card.emoji}
                      </div>
                      <CardTitle className="text-zinc-100 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-zinc-400" />
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-400">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  </Link>
                ) : (
                  <button type="button" onClick={card.action} className="block h-full w-full text-left">
                  <Card className="h-full bg-zinc-900 border-zinc-800 hover:border-purple-500/50 transition-all duration-200 cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-lg mb-2 border border-zinc-700/50 group-hover:border-purple-500/30 transition-colors`}
                      >
                        {card.emoji}
                      </div>
                      <CardTitle className="text-zinc-100 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-zinc-400" />
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-400">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  </button>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Announcement Board */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <AnnouncementBoard autoFetch refreshTrigger={refreshTrigger} />
        </motion.div>

      </div>
    </div>
  );
}
