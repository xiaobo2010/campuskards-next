"""Trap counters, turn-end effects, and on-opponent-play hooks."""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState

COUNTER_CARD_TYPES = frozenset({"snitch", "counter"})


class PlayEventKind(str, Enum):
    COMMAND = "command"
    UNIT = "unit"
    ANY = "any"


@dataclass
class PlayEvent:
    actor: int
    card: CardInstance
    kind: PlayEventKind
    cost: int
    cancelled: bool = False


def is_counter_card(card_type: str) -> bool:
    return (card_type or "").lower() in COUNTER_CARD_TYPES


def is_trap_effect(text: str) -> bool:
    return "当对手" in (text or "")


def trap_matches(trap: CardInstance, event: PlayEvent) -> bool:
    text = trap.effect_text or ""
    if "当对手打出命令卡" in text and event.kind == PlayEventKind.COMMAND:
        return True
    if "当对手打出单位卡" in text and event.kind == PlayEventKind.UNIT:
        return True
    m = re.search(r"当对手打出费用([≥≤])(\d+)", text)
    if m:
        threshold = int(m.group(2))
        if (m.group(1) == "≤" and event.cost <= threshold) or (m.group(1) == "≥" and event.cost >= threshold):
            return True
    if "当对手打出" in text and event.kind == PlayEventKind.ANY:
        return True
    return False


def classify_play_event(card: CardInstance) -> PlayEventKind:
    ct = (card.card_type or "").lower()
    if ct in ("command", "event", "buff"):
        return PlayEventKind.COMMAND
    if ct in ("character", "unit"):
        return PlayEventKind.UNIT
    return PlayEventKind.ANY


def resolve_trap(game: GameState, owner: int, trap: CardInstance, event: PlayEvent) -> bool:
    """Execute trap effect. Returns True if the play was cancelled."""
    from . import effect_engine

    text = trap.effect_text or ""
    game._log(owner, "trap_trigger", f"{trap.name} vs {event.card.name}")
    effect_engine.execute_trap_effect(game, owner, trap, event)
    side = game.battlefield.side_for(owner)
    if trap in side.traps:
        side.traps.remove(trap)
    side.graveyard.append(trap)
    return "取消" in text or event.cancelled


def check_traps_on_play(game: GameState, event: PlayEvent) -> bool:
    """Non-active player traps may cancel/modify opponent play."""
    defender = 3 - event.actor
    side = game.battlefield.side_for(defender)
    for trap in side.traps[:]:
        if trap_matches(trap, event):
            if resolve_trap(game, defender, trap, event):
                event.cancelled = True
                return True
    return False


def fire_opponent_play_hooks(game: GameState, event: PlayEvent) -> None:
    """Units with '对手每打出' / reactive text on the opponent's side (defending player)."""
    from . import effect_engine

    defender = 3 - event.actor
    side = game.battlefield.side_for(defender)
    for unit in side.all_units:
        text = unit.effect_text or ""
        if "对手每打出" in text:
            effect_engine.execute_reactive_text(game, defender, unit, text, event)


def fire_defender_reactive_units(game: GameState, event: PlayEvent) -> None:
    """Defender's units that react to opponent plays."""
    from . import effect_engine

    defender = 3 - event.actor
    side = game.battlefield.side_for(defender)
    for unit in side.all_units:
        text = unit.effect_text or ""
        if "当对手打出" in text or "对手每打出" in text:
            effect_engine.execute_reactive_text(game, defender, unit, text, event)


def fire_turn_end_effects(game: GameState, player: int) -> None:
    from . import effect_engine

    side = game.battlefield.side_for(player)
    for unit in side.all_units:
        text = unit.effect_text or ""
        if "你的回合结束时" in text or "回合结束时" in text:
            effect_engine.execute_turn_end_text(game, player, unit, text)
