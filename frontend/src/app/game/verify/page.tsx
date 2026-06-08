"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Swords,
  Shield,
  Flag,
  Droplets,
  Clock,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Trophy,
  SkipForward,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import BattleCard, { CardBackStack, EmptyBattleSlot } from "@/components/game/battle/battle-card";
import BattleTurnTimer, { MatchElapsedClock } from "@/components/game/battle/battle-turn-timer";
import BattleTimerWarning from "@/components/game/battle/battle-timer-warning";
import { cn } from "@/lib/utils";

/* -------- mock data -------- */
const MOCK_UNITS = [
  { uid: "a1", card_id: "key_001", name: "学霸小明", cost: 3, power: 4, spirit: 5, grit: 3, can_attack: true, faction: "key_class", card_type: "character" },
  { uid: "a2", card_id: "art_002", name: "画社小红", cost: 2, power: 2, spirit: 3, grit: 5, can_attack: false, faction: "art_club", card_type: "character" },
  { uid: "a3", card_id: "spr_003", name: "体育小刚", cost: 4, power: 6, spirit: 4, grit: 2, can_attack: true, faction: "sports", card_type: "character" },
  { uid: "a4", card_id: "stu_004", name: "学生会小雨", cost: 5, power: 3, spirit: 6, grit: 4, can_attack: false, faction: "student_council", card_type: "character" },
  { uid: "a5", card_id: "sci_005", name: "科学社小智", cost: 1, power: 2, spirit: 2, grit: 2, can_attack: true, faction: "science", card_type: "character" },
];

const MOCK_CANT_ATTACK = [
  { uid: "b1", card_id: "key_006", name: "新生小白", cost: 2, power: 1, spirit: 3, grit: 2, can_attack: false, faction: "key_class", card_type: "character" },
  { uid: "b2", card_id: "art_007", name: "画社小花", cost: 3, power: 3, spirit: 4, grit: 3, can_attack: false, faction: "art_club", card_type: "character" },
];

