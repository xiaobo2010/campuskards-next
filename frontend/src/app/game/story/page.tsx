"use client";

import { useEffect } from "react";
import Link from "next/link";
import { storyApi } from "@/lib/api";
import { useStoryStore } from "@/store/useStoryStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, BookOpen, Star, Lock, ChevronRight, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryChapter } from "@/types";

export default function StoryPage() {
  const { chapters, loading, error, setChapters, setLoading, setError } = useStoryStore();

  useEffect(() => {
    loadChapters();
  }, []);

  async function loadChapters() {
    setLoading(true);
    setError(null);
    try {
      const data = await storyApi.listChapters();
      setChapters(data.chapters);
    } catch {
      setError("加载章节失败，请稍后重试");
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadChapters}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Map className="w-7 h-7 text-amber-400" />
            <h1 className="text-3xl font-bold text-zinc-100">故事模式</h1>
          </div>
          <p className="text-zinc-400">在校园故事中挑战AI对手，解锁奖励，成为校园最强</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>

        {chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <BookOpen className="w-16 h-16 text-zinc-600 mb-4" />
            <p className="text-zinc-500 text-lg">暂无可用章节</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterCard({ chapter }: { chapter: StoryChapter }) {
  const isLocked = !chapter.unlocked;

  return (
    <Link href={isLocked ? "#" : `/game/story/${chapter.id}`}>
      <Card
        className={cn(
          "border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 transition-all overflow-hidden",
          !isLocked && "hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-900/10 cursor-pointer",
          isLocked && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Cover area */}
        <div className="relative h-32 bg-gradient-to-r from-amber-900/30 via-purple-900/20 to-zinc-900 flex items-center justify-center">
          {isLocked ? (
            <Lock className="w-10 h-10 text-zinc-600" />
          ) : (
            <div className="text-center">
              <BookOpen className="w-8 h-8 text-amber-400/60 mx-auto mb-1" />
              <span className="text-xs text-amber-400/60 font-mono">
                第{chapter.chapter_num}章
              </span>
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-zinc-100">{chapter.title}</CardTitle>
          {chapter.subtitle && (
            <CardDescription className="text-zinc-500 text-sm">{chapter.subtitle}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>进度</span>
              <span>{chapter.completed_levels}/{chapter.total_levels}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                style={{
                  width: chapter.total_levels > 0
                    ? `${(chapter.completed_levels / chapter.total_levels) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>

          {/* Stars */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>{chapter.total_stars} 星</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-600" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
