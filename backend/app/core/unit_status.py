"""Unit status effects (immune, silence, control, etc.)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .game_engine import CardInstance, GameState


def tick_statuses_for_player(game: GameState, player: int) -> None:
    side = game.battlefield.side_for(player)
    for unit in side.all_units:
        tick_unit_statuses(unit, game.turn)
    expired: list = []
    for adv in side.advisor_units:
        if adv.duration != -1:
            adv.duration -= 1
            if adv.duration <= 0:
                expired.append(adv)
    for adv in expired:
        side.advisor_units.remove(adv)


def tick_unit_statuses(unit: CardInstance, turn: int) -> None:
    if unit.immune_turns > 0:
        unit.immune_turns -= 1
    if unit.silenced_turns > 0:
        unit.silenced_turns -= 1
    if unit.cannot_attack_turns > 0:
        unit.cannot_attack_turns -= 1
        if unit.cannot_attack_turns <= 0:
            unit.can_attack = True
    if unit.controlled_by is not None and unit.controlled_until_turn > 0 and turn > unit.controlled_until_turn:
        unit.controlled_by = None
        unit.controlled_until_turn = 0


def is_silenced(unit: CardInstance) -> bool:
    return unit.silenced_turns > 0


def is_immune(unit: CardInstance) -> bool:
    return unit.immune_turns > 0


def effective_owner(unit: CardInstance) -> int:
    return unit.controlled_by or unit.owner


def grant_keyword(unit: CardInstance, keyword: str, *, turns: int = 0) -> None:
    unit.keywords.add(keyword)
    if keyword == "first_strike":
        pass
    if turns and keyword == "immune":
        unit.immune_turns = max(unit.immune_turns, turns)


def apply_silence(unit: CardInstance, turns: int = 1) -> None:
    unit.silenced_turns = max(unit.silenced_turns, turns)


def apply_immune(unit: CardInstance, turns: int = 1) -> None:
    unit.immune_turns = max(unit.immune_turns, turns)


def apply_cannot_attack(unit: CardInstance, turns: int = 1) -> None:
    unit.cannot_attack_turns = max(unit.cannot_attack_turns, turns)
    unit.can_attack = False
