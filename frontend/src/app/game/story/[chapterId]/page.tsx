"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { storyApi } from "@/lib/api";
import type { StoryChapter, StoryLevelSummary } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Star, Lock, Swords, Crown, Trophy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/lib/story-constants";

export default function ChapterMapPage() {
  const params = useParams();
  const router = useRouter();
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<StoryChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChapter();
  }, [chapterId]);

  async function loadChapter() {
    setLoading(true);
    try {
      const data = await storyApi.getChapter(chapterId);
      setChapter(data);
    } catch {
      setError("加载章节失败");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "章节不存在"}</p>
        <Button onClick={() => router.push("/game/story")} variant="outline">返回</Button>
      </div>
    );
  }

  const isBossLevel = (level: StoryLevelSummary, idx: number) => idx === chapter.levels.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/game/story" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回章节列表
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">{chapter.title}</h1>
          {chapter.subtitle && <p className="text-zinc-400 mt-1">{chapter.subtitle}</p>}
          <div className="flex items-center gap-3 mt-3 text-sm text-zinc-500">
            <span>{chapter.completed_levels}/{chapter.total_levels} 关</span>
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>{chapter.total_stars} 星</span>
          </div>
        </div>

        {/* Level nodes */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-800" />

          <div className="space-y-6 relative">
            {chapter.levels.map((level, idx) => (
              <LevelNode
                key={level.id}
                level={level}
                isBoss={isBossLevel(level, idx)}
                chapterId={chapterId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LevelNode({
  level,
  isBoss,
  chapterId,
}: {
  level: StoryLevelSummary;
  isBoss: boolean;
  chapterId: string;
}) {
  const isLocked = !level.unlocked;
  const isCompleted = level.completed;

  return (
    <div className="flex items-start gap-4 relative">
      {/* Node icon */}
      <div
        className={cn(
          "relative z-10 w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
          isCompleted && "bg-amber-500/20 border-amber-400",
          !isCompleted && !isLocked && "bg-zinc-800 border-zinc-600",
          isLocked && "bg-zinc-900 border-zinc-800 opacity-50",
          isBoss && !isLocked && "ring-2 ring-amber-500/30",
        )}
      >
        {isCompleted ? (
          <div className="flex items-center justify-center gap-0.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-300">{level.stars}</span>
          </div>
        ) : isLocked ? (
          <Lock className="w-5 h-5 text-zinc-600" />
        ) : isBoss ? (
          <Crown className="w-5 h-5 text-amber-400" />
        ) : (
          <Swords className="w-5 h-5 text-zinc-400" />
        )}
      </div>

      {/* Card */}
      {isLocked ? (
        <Card className="flex-1 border-zinc-800 bg-zinc-900/50 opacity-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-600">关{level.level_num} · 未解锁</p>
                <p className="text-xs text-zinc-700">请先完成前置关卡</p>
              </div>
              <Lock className="w-4 h-4 text-zinc-600" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Link href={`/game/story/${chapterId}/${level.id}`} className="flex-1">
          <Card
            className={cn(
              "border-zinc-800 bg-zinc-900/70 hover:border-amber-500/30 transition-all cursor-pointer",
              isCompleted && "border-amber-500/20",
              isBoss && "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-zinc-900/70",
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">关{level.level_num}</span>
                    {isBoss && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    <span className={cn("text-xs px-1.5 py-0.5 rounded border", DIFFICULTY_COLORS[level.difficulty])}>
                      {DIFFICULTY_LABELS[level.difficulty]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-100">{level.title}</p>
                  <p className="text-xs text-zinc-500">{level.enemy_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-zinc-500">
                    <p>{level.rewards.ink} 墨水</p>
                    {level.rewards.cards.length > 0 && <p className="text-amber-400">+卡牌</p>}
                  </div>
                  {isCompleted ? (
                    <div className="flex items-center gap-0.5 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span className="text-xs font-bold">{level.stars}/3</span>
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
