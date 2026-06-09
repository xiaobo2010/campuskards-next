"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Zap, Trophy, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { decksApi, matchApi, ApiError } from "@/lib/api";
import { useMatchStore } from "@/store/useMatchStore";
import type { DeckListItem } from "@/types";
import { toast } from "sonner";
import { formatFaction } from "@/lib/faction-labels";

type MatchMode = "quick" | "ranked";
type MatchState = "idle" | "searching" | "found";

export default function MatchmakingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const setCurrentGame = useMatchStore((s) => s.setCurrentGame);

  const [selectedMode, setSelectedMode] = useState<MatchMode>("quick");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [searchTime, setSearchTime] = useState(0);
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [loadingDecks, setLoadingDecks] = useState(true);
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("请先登录");
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    decksApi
      .list()
      .then((list) => {
        setDecks(list);
        if (list.length > 0) {
          setSelectedDeckId(list[0].id);
        }
      })
      .catch(() => toast.error("加载卡组失败"))
      .finally(() => setLoadingDecks(false));
  }, [user]);

  useEffect(() => {
    if (matchState !== "searching") return;
    const timer = setInterval(() => setSearchTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [matchState]);

  const pollStatus = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const status = await matchApi.queueStatus();
      if (status.status === "matched" && status.match_id) {
        setCurrentGame(status.match_id, status.opponent ?? null);
        setMatchState("found");
        toast.success("匹配成功！正在进入对局...");
        setTimeout(() => {
          router.push(`/game/play?match_id=${status.match_id}`);
        }, 1500);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "查询匹配状态失败";
      toast.error(msg);
    } finally {
      pollingRef.current = false;
    }
  }, [router, setCurrentGame]);

  useEffect(() => {
    if (matchState !== "searching") return;
    const interval = setInterval(pollStatus, 2000);
    pollStatus();
    return () => clearInterval(interval);
  }, [matchState, pollStatus]);

  const handleStartPve = async () => {
    if (!selectedDeckId) {
      toast.error("请先创建并选择一套卡组");
      return;
    }
    try {
      const res = await matchApi.startPve(selectedDeckId);
      setCurrentGame(res.match_id, res.opponent);
      setMatchState("found");
      toast.success("训练对局已创建，正在进入...");
      setTimeout(() => {
        router.push(`/game/play?match_id=${res.match_id}`);
      }, 800);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "无法开始 PVE 对局";
      toast.error(msg);
    }
  };

  const handleStartMatch = async () => {
    if (!selectedDeckId) {
      toast.error("请先创建并选择一套卡组");
      return;
    }
    try {
      const res = await matchApi.joinQueue(selectedDeckId, selectedMode);
      if (res.status === "matched" && res.match_id) {
        setCurrentGame(res.match_id, null);
        setMatchState("found");
        toast.success("匹配成功！正在进入对局...");
        setTimeout(() => {
          router.push(`/game/play?match_id=${res.match_id}`);
        }, 800);
        return;
      }
      setMatchState("searching");
      setSearchTime(0);
      toast.info(`开始${selectedMode === "quick" ? "快速匹配" : "排位赛"}匹配...`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "加入匹配队列失败";
      toast.error(msg);
    }
  };

  const handleCancelMatch = async () => {
    try {
      await matchApi.leaveQueue(selectedMode);
    } catch {
      // already left queue
    }
    setMatchState("idle");
    setSearchTime(0);
    toast.info("已取消匹配");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950">
        <div className="text-purple-300">加载中...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-6"
      style={{
        backgroundImage: "url(/images/lobby-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-black/70 pointer-events-none -z-10" />

      <div className="relative z-10 max-w-2xl w-full">
        <AnimatePresence mode="wait">
          {matchState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-zinc-900/90 border-purple-500/30 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-3xl text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    选择对战模式
                  </CardTitle>
                  <CardDescription className="text-center text-zinc-400">
                    选择卡组与匹配模式，开始卡牌对战
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">出战卡组</label>
                    {loadingDecks ? (
                      <p className="text-zinc-500 text-sm">加载卡组中...</p>
                    ) : decks.length === 0 ? (
                      <p className="text-zinc-400 text-sm">
                        还没有卡组，请先到{" "}
                        <Link href="/game/deck-builder" className="text-purple-400 underline">
                          卡组构筑
                        </Link>{" "}
                        创建一套。
                      </p>
                    ) : (
                      <select
                        value={selectedDeckId}
                        onChange={(e) => setSelectedDeckId(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 text-sm"
                      >
                        {decks.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({formatFaction(d.faction_code)}) · {d.card_count ?? "?"} 张
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedMode("quick")}
                      className={`relative p-6 rounded-xl border-2 transition-all ${
                        selectedMode === "quick"
                          ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <Zap className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                          <h3 className="text-xl font-bold text-zinc-100">快速匹配</h3>
                          <p className="text-sm text-zinc-400 mt-1">休闲对战</p>
                        </div>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedMode("ranked")}
                      className={`relative p-6 rounded-xl border-2 transition-all ${
                        selectedMode === "ranked"
                          ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                          <h3 className="text-xl font-bold text-zinc-100">排位赛</h3>
                          <p className="text-sm text-zinc-400 mt-1">竞技对战，影响 ELO</p>
                        </div>
                      </div>
                    </motion.button>
                  </div>

                  <p className="text-xs text-zinc-500 text-center">
                    快速与排位使用独立匹配队列；排位赛胜负将影响 ELO。
                  </p>

                  <Button
                    onClick={handleStartMatch}
                    disabled={!selectedDeckId || loadingDecks}
                    className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Swords className="w-5 h-5 mr-2" />
                    开始匹配
                  </Button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-zinc-700" />
                    <span className="mx-3 text-xs text-zinc-500">或</span>
                    <div className="flex-grow border-t border-zinc-700" />
                  </div>

                  <Button
                    onClick={handleStartPve}
                    disabled={!selectedDeckId || loadingDecks}
                    variant="outline"
                    className="w-full h-12 border-emerald-600/50 text-emerald-300 hover:bg-emerald-950/40"
                  >
                    <Bot className="w-5 h-5 mr-2" />
                    单人练习（对战 AI）
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {matchState === "searching" && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="bg-zinc-900/90 border-purple-500/30 shadow-2xl">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 rounded-full border-4 border-purple-500/30 border-t-purple-500"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Swords className="w-16 h-16 text-purple-400" />
                      </motion.div>
                    </div>
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-zinc-100">正在匹配对手...</h2>
                      <p className="text-zinc-400">
                        {selectedMode === "quick" ? "快速匹配" : "排位赛"} · 已等待 {searchTime} 秒
                      </p>
                    </div>
                    <Button
                      onClick={handleCancelMatch}
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消匹配
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {matchState === "found" && (
            <motion.div
              key="found"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="bg-zinc-900/90 border-emerald-500/50 shadow-2xl shadow-emerald-500/20">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                      <Swords className="w-16 h-16 text-white" />
                    </div>
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-bold text-emerald-400">匹配成功！</h2>
                      <p className="text-zinc-400">正在进入对局...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