/* -------- sections -------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-purple-400 border-b border-zinc-800 pb-1">{title}</h2>
      {children}
    </section>
  );
}

/* -------- main page -------- */
export default function UIVerifyPage() {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(74);
  const [showWarning, setShowWarning] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-10 max-w-5xl mx-auto">
      <header className="text-center space-y-1">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
          CampusKards UI 验证
        </h1>
        <p className="text-sm text-zinc-500">覆盖所有核心组件 — 渲染 / 布局 / 交互 / 动画</p>
      </header>

      {/* ===== 1. BattleCard ===== */}
      <Section title="1. BattleCard — 手牌 / 场上 / 选中 / 不可用 / 费用不足">
        <p className="text-xs text-zinc-500">点击切换选中态。带黄色光晕 = 可攻击。</p>
        <div className="flex gap-4 flex-wrap items-end justify-center p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
          {MOCK_UNITS.map((u) => (
            <BattleCard
              key={u.uid}
              unit={u}
              variant="hand"
              selected={selectedUid === u.uid}
              onClick={() => setSelectedUid(selectedUid === u.uid ? null : u.uid)}
            />
          ))}
          <div className="w-px h-20 bg-zinc-700 mx-2" />
          {MOCK_UNITS.map((u) => (
            <BattleCard key={u.uid} unit={u} variant="field" disabled />
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-3">不可用 + 费用不足灰显：</p>
        <div className="flex gap-4 flex-wrap items-end justify-center p-4 bg-zinc-900/30 rounded-xl">
          <BattleCard unit={MOCK_CANT_ATTACK[0]} variant="hand" disabled affordable={false} />
          <BattleCard unit={MOCK_CANT_ATTACK[1]} variant="hand" disabled />
          <EmptyBattleSlot />
        </div>
      </Section>

      {/* ===== 2. CardBackStack ===== */}
      <Section title="2. CardBackStack — 对手手牌背面">
        <div className="flex gap-8 items-end justify-center p-4 bg-zinc-900/30 rounded-xl">
          <CardBackStack count={0} />
          <CardBackStack count={1} />
          <CardBackStack count={3} />
          <CardBackStack count={7} />
        </div>
      </Section>

      {/* ===== 3. 计时器 ===== */}
      <Section title="3. BattleTurnTimer + 对局时钟">
        <div className="flex gap-6 flex-wrap items-center justify-center p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <div className="space-y-1 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">己方回合 (74s)</p>
            <BattleTurnTimer secondsLeft={74} turnLimit={100} isMyTurn warningAt={20} />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">己方 ≤20s 警告</p>
            <BattleTurnTimer secondsLeft={15} turnLimit={100} isMyTurn warningAt={20} />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">己方 ≤5s 危急</p>
            <BattleTurnTimer secondsLeft={3} turnLimit={100} isMyTurn warningAt={20} />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">对手回合</p>
            <BattleTurnTimer secondsLeft={55} turnLimit={100} isMyTurn={false} warningAt={20} />
          </div>
          <div className="w-px h-12 bg-zinc-700" />
          <MatchElapsedClock elapsed={0} />
          <MatchElapsedClock elapsed={67} />
          <MatchElapsedClock elapsed={542} />
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-center mt-3">
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setTimerSeconds(74)}>74s</Button>
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setTimerSeconds(15)}>15s</Button>
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setTimerSeconds(3)}>3s</Button>
          <BattleTurnTimer secondsLeft={timerSeconds} turnLimit={100} isMyTurn warningAt={20} />
        </div>
      </Section>

      {/* ===== 4. 时间不足警告横幅 ===== */}
      <Section title="4. BattleTimerWarning — 顶级横幅">
        <div className="flex gap-3 items-center">
          <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400" onClick={() => setShowWarning(true)}>
            显示警告
          </Button>
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setShowWarning(false)}>
            关闭警告
          </Button>
        </div>
        <div className="relative h-20 mt-2">
          <BattleTimerWarning open={showWarning} secondsLeft={18} onDismiss={() => setShowWarning(false)} />
        </div>
      </Section>

      {/* ===== 5. HP条 + 墨水 ===== */}
      <Section title="5. HP条 + 墨水指示">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { hp: 30, max: 30, ink: 10, maxInk: 10, label: "满血" },
            { hp: 18, max: 30, ink: 5, maxInk: 7, label: "中等" },
            { hp: 8, max: 30, ink: 2, maxInk: 3, label: "低血量" },
            { hp: 2, max: 30, ink: 0, maxInk: 1, label: "濒死" },
          ].map((s) => (
            <Card key={s.label} className="bg-zinc-900/80 border-zinc-800">
              <CardContent className="pt-4 pb-3 space-y-2">
                <p className="text-[10px] text-zinc-500">{s.label}</p>
                <HpPreview hp={s.hp} maxHp={s.max} />
                <InkPreview ink={s.ink} max={s.maxInk} />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* ===== 6. 战场阵型布局 ===== */}
      <Section title="6. 战场阵型布局（模拟对手区 + 我方区）">
        <div className="space-y-4">
          {/* 对手 */}
          <div className="rounded-2xl border border-red-900/30 bg-gradient-to-b from-red-950/20 to-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-9 h-9 border border-red-800/50">
                  <AvatarFallback className="bg-red-950 text-red-300 text-xs">对手</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm text-zinc-100">对手 ELO 1150</p>
                  <HpPreview hp={22} maxHp={30} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CardBackStack count={4} />
                <InkPreview ink={6} max={8} />
              </div>
            </div>
            <div className="space-y-3">
              <LinePreview label="前线" units={MOCK_UNITS.slice(0, 3)} />
              <LinePreview label="支援" units={MOCK_CANT_ATTACK} />
            </div>
          </div>

          {/* 我方 */}
          <div className="rounded-2xl border border-emerald-900/30 bg-gradient-to-b from-emerald-950/15 to-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <HpPreview hp={25} maxHp={30} />
              <InkPreview ink={8} max={10} />
            </div>
            <div className="space-y-3">
              <LinePreview label="前线" units={MOCK_UNITS.slice(0, 2)} />
              <LinePreview label="支援" units={MOCK_UNITS.slice(2, 4)} />
            </div>
          </div>
        </div>
      </Section>

      {/* ===== 7. 手牌区 + 操作栏 ===== */}
      <Section title="7. 手牌区 + 部署选择 + 操作按钮">
        <div className="rounded-2xl border border-purple-800/30 bg-gradient-to-t from-purple-950/20 to-zinc-900/60 p-4 space-y-3">
          <p className="text-[10px] text-zinc-500 uppercase text-center">手牌 · 点击出牌</p>
          <div className="flex gap-2 overflow-x-auto pb-2 justify-center min-h-[7.5rem] items-end">
            {MOCK_UNITS.map((card) => (
              <BattleCard
                key={card.uid}
                unit={card}
                variant="hand"
                onClick={() => setSelectedUid(card.uid)}
                affordable={card.cost! <= 8}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center items-center">
            <DeployToggle />
            <Button className="gap-2 bg-purple-600 hover:bg-purple-500">
              <SkipForward className="w-4 h-4" />
              结束回合
            </Button>
          </div>
        </div>
      </Section>

      {/* ===== 8. 对战历史统计卡片 ===== */}
      <Section title="8. 对战历史 — 统计卡片样式">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="胜率" value="64%" sub="20胜 11负 1平" />
          <StatCard label="总场次" value="32" sub="排位 18 · 快速 14" />
          <StatCard label="当前 ELO" value="1185" accent />
          <StatCard label="近 7 天 ELO" value="+32" sub="" trend="up" />
        </div>
      </Section>

      {/* ===== 9. 结算弹层 ===== */}
      <Section title="9. 对局结算弹层">
        <div className="flex gap-3 items-center">
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setSelectedUid("win")}>胜利结算</Button>
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setSelectedUid("loss")}>战败结算</Button>
        </div>
      </Section>

      <AnimatePresence>
        {selectedUid === "win" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedUid(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl bg-emerald-500/20 text-emerald-400">胜</div>
              <h2 className="text-xl font-bold">胜利！</h2>
              <p className="text-sm text-zinc-400">ELO +24</p>
              <Button className="w-full bg-purple-600 hover:bg-purple-500" onClick={() => setSelectedUid(null)}>返回匹配</Button>
            </motion.div>
          </motion.div>
        )}
        {selectedUid === "loss" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedUid(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl bg-red-500/20 text-red-400">负</div>
              <h2 className="text-xl font-bold">战败</h2>
              <p className="text-sm text-zinc-400">ELO -18</p>
              <Button className="w-full bg-purple-600 hover:bg-purple-500" onClick={() => setSelectedUid(null)}>返回匹配</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== helper components ===== */

function HpPreview({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="space-y-0.5 w-full max-w-[10rem]">
      <div className="flex items-center gap-1">
        <Heart className="w-3 h-3 text-red-500 fill-red-500" />
        <span className="text-[10px] font-mono text-zinc-400">{hp}/{maxHp}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
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

function InkPreview({ ink, max }: { ink: number; max: number }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-zinc-400">
      <Droplets className="w-3 h-3 text-sky-400" />
      <span className="font-mono text-sky-300">{ink}/{max}</span>
    </div>
  );
}

function LinePreview({ label, units }: { label: string; units: typeof MOCK_UNITS }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="flex gap-2 min-h-[8rem] flex-wrap justify-center items-end">
        {units.length === 0 ? (
          <EmptyBattleSlot />
        ) : (
          units.map((u) => <BattleCard key={u.uid} unit={u} variant="field" disabled />)
        )}
      </div>
    </div>
  );
}

function DeployToggle() {
  const [line, setLine] = useState<"front" | "support">("front");
  return (
    <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
      {(["front", "support"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLine(l)}
          className={cn(
            "px-3 py-2 transition-colors",
            line === l ? "bg-purple-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          )}
        >
          {l === "front" ? "前线" : "支援"}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, accent, trend }: { label: string; value: string; sub?: string; accent?: boolean; trend?: "up" | "down" }) {
  return (
    <Card className="bg-zinc-900/80 border-zinc-800">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={cn("text-2xl font-bold flex items-center gap-1", accent && "text-amber-400")}>
          {trend === "up" && <TrendingUp className="w-5 h-5 text-emerald-400" />}
          {trend === "down" && <TrendingDown className="w-5 h-5 text-red-400" />}
          {value}
        </p>
        {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
      </CardContent>
    </Card>
  );
}
