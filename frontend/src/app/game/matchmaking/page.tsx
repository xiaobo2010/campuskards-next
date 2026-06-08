"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Zap, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type MatchMode = "quick" | "ranked";
type MatchState = "idle" | "searching" | "found";

export default function MatchmakingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedMode, setSelectedMode] = useState<MatchMode>("quick");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [searchTime, setSearchTime] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("请先登录");
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  // Search timer
  useEffect(() => {
    if (matchState !== "searching") return;

    const timer = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [matchState]);

  // Mock matching flow
  useEffect(() => {
    if (matchState !== "searching") return;

    // TODO: 后端接入点 - POST /api/game/matchmaking/
    // TODO: WebSocket 连接 - ws://host/ws/game/match/{match_id}
    const matchDelay = 3000 + Math.random() * 2000; // 3-5 seconds
    const timeout = setTimeout(() => {
      setMatchState("found");
      toast.success("匹配成功！正在进入对局...");

      // Redirect to game after 2 seconds
      setTimeout(() => {
        router.push("/game/play");
      }, 2000);
    }, matchDelay);

    return () => clearTimeout(timeout);
  }, [matchState, router]);

  const handleStartMatch = () => {
    setMatchState("searching");
    setSearchTime(0);
    toast.info(`开始${selectedMode === "quick" ? "快速匹配" : "排位赛"}匹配...`);
  };

  const handleCancelMatch = () => {
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

  if (!user) {
    return null; // Will redirect
  }

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
      {/* Blur + dark overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/70 -z-10" />

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
                    选择你喜欢的匹配模式，开始卡牌对战
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mode Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Quick Match */}
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
                          <p className="text-sm text-zinc-400 mt-1">休闲对战，不影响排名</p>
                        </div>
                      </div>
                      {selectedMode === "quick" && (
                        <motion.div
                          layoutId="selectedIndicator"
                          className="absolute top-2 right-2 w-3 h-3 rounded-full bg-purple-500"
                        />
                      )}
                    </motion.button>

                    {/* Ranked Match */}
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
                          <p className="text-sm text-zinc-400 mt-1">竞技对战，提升排名</p>
                        </div>
                      </div>
                      {selectedMode === "ranked" && (
                        <motion.div
                          layoutId="selectedIndicator"
                          className="absolute top-2 right-2 w-3 h-3 rounded-full bg-purple-500"
                        />
                      )}
                    </motion.button>
                  </div>

                  {/* Start Button */}
                  <Button
                    onClick={handleStartMatch}
                    className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Swords className="w-5 h-5 mr-2" />
                    开始匹配
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
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-zinc-900/90 border-purple-500/30 shadow-2xl">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    {/* Spinning Animation */}
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

                    {/* Status Text */}
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-zinc-100">正在匹配对手...</h2>
                      <p className="text-zinc-400">
                        {selectedMode === "quick" ? "快速匹配" : "排位赛"} · 已等待 {searchTime} 秒
                      </p>
                    </div>

                    {/* Cancel Button */}
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
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-zinc-900/90 border-emerald-500/50 shadow-2xl shadow-emerald-500/20">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col items-center space-y-6">
                    {/* Success Animation */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center"
                    >
                      <Swords className="w-16 h-16 text-white" />
                    </motion.div>

                    {/* Status Text */}
                    <div className="text-center space-y-2">
                      <h2 className="text-3xl font-bold text-emerald-400">匹配成功！</h2>
                      <p className="text-zinc-400">正在进入对局...</p>
                    </div>

                    {/* Loading dots */}
                    <div className="flex space-x-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                          className="w-3 h-3 rounded-full bg-emerald-500"
                        />
                      ))}
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
