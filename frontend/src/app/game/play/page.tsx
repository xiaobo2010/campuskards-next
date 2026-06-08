"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, Swords, RotateCcw } from "lucide-react";

// TODO: WebSocket game connection

/* ---------- 占位卡牌背面 ---------- */
function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-16 h-24 rounded-lg bg-panel border border-border flex items-center justify-center ${className}`}
    >
      <span className="text-muted-foreground text-xs opacity-50">CK</span>
    </div>
  );
}

/* ---------- 空卡位 ---------- */
function EmptySlot() {
  return (
    <div className="w-20 h-28 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center">
      <span className="text-muted-foreground/30 text-xs">空位</span>
    </div>
  );
}

/* ---------- 生命值指示 ---------- */
function HealthBar({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Heart
          key={i}
          className={`w-4 h-4 ${
            i < count ? "text-red-500 fill-red-500" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function PlayPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground flex flex-col p-4 gap-4 select-none">
      {/* ====== 对手区域 ====== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-panel border border-border rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border border-border">
              <AvatarFallback className="bg-card text-muted-foreground text-sm">
                ?
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">等待对手…</p>
              <HealthBar count={5} />
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <CardBack key={i} className="w-10 h-14 text-[8px]" />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ====== 战斗区域 ====== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 bg-panel border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-6"
      >
        {/* 对手出牌区 */}
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <EmptySlot key={i} />
          ))}
        </div>

        {/* VS 分隔线 */}
        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-2 text-accent">
            <Swords className="w-5 h-5" />
            <span className="font-bold text-lg tracking-widest">VS</span>
            <Swords className="w-5 h-5 scale-x-[-1]" />
          </div>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* 我方出牌区 */}
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <EmptySlot key={i} />
          ))}
        </div>
      </motion.div>

      {/* ====== 我方区域 ====== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-panel border border-border rounded-xl p-4 space-y-4"
      >
        {/* 手牌 */}
        <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              whileHover={{ y: -8, scale: 1.05 }}
              className="cursor-pointer shrink-0"
            >
              <CardBack />
            </motion.div>
          ))}
        </div>

        {/* 行动按钮 */}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            抽牌
          </Button>
          <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
            <Swords className="w-4 h-4" />
            结束回合
          </Button>
        </div>
      </motion.div>

      {/* ====== 底部提示 ====== */}
      <p className="text-center text-xs text-muted-foreground/60 animate-pulse">
        等待对战开始 — WebSocket 连接中…
      </p>
    </div>
  );
}
