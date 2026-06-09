import { API_BASE } from "./config";
import type { GameOverPayload, GameStatePayload, PendingChoicePayload } from "@/types";

export type WsConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface GameWsHandlers {
  onGameState: (state: GameStatePayload) => void;
  onTurnStart?: (payload: {
    player: string;
    timer: number;
    timer_remaining?: number;
    turn_deadline_ts?: number;
  }) => void;
  onTimerWarning?: (payload: { seconds_left: number; player: string }) => void;
  onTurnTimeout?: (payload: { player: string; reason?: string }) => void;
  onCardPlayed?: (payload: Record<string, unknown>) => void;
  onEffectChoice?: (payload: PendingChoicePayload) => void;
  onChoiceResolved?: (payload: Record<string, unknown>) => void;
  onAttackResult?: (payload: Record<string, unknown>) => void;
  onGameOver?: (payload: GameOverPayload) => void;
  onError?: (detail: string) => void;
  onStatusChange?: (status: WsConnectionStatus) => void;
}

export function getWsBase(): string {
  if (typeof window === "undefined") return "";
  const api = API_BASE || window.location.origin;
  if (api.startsWith("https://")) return api.replace("https://", "wss://");
  if (api.startsWith("http://")) return api.replace("http://", "ws://");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

export class GameWsClient {
  private ws: WebSocket | null = null;
  private matchId: string;
  private handlers: GameWsHandlers;
  private closed = false;

  constructor(matchId: string, handlers: GameWsHandlers) {
    this.matchId = matchId;
    this.handlers = handlers;
  }

  connect(): void {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      this.handlers.onError?.("未登录，无法连接对战");
      this.handlers.onStatusChange?.("error");
      return;
    }

    this.closed = false;
    this.handlers.onStatusChange?.("connecting");

    const url = `${getWsBase()}/ws/game/${this.matchId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.handlers.onStatusChange?.("connected");
      this.send("join_match", { match_id: this.matchId });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { event: string; payload: unknown };
        this.dispatch(msg.event, msg.payload);
      } catch {
        this.handlers.onError?.("收到无效消息");
      }
    };

    ws.onerror = () => {
      this.handlers.onError?.("WebSocket 连接异常");
      this.handlers.onStatusChange?.("error");
    };

    ws.onclose = () => {
      if (!this.closed) {
        this.handlers.onStatusChange?.("disconnected");
      }
    };
  }

  private dispatch(event: string, payload: unknown): void {
    switch (event) {
      case "game_state":
        this.handlers.onGameState(payload as GameStatePayload);
        break;
      case "turn_start":
        this.handlers.onTurnStart?.(
          payload as {
            player: string;
            timer: number;
            timer_remaining?: number;
            turn_deadline_ts?: number;
          }
        );
        break;
      case "timer_warning":
        this.handlers.onTimerWarning?.(
          payload as { seconds_left: number; player: string }
        );
        break;
      case "turn_timeout":
        this.handlers.onTurnTimeout?.(
          payload as { player: string; reason?: string }
        );
        break;
      case "card_played":
        this.handlers.onCardPlayed?.(payload as Record<string, unknown>);
        break;
      case "effect_choice":
        this.handlers.onEffectChoice?.(payload as PendingChoicePayload);
        break;
      case "choice_resolved":
        this.handlers.onChoiceResolved?.(payload as Record<string, unknown>);
        break;
      case "attack_result":
        this.handlers.onAttackResult?.(payload as Record<string, unknown>);
        break;
      case "game_over":
        this.handlers.onGameOver?.(payload as GameOverPayload);
        break;
      case "error": {
        const detail =
          payload && typeof payload === "object" && "detail" in payload
            ? String((payload as { detail: string }).detail)
            : "操作失败";
        this.handlers.onError?.(detail);
        break;
      }
      default:
        break;
    }
  }

  send(event: string, payload: Record<string, unknown> = {}): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  playCard(
    cardUid: string,
    position: "front" | "support" = "front",
    targetId?: string | null
  ): void {
    this.send("play_card", {
      card_id: cardUid,
      position,
      ...(targetId ? { target_id: targetId } : {}),
    });
  }

  resolveChoice(choiceId: string, targetId?: string | null): void {
    this.send("resolve_choice", {
      choice_id: choiceId,
      ...(targetId ? { target_id: targetId } : {}),
    });
  }

  resolveDiscard(cardUids: string[]): void {
    this.send("resolve_discard", { card_uids: cardUids });
  }

  moveUnit(unitId: string, toLine: "front" | "support"): void {
    this.send("move_unit", { unit_id: unitId, to_line: toLine });
  }

  useAbility(cardUid: string, targetId?: string | null): void {
    this.send("use_ability", {
      card_id: cardUid,
      ...(targetId ? { target_id: targetId } : {}),
    });
  }

  attack(attackerIds: string[], targetId: string | null): void {
    this.send("attack", { attacker_ids: attackerIds, target_id: targetId });
  }

  endTurn(): void {
    this.send("end_turn", {});
  }

  disconnect(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.handlers.onStatusChange?.("idle");
  }
}
