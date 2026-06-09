import type { BattleReportEvent } from "@/types";

export type HighlightKind = "highlight" | "mvp";

export interface EventAnnotation {
  index: number;
  kind: HighlightKind;
  label: string;
  score: number;
  player: string;
}

const HIGHLIGHT_ACTIONS = new Set([
  "attack_face",
  "attack_unit",
  "overflow_damage",
  "victory",
  "deploy",
  "play_spell",
]);

function parseFaceDamage(detail: string): number {
  const m = detail.match(/for (\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseOverflow(detail: string): number {
  const m = detail.match(/overflow (\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseSpiritAfter(detail: string): number | null {
  const m = detail.match(/spirit (-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function annotateEvent(
  event: BattleReportEvent,
  index: number
): EventAnnotation | null {
  const { action, detail, player } = event;

  if (action === "victory") {
    return { index, kind: "mvp", label: "制胜时刻", score: 12, player };
  }

  if (action === "attack_face") {
    const dmg = parseFaceDamage(detail);
    const spirit = parseSpiritAfter(detail);
    if (spirit === 0) {
      return { index, kind: "mvp", label: "终结直击", score: 10 + dmg, player };
    }
    if (dmg >= 4) {
      return { index, kind: "highlight", label: "重磅直击", score: dmg, player };
    }
    if (dmg >= 2) {
      return { index, kind: "highlight", label: "直击", score: dmg, player };
    }
  }

  if (action === "overflow_damage") {
    const overflow = parseOverflow(detail);
    const spirit = parseSpiritAfter(detail);
    if (overflow >= 2 || spirit === 0) {
      return {
        index,
        kind: spirit === 0 ? "mvp" : "highlight",
        label: spirit === 0 ? "溢出终结" : "溢出伤害",
        score: overflow + (spirit === 0 ? 6 : 2),
        player,
      };
    }
  }

  if (action === "attack_unit") {
    if (detail.includes("def_alive=False")) {
      return { index, kind: "highlight", label: "斩杀单位", score: 5, player };
    }
    const powerMatch = detail.match(/\((\d+)\)/);
    const power = powerMatch ? parseInt(powerMatch[1], 10) : 0;
    if (power >= 5) {
      return { index, kind: "highlight", label: "强力攻击", score: power, player };
    }
  }

  if (action === "deploy" && /advisor|support|front/i.test(detail)) {
    return { index, kind: "highlight", label: "关键部署", score: 2, player };
  }

  if (action === "play_spell") {
    return { index, kind: "highlight", label: "法术施放", score: 2, player };
  }

  if (action === "fatigue") {
    const m = detail.match(/now (\d+)/);
    const hp = m ? parseInt(m[1], 10) : null;
    if (hp !== null && hp <= 3) {
      return { index, kind: "highlight", label: "疲劳迫近", score: 3, player };
    }
  }

  if (HIGHLIGHT_ACTIONS.has(action) && action === "game_start") {
    return null;
  }

  return null;
}

export function buildReplayAnnotations(
  events: BattleReportEvent[]
): EventAnnotation[] {
  const annotations: EventAnnotation[] = [];
  for (let i = 0; i < events.length; i++) {
    const ann = annotateEvent(events[i], i);
    if (ann) annotations.push(ann);
  }
  return annotations;
}

export function computeMvpScores(
  annotations: EventAnnotation[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const ann of annotations) {
    scores[ann.player] = (scores[ann.player] ?? 0) + ann.score;
  }
  return scores;
}

export function getMvpPlayer(
  scores: Record<string, number>
): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const [player, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = player;
    }
  }
  return best;
}
