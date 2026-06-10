"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Swords,
  Flag,
  Loader2,
  Wifi,
  WifiOff,
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
import EffectChoiceDialog from "@/components/game/battle/effect-choice-dialog";
import DiscardChoiceDialog from "@/components/game/battle/discard-choice-dialog";
import { HpBar, InkBadge } from "@/components/game/battle/battle-hud";
import { branchNeedsTarget } from "@/lib/effect-choice-utils";
import type {
  BattleUnit,
  EffectChoiceOption,
  GameOverPayload,
  GameStatePayload,
} from "@/types";
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

function LineRow({
  label,
  icon,
  units,
  onUnitClick,
  selectedUid,
  interactive,
  choiceTargetMode,
}: {
  label: string;
  icon?: React.ReactNode;
  units: BattleUnit[];
  onUnitClick?: (u: BattleUnit) => void;
  selectedUid?: string | null;
  interactive?: boolean;
  targetHighlightUid?: string | null;
  choiceTargetMode?: boolean;
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
              targetHighlight={choiceTargetMode}
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
  onUnitDoubleClick,
  onMoveUnit,
}: {
  label: string;
  icon?: React.ReactNode;
  units: BattleUnit[];
  lineKey: "front" | "support";
  maxSlots: number;
  onUnitClick?: (u: BattleUnit) => void;
  onUnitDoubleClick?: (u: BattleUnit) => void;
  selectedUid?: string | null;
  interactive?: boolean;
  placementCard?: BattleUnit | null;
  onPlacementSelect?: (line: "front" | "support") => void;
  onDropCard?: (cardUid: string, line: "front" | "support") => void;
  onMoveUnit?: (unitId: string) => void;
}) {
  const canPlaceMore = units.length < maxSlots;
  const showPlacementSlot = !!placementCard && canPlaceMore;
  const otherLine = lineKey === "front" ? "support" : "front";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
        {icon}
        {label}
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
        {showPlacementSlot && (
          <PlacementSlot
            lineLabel={label}
            onClick={() => onPlacementSelect?.(lineKey)}
          />
        )}
        {units.map((u) => (
          <div key={u.uid} className="relative shrink-0">
            <BattleCard
              unit={u}
              variant="field"
              selected={selectedUid === u.uid}
              onClick={interactive ? () => onUnitClick?.(u) : undefined}
              onDoubleClick={interactive ? () => onUnitDoubleClick?.(u) : undefined}
              disabled={!interactive}
            />
            {interactive && onMoveUnit && (
              <button
                type="button"
                title={`移到${otherLine === "front" ? "前线" : "支援"}`}
                onClick={(e) => { e.stopPropagation(); onMoveUnit(u.uid); }}
                className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow transition-colors"
              >
                ⇄
              </button>
            )}
          </div>
        ))}
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

  const matchIdFromUrl = searchParams.get("matchId");
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
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [placementCard, setPlacementCard] = useState<BattleUnit | null>(null);
  const [choiceOptionId, setChoiceOptionId] = useState<string | null>(null);
  const [choiceAwaitingTarget, setChoiceAwaitingTarget] = useState(false);
  const [discardSelected, setDiscardSelected] = useState<string[]>([]);
  const [abilityTargetMode, setAbilityTargetMode] = useState<string | null>(null);
  const [spellTargetMode, setSpellTargetMode] = useState<BattleUnit | null>(null);

  const matchId = matchIdFromUrl || storedMatchId;
  const viewer = gameState?.viewer ?? "p1";
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const me = gameState?.players[viewer];
  const oppKey = gameState?.opponent ?? (viewer === "p1" ? "p2" : "p1");
  const opp = gameState ? gameState.players[oppKey] : null;
  const isMyTurn = gameState?.current_player === viewer;
  const phase = gameState?.phase ?? "draw";
  const pendingChoice = gameState?.pending_choice ?? null;
  const showChoiceDialog =
    !!pendingChoice && isMyTurn && pendingChoice.context !== "discard";

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
    if (!authLoading && !user) router.replace("/auth/login");
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
        if (!state.pending_choice) {
          setChoiceOptionId(null);
          setChoiceAwaitingTarget(false);
          setDiscardSelected([]);
          setAbilityTargetMode(null);
          setSpellTargetMode(null);
        }
      },
      onTurnStart: (payload) => {
        onTurnStart(payload);
        setSelectedAttackerUid(null);
      },
      onTimerWarning: (payload) => {
        onTimerWarning();
        if (payload.player === viewerRef.current) {
          toast.warning(`剩余 ${payload.seconds_left} 秒，请尽快行动！`, { duration: 5000 });
        }
      },
      onTurnTimeout: (payload) => {
        if (payload.player === viewerRef.current) {
          toast.info("回合时间已到，自动结束回合");
        } else {
          toast.info("对手回合超时");
        }
        setSelectedAttackerUid(null);
      },
      onCardPlayed: () => {
        // no-op
      },
      onAttackResult: () => {
        // no-op
      },
      onGameOver: (payload) => {
        setGameOver(payload);
        setSelectedAttackerUid(null);
        // Story mode: report completion only if the player won
        if (payload.mode === "story" && payload.winner_id === user?.id) {
          const levelId = searchParams.get("levelId");
          const matchIdParam = searchParams.get("matchId");
          if (levelId && matchIdParam) {
            import("@/lib/api").then(({ storyApi }) => {
              const viewerSide = viewerRef.current;
              const myPlayer = payload.players?.[viewerSide];
              const hpRemaining = myPlayer?.final_hp ?? 0;
              const maxHp = gameStateRef.current?.players[viewerSide]?.max_hp ?? 30;
              const hpPercent = maxHp > 0 ? (hpRemaining / maxHp) * 100 : 0;
              const turns = payload.turns_played ?? 0;
              let stars = 0;
              if (payload.winner_id === user?.id) stars++;
              if (hpPercent >= 50) stars++;
              if (turns <= 20) stars++;
              storyApi.completeLevel(matchIdParam, levelId, stars, turns, hpRemaining)
                .catch(() => {
                  toast.error("保存故事进度失败");
                });
            });
          }
        }
      },
      onError: (detail) => {
        setLastError(detail);
        toast.error(detail);
      },
      onEffectChoice: () => {
        toast.info("请选择效果分支", { duration: 3000 });
      },
      onUnitMoved: (payload) => {
        if (payload.player !== viewerRef.current) {
          toast.info("对手移动了单位", { duration: 2000 });
        }
      },
      onAbilityUsed: (payload) => {
        if (payload.player !== viewerRef.current) {
          toast.info("对手发动了能力", { duration: 2000 });
        }
      },
      onCombatPhase: () => {
        toast.info("进入战斗阶段", { duration: 1500 });
      },
      onChoiceResolved: () => {
        setChoiceOptionId(null);
        setChoiceAwaitingTarget(false);
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

  const handlePlayCard = (card: BattleUnit, line: "front" | "support" = "front", slot?: number) => {
    if (pendingChoice) {
      toast.info("请先完成效果抉择");
      return;
    }
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
    wsRef.current?.playCard(card.uid, line, null, slot);

    setPlacementCard(null);
  };

  const handleSpellWithTarget = (target: BattleUnit) => {
    if (!spellTargetMode || !isMyTurn) return;
    wsRef.current?.playCard(spellTargetMode.uid, "front", target.uid);
    setSpellTargetMode(null);
  };

  const handleToggleDiscard = (uid: string) => {
    const need = pendingChoice?.discard_count ?? 0;
    setDiscardSelected((prev) => {
      if (prev.includes(uid)) return prev.filter((x) => x !== uid);
      if (prev.length >= need) return prev;
      return [...prev, uid];
    });
  };

  const handleConfirmDiscard = () => {
    if (!pendingChoice?.discard_count) return;
    if (discardSelected.length !== pendingChoice.discard_count) return;
    wsRef.current?.resolveDiscard(discardSelected);
    setDiscardSelected([]);
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

  const handleMoveUnit = (unitId: string) => {
    if (!isMyTurn || !me) return;
    const isFront = me.front_line.some((u) => u.uid === unitId);
    const currentLine = isFront ? "front" : "support";
    const otherLine = isFront ? "support" : "front";
    const target = isFront ? me.support_line : me.front_line;
    const maxSlots = otherLine === "front" ? MAX_FRONT_SLOTS : MAX_SUPPORT_SLOTS;
    if (target.length >= maxSlots) {
      toast.error(`${otherLine === "front" ? "前线" : "支援"}已满`);
      return;
    }
    wsRef.current?.moveUnit(unitId, otherLine);
  };

  const handleMyUnitClick = (unit: BattleUnit) => {
    if (!isMyTurn) return;
    if (abilityTargetMode) {
      wsRef.current?.useAbility(abilityTargetMode, unit.uid);
      setAbilityTargetMode(null);
      return;
    }
    if (unit.can_attack && (phase === "combat" || phase === "main")) {
      setSelectedAttackerUid(selectedAttackerUid === unit.uid ? null : unit.uid);
    }
  };

  const handleMyUnitDoubleClick = (unit: BattleUnit) => {
    if (!isMyTurn || phase !== "main") return;
    if (abilityTargetMode === unit.uid) {
      setAbilityTargetMode(null);
      return;
    }
    if (!unit.has_ability) {
      toast.info("该单位没有可激活的技能");
      return;
    }
    if (!unit.can_use_ability) {
      if (unit.ability_cooldown) {
        toast.info(`技能冷却中（剩余 ${unit.ability_cooldown} 回合）`);
      } else {
        toast.info("该单位本回合已使用技能");
      }
      return;
    }
    setAbilityTargetMode(unit.uid);
    toast.info("请选择技能目标（再次双击取消）");
  };

  const handleChoiceOption = (option: EffectChoiceOption) => {
    if (!pendingChoice) return;
    if (branchNeedsTarget(option.branch_text)) {
      setChoiceOptionId(option.id);
      setChoiceAwaitingTarget(true);
      toast.info("请点击目标单位");
      return;
    }
    wsRef.current?.resolveChoice(option.id);
    setChoiceOptionId(null);
    setChoiceAwaitingTarget(false);
  };

  const handleChoiceTarget = (unit: BattleUnit) => {
    if (!choiceAwaitingTarget || !choiceOptionId) return;
    wsRef.current?.resolveChoice(choiceOptionId, unit.uid);
    setChoiceOptionId(null);
    setChoiceAwaitingTarget(false);
  };

  const handleEnemyUnitClick = (unit: BattleUnit) => {
    if (spellTargetMode) {
      handleSpellWithTarget(unit);
      return;
    }
    if (abilityTargetMode) {
      wsRef.current?.useAbility(abilityTargetMode, unit.uid);
      setAbilityTargetMode(null);
      return;
    }
    if (choiceAwaitingTarget && choiceOptionId) {
      handleChoiceTarget(unit);
      return;
    }
    if (!selectedAttackerUid || !isMyTurn) return;
    if (unit.card_type === "hq") {
      wsRef.current?.attack([selectedAttackerUid], null);
    } else {
      wsRef.current?.attack([selectedAttackerUid], unit.uid);
    }
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
    if (!showSurrenderConfirm) {
      setShowSurrenderConfirm(true);
      return;
    }
    setShowSurrenderConfirm(false);
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
    const isStory = searchParams.get("mode") === "story";
    router.push(isStory ? "/game/story" : "/game/matchmaking");
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
          {showSurrenderConfirm ? "确定投降？" : "投降"}
        </Button>
        {showSurrenderConfirm && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-zinc-400 hover:text-zinc-300 shrink-0"
            onClick={() => setShowSurrenderConfirm(false)}
          >
            取消
          </Button>
        )}
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
                    <HpBar hp={opp.hp} maxHp={opp.max_hp} compact />
                    <div className="mt-1 flex justify-end">
                      <InkBadge ink={opp.ink} max={opp.max_ink} />
                    </div>
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
                interactive={(!!selectedAttackerUid && isMyTurn) || choiceAwaitingTarget}
                choiceTargetMode={choiceAwaitingTarget}
              />
              <LineRow
                label="支援"
                icon={<Shield className="w-3 h-3" />}
                units={opp.support_line}
                onUnitClick={handleEnemyUnitClick}
                interactive={(!!selectedAttackerUid && isMyTurn) || choiceAwaitingTarget}
                choiceTargetMode={choiceAwaitingTarget}
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
            {pendingChoice && isMyTurn && pendingChoice.context !== "discard" && (
              <span className="px-2 py-1 rounded-full text-xs bg-purple-500/15 border border-purple-500/40 text-purple-300">
                待抉择
              </span>
            )}
            {gameState?.corridor_controller === viewer && (
              <span className="px-2 py-1 rounded-full text-xs bg-cyan-500/15 border border-cyan-500/40 text-cyan-300" title="控制走廊：回合开始 +1 墨水">
                走廊控制
              </span>
            )}
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
                <InkBadge ink={me.ink} max={me.max_ink} />
                <p className="mt-1">牌库 {me.deck_count} · 墓地 {me.pen_count}</p>
                {(me.traps?.length ?? 0) > 0 && (
                  <p className="text-purple-400">陷阱 {me.traps!.length}</p>
                )}
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
                onUnitDoubleClick={handleMyUnitDoubleClick}
                selectedUid={selectedAttackerUid}
                interactive={isMyTurn}
                placementCard={placementCard}
                onPlacementSelect={(line) => placementCard && handlePlayCard(placementCard, line)}
                onDropCard={handleDropOnLine}
                onMoveUnit={handleMoveUnit}
              />
              <DeployLineRow
                label="支援"
                icon={<Shield className="w-3 h-3 text-emerald-500" />}
                units={me.support_line}
                lineKey="support"
                maxSlots={MAX_SUPPORT_SLOTS}
                onUnitClick={handleMyUnitClick}
                onUnitDoubleClick={handleMyUnitDoubleClick}
                selectedUid={selectedAttackerUid}
                interactive={isMyTurn}
                placementCard={placementCard}
                onPlacementSelect={(line) => placementCard && handlePlayCard(placementCard, line)}
                onDropCard={handleDropOnLine}
                onMoveUnit={handleMoveUnit}
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

      {pendingChoice && (
        <EffectChoiceDialog
          pending={pendingChoice}
          open={showChoiceDialog}
          selectedOptionId={choiceOptionId}
          awaitingTarget={choiceAwaitingTarget}
          onSelectOption={handleChoiceOption}
          onCancelSelection={() => {
            setChoiceOptionId(null);
            setChoiceAwaitingTarget(false);
          }}
        />
      )}

      {pendingChoice && pendingChoice.context === "discard" && isMyTurn && me?.hand && (
        <DiscardChoiceDialog
          pending={pendingChoice}
          hand={me.hand}
          open
          selectedUids={discardSelected}
          onToggle={handleToggleDiscard}
          onConfirm={handleConfirmDiscard}
        />
      )}

      {gameOver && gameState && (
        <BattleResultScreen
          gameOver={gameOver}
          viewer={viewer}
          userId={user?.id}
          matchId={matchId ?? undefined}
          storyStars={
            gameOver.mode === "story"
              ? (() => {
                  const my = gameOver.players?.[viewer];
                  const hpRemaining = my?.final_hp ?? 0;
                  const maxHp = gameState?.players[viewer]?.max_hp ?? 30;
                  const hpPercent = maxHp > 0 ? (hpRemaining / maxHp) * 100 : 0;
                  const turns = gameOver.turns_played ?? 0;
                  let stars = 0;
                  if (gameOver.winner_id === user?.id) stars++;
                  if (hpPercent >= 50) stars++;
                  if (turns <= 20) stars++;
                  return stars;
                })()
              : undefined
          }
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
