"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { checkinApi, ApiError } from "@/lib/api";

interface CheckInBannerProps {
  onInkUpdate?: (newInk: number) => void;
}

export function CheckInBanner({ onInkUpdate }: CheckInBannerProps) {
  const { user, refreshUser } = useAuth();
  const [streak, setStreak] = useState(0);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [todayReward, setTodayReward] = useState(200);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const status = await checkinApi.status();
        if (cancelled) return;
        setStreak(status.streak);
        setAlreadyCheckedIn(status.checked_in_today);
        setTodayReward(status.next_reward.ink);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const data = await checkinApi.checkin();
      setStreak(data.streak);
      setAlreadyCheckedIn(true);

      await refreshUser?.();
      if (onInkUpdate && user) {
        onInkUpdate((user.ink ?? 0) + (data.reward.ink ?? 0));
      }

      toast.success("签到成功！", {
        description: data.reward.ink > 0 ? `获得 ${data.reward.ink} 墨水` : "今日已签到",
      });
    } catch (error) {
      toast.error("签到失败", {
        description: error instanceof ApiError ? error.message : "未知错误",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || initialLoading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 p-1 shadow-xl">
        <div className="relative flex items-center justify-between rounded-xl bg-gradient-to-r from-purple-600/95 via-purple-500/95 to-blue-500/95 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">每日签到</h3>
              <p className="text-sm text-white/80">连续签到 {streak} 天</p>
            </div>
          </div>

          <div className="hidden sm:block text-center">
            <p className="text-sm font-medium text-white/90">今日奖励</p>
            <p className="text-2xl font-bold text-white">+{todayReward} 墨水</p>
          </div>

          <div>
            <Button
              onClick={handleCheckIn}
              disabled={alreadyCheckedIn || loading}
              className={`min-w-[120px] ${
                alreadyCheckedIn
                  ? "bg-white/20 text-white hover:bg-white/20 cursor-default"
                  : "bg-white text-purple-600 hover:bg-white/90 font-semibold"
              }`}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  签到中...
                </>
              ) : alreadyCheckedIn ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  已签到
                </>
              ) : (
                "立即签到"
              )}
            </Button>
          </div>

          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs text-zinc-400">
        <span className="px-2 py-1 rounded bg-zinc-800/50">基础: +200</span>
        <span className="px-2 py-1 rounded bg-zinc-800/50">3天: +300</span>
        <span className="px-2 py-1 rounded bg-zinc-800/50">7天: +400</span>
        <span className="px-2 py-1 rounded bg-zinc-800/50">14天: +500</span>
      </div>
    </motion.div>
  );
}
