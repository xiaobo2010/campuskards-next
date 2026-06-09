"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { matchApi, ApiError } from "@/lib/api";
import type { MatchDetail } from "@/types";
import BattleReplayPlayer from "@/components/game/battle-replay-player";
import { toast } from "sonner";

interface MatchReplaySectionProps {
  matchId: string;
  myUserId?: string;
  compact?: boolean;
}

export default function MatchReplaySection({
  matchId,
  myUserId,
  compact = false,
}: MatchReplaySectionProps) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    matchApi
      .getMatch(matchId)
      .then((data) => {
        if (!cancelled) setMatch(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : "加载回放失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const events = match?.replay_data?.event_log ?? [];
  const mySlot =
    myUserId && match
      ? match.p1.id === myUserId
        ? ("p1" as const)
        : match.p2.id === myUserId
          ? ("p2" as const)
          : undefined
      : undefined;

  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">
        {match?.status === "active"
          ? "对局进行中，暂无回放"
          : "该对局暂无回放数据"}
      </p>
    );
  }

  return (
    <BattleReplayPlayer
      events={events}
      players={match?.replay_data?.players}
      mySlot={mySlot}
      compact={compact}
    />
  );
}
