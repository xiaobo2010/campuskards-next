"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Swords,
  Flag,
  Loader2,
  Wifi,
  WifiOff,
  Droplets,
  SkipForward,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { matchApi } from "@/lib/api";
import { GameWsClient } from "@/lib/game-ws";
import { useMatchStore } from "@/store/useMatchStore";
import { useTurnTimer } from "@/hooks/use-turn-timer";
import BattleTurnTimer, { MatchElapsedClock } from "@/components/game/battle/battle-turn-timer";
import BattleTimerWarning from "@/components/game/battle/battle-timer-warning";
import BattleCard, {
  CardBackStack,
  EmptyBattleSlot,
  PlacementSlot,
} from "@/components/game/battle/battle-card";
import BattleResultScreen from "@/components/game/battle/battle-result-screen";
import type { BattleUnit, GameOverPayload, GameStatePayload } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  draw: "抽牌",
  main: "主阶段",
  combat: "战斗",
  end: "结束",
};

const MAX_FRONT_SLOTS = 5;
const MAX_SUPPORT_SLOTS = 4;

function isDeployableCard(card: BattleUnit): boolean {
  const t = (card.card_type ?? "character").toLowerCase();
  return t === "character" || t === "unit";
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
        <span className="text-xs font-mono text-zinc-300">
          {hp}/{maxHp}
        </span>
      </div>
      <div className="h-1.5 w-full max-w-[8rem] rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct > 50 ? "bg-red-500" : pct > 25 ? "bg-amber-500" : "bg-red-600 animate-pulse"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LineRow({
  label,
  icon,
  units,
  onUnitClick,
  selectedUid,
  interactive,
}: {
  label: string;
  icon?: React.ReactNode;
  units: BattleUnit[];
  onUnitClick?: (u: BattleUnit) => void;
  selectedUid?: string | null;
  interactive?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="flex gap-2 min-h-[8rem] flex-wrap justify-center items-end">
        {units.length === 0 ? (
          <EmptyBattleSlot />
        ) : (
          units.map((u) => (
            <BattleCard
              key={u.uid}
              unit={u}
              variant="field"
              selected={selectedUid === u.uid}
              onClick={interactive ? () => onUnitClick?.(u) : undefined}
              disabled={!interactive}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DeployLineRow({
  label,
  icon,
  units,
  lineKey,
  maxSlots,
  onUnitClick,
  selectedUid,
  interactive,
  placementCard,
  onPlacementSelect,
  onDropCard,
}: {
  label: string;
  icon?: React.ReactNode;
  units: BattleUnit[];
  lineKey: "front" | "support";
  maxSlots: number;
  onUnitClick?: (u: BattleUnit) => void;
  selectedUid?: string | null;
  interactive?: boolean;
  placementCard?: BattleUnit | null;
  onPlacementSelect?: (line: "front" | "support") => void;
  onDropCard?: (cardUid: string, line: "front" | "support") => void;
}) {
  const canPlaceMore = units.length < maxSlots;
  const showPlacementSlot = !!placementCard && canPlaceMore;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
        {icon}
        {label}
        {showPlacementSlot && (
          <span className="text-purple-400 normal-case tracking-normal">· 点击虚线框放置</span>
        )}
      </div>
      <div
        className={cn(
          "flex gap-2 min-h-[8rem] flex-wrap justify-center items-end rounded-xl p-1 transition-colors",
          placementCard && canPlaceMore && "bg-purple-500/5"
        )}
        onDragOver={(e) => {
          if (!canPlaceMore) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!canPlaceMore) return;
          const uid = e.dataTransfer.getData("text/card-uid");
          if (uid) onDropCard?.(uid, lineKey);
        }}
      >
        {units.map((u) => (
          <BattleCard
            key={u.uid}
            unit={u}
            variant="field"
            selected={selectedUid === u.uid}
            onClick={interactive ? () => onUnitClick?.(u) : undefined}
            disabled={!interactive}
          />
        ))}
        {showPlacementSlot && (
          <PlacementSlot
            active
            lineLabel={label}
            onClick={() => onPlacementSelect?.(lineKey)}
          />
        )}
        {!placementCard && units.length === 0 && <EmptyBattleSlot />}
      </div>
    </div>
  );
}

function PlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const wsRef = useRef<GameWsClient | null>(null);
  const [matchElapsed, setMatchElapsed] = useState(0);

  const matchIdFromUrl = searchParams.get("match_id");
  const storedMatchId = useMatchStore((s) => s.currentGameId);
  const opponent = useMatchStore((s) => s.opponent);
  const gameState = useMatchStore((s) => s.gameState);
  const connectionStatus = useMatchStore((s) => s.connectionStatus);
  const lastError = useMatchStore((s) => s.lastError);
  const selectedAttackerUid = useMatchStore((s) => s.selectedAttackerUid);

  const setGameState = useMatchStore((s) => s.setGameState);
  const setConnectionStatus = useMatchStore((s) => s.setConnectionStatus);
  const setLastError = useMatchStore((s) => s.setLastError);
  const setSelectedAttackerUid = useMatchStore((s) => s.setSelectedAttackerUid);
  const setCurrentGame = useMatchStore((s) => s.setCurrentGame);
  const resetMatch = useMatchStore((s) => s.resetMatch);

  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [surrendering, setSurrendering] = useState(false);
  const [placementCard, setPlacementCard] = useState<BattleUnit | null>(null);

  const matchId = matchIdFromUrl || storedMatchId;
  const viewer = gameState?.viewer ?? "p1";
  const me = gameState?.players[viewer];
  const oppKey = gameState?.opponent ?? (viewer === "p1" ? "p2" : "p1");
  const opp = gameState ? gameState.players[oppKey] : null;
  const isMyTurn = gameState?.current_player === viewer;
  const phase = gameState?.phase ?? "draw";

  const {
    secondsLeft,
    turnLimit,
    warningAt,
    showWarning,
    onTurnStart,
    onTimerWarning,
    dismissWarning,
    syncFromServer,
  } = useTurnTimer(isMyTurn);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (matchIdFromUrl && matchIdFromUrl !== storedMatchId) {
      setCurrentGame(matchIdFromUrl, opponent);
    }
  }, [matchIdFromUrl, storedMatchId, setCurrentGame, opponent]);

  useEffect(() => {
    if (!matchId || !user) return;

    const client = new GameWsClient(matchId, {
      onGameState: (state: GameStatePayload) => {
        setGameState(state);
        syncFromServer(state);
        if (state.match_elapsed != null) setMatchElapsed(state.match_elapsed);
        if (state.game_over) setSelectedAttackerUid(null);
      },
      onTurnStart: (payload) => {
        onTurnStart(payload);
        setSelectedAttackerUid(null);
      },
      onTimerWarning: (payload) => {
        onTimerWarning();
        if (payload.player === viewer) {
          toast.warning(`剩余 ${payload.seconds_left} 秒，请尽快行动！`, { duration: 5000 });
        }
      },
      onTurnTimeout: (payload) => {
        if (payload.player === viewer) {
          toast.info("回合时间已到，自动结束回合");
        } else {
          toast.info("对手回合超时");
        }
        setSelectedAttackerUid(null);
      },
      onGameOver: (payload) => {
        setGameOver(payload);
        setSelectedAttackerUid(null);
      },
      onError: (detail) => {
        setLastError(detail);
        toast.error(detail);
      },
      onStatusChange: setConnectionStatus,
    });

    wsRef.current = client;
    client.connect();
    return () => {
      client.disconnect();
      wsRef.current = null;
    };
  }, [
    matchId,
    user,
    viewer,
    setGameState,
    setConnectionStatus,
    setLastError,
    setSelectedAttackerUid,
    onTurnStart,
    onTimerWarning,
    syncFromServer,
  ]);

  // 本地对局时钟 tick
  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const id = setInterval(() => setMatchElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [connectionStatus]);

  const handlePlayCard = (card: BattleUnit, line: "front" | "support" = "front") => {
    if (!isMyTurn || phase !== "main" || !me) {
      toast.info("只能在己方主阶段出牌");
      return;
    }
    if (card.cost != null && card.cost > me.ink) {
      toast.error("墨水不足");
      return;
    }
    const targetLine = line === "front" ? me.front_line : me.support_line;
    const maxSlots = line === "front" ? MAX_FRONT_SLOTS : MAX_SUPPORT_SLOTS;
    if (isDeployableCard(card) && targetLine.length >= maxSlots) {
      toast.error(`${line === "front" ? "前线" : "支援"}已满`);
      return;
    }
    wsRef.current?.playCard(card.uid, line);
    setPlacementCard(null);
  };

  const handleHandDoubleClick = (card: BattleUnit) => {
    if (!isMyTurn || phase !== "main") {
      toast.info("只能在己方主阶段出牌");
      return;
    }
    if (card.cost != null && me && card.cost > me.ink) {
      toast.error("墨水不足");
      return;
    }
    if (!isDeployableCard(card)) {
      handlePlayCard(card, "front");
      return;
    }
    setPlacementCard((prev) => (prev?.uid === card.uid ? null : card));
  };

  const handleDropOnLine = (cardUid: string, line: "front" | "support") => {
    const card = me?.hand?.find((c) => c.uid === cardUid);
    if (!card) return;
    handlePlayCard(card, line);
  };

  const handleMyUnitClick = (unit: BattleUnit) => {
    if (!isMyTurn) return;
    if (unit.can_attack && (phase === "combat" || phase === "main")) {
      setSelectedAttackerUid(selectedAttackerUid === unit.uid ? null : unit.uid);
    }
  };

  const handleEnemyUnitClick = (unit: BattleUnit) => {
    if (!selectedAttackerUid || !isMyTurn) return;
    wsRef.current?.attack([selectedAttackerUid], unit.uid);
    setSelectedAttackerUid(null);
  };

  const handleFaceAttack = () => {
    if (!selectedAttackerUid || !isMyTurn) return;
    wsRef.current?.attack([selectedAttackerUid], null);
    setSelectedAttackerUid(null);
  };

  const handleEndTurn = () => {
    if (!isMyTurn) {
      toast.info("还没轮到你");
      return;
    }
    wsRef.current?.endTurn();
    setSelectedAttackerUid(null);
  };

  const handleSurrender = async () => {
    if (!matchId || surrendering) return;
    if (!confirm("确定要投降吗？")) return;
    setSurrendering(true);
    try {
      await matchApi.surrender(matchId);
      toast.info("已投降");
    } catch {
      toast.error("投降失败");
    } finally {
      setSurrendering(false);
    }
  };

  const handleBackToLobby = () => {
    resetMatch();
    router.push("/game/matchmaking");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!matchId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-zinc-950 text-center">
        <Swords className="w-12 h-12 text-zinc-600" />
        <p className="text-zinc-400">没有进行中的对战</p>
        <Button asChild className="bg-purple-600 hover:bg-purple-700">
          <Link href="/game/matchmaking">前往匹配</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-foreground flex flex-col select-none">
      <BattleTimerWarning
        open={showWarning}
        secondsLeft={secondsLeft}
        onDismiss={dismissWarning}
      />

      {/* 顶栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          {connectionStatus === "connected" ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <MatchElapsedClock elapsed={matchElapsed} />
          <span className="text-xs text-zinc-600 hidden sm:inline">·</span>
          <span className="text-xs text-zinc-500 hidden sm:inline">回合 {gameState?.turn ?? "—"}</span>
        </div>

        <BattleTurnTimer
          secondsLeft={secondsLeft}
          turnLimit={turnLimit}
          isMyTurn={isMyTurn}
          warningAt={warningAt}
        />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-red-400 hover:text-red-300 shrink-0"
          onClick={handleSurrender}
          disabled={surrendering || gameState?.game_over}
        >
          投降
        </Button>
      </header>

      <div className="flex-1 flex flex-col p-3 gap-3 max-w-4xl mx-auto w-full">
        {/* 对手区 */}
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-900/30 bg-gradient-to-b from-red-950/20 to-zinc-900/40 p-3 shadow-inner"
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-9 h-9 border border-red-800/50">
                <AvatarFallback className="bg-red-950 text-red-300 text-xs">
                  {opponent?.username?.slice(0, 2) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-zinc-100 truncate">
                  {opponent?.username ?? "对手"}
                </p>
                <p className="text-[10px] text-zinc-500">ELO {opponent?.elo ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {opp && (
                <>
                  <CardBackStack count={opp.hand_count ?? opp.hand?.length ?? 0} />
                  <div className="text-right">
                    {opp && <HpBar hp={opp.hp} maxHp={opp.max_hp} />}
                    <p className="text-[10px] text-zinc-500 mt-1 flex items-center justify-end gap-0.5">
                      <Droplets className="w-3 h-3 text-sky-400" />
                      {opp.ink}/{opp.max_ink}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          {opp && (
            <div className="space-y-3">
              <LineRow
                label="前线"
                icon={<Swords className="w-3 h-3" />}
                units={opp.front_line}
                onUnitClick={handleEnemyUnitClick}
                interactive={!!selectedAttackerUid && isMyTurn}
              />
              <LineRow
                label="支援"
                icon={<Shield className="w-3 h-3" />}
                units={opp.support_line}
              />
            </div>
          )}
        </motion.section>

        {/* 中央状态 */}
        <section className="flex flex-col items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border",
                isMyTurn
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-800/80 border-zinc-700 text-zinc-500"
              )}
            >
              {isMyTurn ? "你的回合" : "对手思考中"}
            </span>
            <span className="px-2 py-1 rounded-full text-xs bg-zinc-800/80 border border-zinc-700 text-zinc-400">
              {PHASE_LABEL[phase] ?? phase}
            </span>
          </div>

          {selectedAttackerUid && isMyTurn && (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                onClick={handleFaceAttack}
              >
                <Flag className="w-3.5 h-3.5" />
                直击对手
              </Button>
            </motion.div>
          )}

          {lastError && (
            <p className="text-xs text-red-400 text-center max-w-sm">{lastError}</p>
          )}
        </section>

        {/* 我方战场 */}
        {me && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-900/30 bg-gradient-to-b from-emerald-950/15 to-zinc-900/40 p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <HpBar hp={me.hp} maxHp={me.max_hp} />
              <div className="text-right text-xs text-zinc-500 space-y-0.5">
                <p className="flex items-center justify-end gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-mono text-sky-300">
                    {me.ink}/{me.max_ink}
                  </span>
                  <span className="text-zinc-600">墨水</span>
                </p>
                <p>牌库 {me.deck_count} · 墓地 {me.pen_count}</p>
              </div>
            </div>
            <div className="space-y-3">
              <DeployLineRow
                label="前线"
                icon={<Swords className="w-3 h-3 text-emerald-500" />}
                units={me.front_line}
                lineKey="front"
                maxSlots={MAX_FRONT_SLOTS}
                onUnitClick={handleMyUnitClick}
                selectedUid={selectedAttackerUid}
                interactive={isMyTurn}
                placementCard={placementCard}
                onPlacementSelect={(line) => placementCard && handlePlayCard(placementCard, line)}
                onDropCard={handleDropOnLine}
              />
              <DeployLineRow
                label="支援"
                icon={<Shield className="w-3 h-3 text-emerald-500" />}
                units={me.support_line}
                lineKey="support"
                maxSlots={MAX_SUPPORT_SLOTS}
                onUnitClick={handleMyUnitClick}
                selectedUid={selectedAttackerUid}
                interactive={isMyTurn}
                placementCard={placementCard}
                onPlacementSelect={(line) => placementCard && handlePlayCard(placementCard, line)}
                onDropCard={handleDropOnLine}
              />
            </div>
          </motion.section>
        )}

        {/* 手牌与操作 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-purple-800/30 bg-gradient-to-t from-purple-950/20 to-zinc-900/60 p-3 pb-4"
        >
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 text-center">
            手牌 · 拖拽到阵线 / 双击选择放置位置
            {placementCard && (
              <button
                type="button"
                className="ml-2 text-purple-400 normal-case"
                onClick={() => setPlacementCard(null)}
              >
                取消
              </button>
            )}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 justify-center min-h-[7.5rem] items-end">
            {me?.hand && me.hand.length > 0 ? (
              me.hand.map((card) => (
                <BattleCard
                  key={card.uid}
                  unit={card}
                  variant="hand"
                  draggable={isMyTurn && phase === "main" && isDeployableCard(card)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/card-uid", card.uid);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDoubleClick={() => handleHandDoubleClick(card)}
                  placementPending={placementCard?.uid === card.uid}
                  disabled={!isMyTurn || phase !== "main"}
                  affordable={card.cost == null || card.cost <= (me?.ink ?? 0)}
                />
              ))
            ) : (
              <p className="text-xs text-zinc-600 self-center py-6">
                {connectionStatus === "connected" ? "暂无手牌" : "连接中..."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center items-center mt-2">
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-500"
              onClick={handleEndTurn}
              disabled={!isMyTurn || gameState?.game_over}
            >
              <SkipForward className="w-4 h-4" />
              结束回合
            </Button>
          </div>
        </motion.section>
      </div>

      {gameOver && gameState && (
        <BattleResultScreen
          gameOver={gameOver}
          viewer={viewer}
          userId={user?.id}
          matchId={matchId ?? undefined}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}
