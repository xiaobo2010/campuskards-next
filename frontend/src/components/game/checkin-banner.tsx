"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Check, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { checkinApi, ApiError } from "@/lib/api";

const REWARD_RULES = [
  { label: "每日基础", ink: 200 },
  { label: "连续 3 天", ink: 300 },
  { label: "连续 7 天", ink: 400 },
  { label: "连续 14 天", ink: 500 },
];

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
  const [serviceError, setServiceError] = useState<string | null>(null);

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
        setServiceError(null);
      } catch (error) {
        if (!cancelled) {
          const msg =
            error instanceof ApiError
              ? error.message
              : "签到服务暂时不可用，请稍后重试";
          setServiceError(msg);
        }
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
      setServiceError(null);

      await refreshUser?.();
      if (onInkUpdate && user) {
        onInkUpdate((user.ink ?? 0) + (data.reward.ink ?? 0));
      }

      toast.success("签到成功！", {
        description: data.reward.ink > 0 ? `获得 ${data.reward.ink} 墨水` : "今日已签到",
      });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "未知错误";
      setServiceError(msg);
      toast.error("签到失败", { description: msg });
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
        <div className="relative flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-purple-600/95 via-purple-500/95 to-blue-500/95 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">每日签到</h3>
              <p className="text-sm text-white/80">连续签到 {streak} 天</p>
              {serviceError && (
                <p className="text-xs text-red-200 mt-1">{serviceError}</p>
              )}
            </div>
          </div>

          <div className="hidden sm:block text-center">
            <p className="text-sm font-medium text-white/90">今日奖励</p>
            <p className="text-2xl font-bold text-white">+{todayReward} 墨水</p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white hover:bg-white/20 hover:text-white"
                  aria-label="签到规则"
                >
                  <Info className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-3">
                <p className="text-sm font-semibold mb-2">签到奖励规则</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {REWARD_RULES.map((rule) => (
                    <li key={rule.label} className="flex justify-between gap-4">
                      <span>{rule.label}</span>
                      <span className="font-medium text-foreground">+{rule.ink} 墨水</span>
                    </li>
                  ))}
                </ul>
              </DropdownMenuContent>
            </DropdownMenu>

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
    </motion.div>
  );
}
